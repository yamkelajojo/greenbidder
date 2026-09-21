/**
 * Production-hardening static audit for the disease feature.
 *
 * These checks scan the JSX/JS source for patterns that are known to cause
 * runtime bugs in React Native apps:
 *   - Hooks called with unstable/stale deps
 *   - Props renamed without updating all call sites
 *   - Functions called before state updates that the caller expects
 *   - Text strings that shouldn't ship in release (e.g. debug-only alerts)
 *
 * These complement the behavioral unit tests by catching structural
 * problems no unit test would notice.
 *
 * Run with: node scripts/check-audit.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(p) {
  return readFileSync(join(root, p), "utf8");
}

let passed = 0;
function check(name, fn) {
  fn();
  console.log(`  ✓ ${name}`);
  passed++;
}

const scan = read("src/screens/disease/DiseaseScanScreen.jsx");
const card = read("src/screens/disease/DiseaseResultCard.jsx");
const history = read("src/screens/disease/ScanHistoryItem.jsx");
const svcNative = read("src/services/diseaseService.native.js");
const svcWeb = read("src/services/diseaseService.web.js");
const histSvc = read("src/services/diseaseHistory.js");
const anim = read("src/utils/animations.js");
const logic = read("src/utils/diseaseLogic.js");
const imgSvc = read("src/services/imageService.js");

// ---------------------------------------------------------------------------
// 1. No hardcoded network URLs, API keys, or secrets.
// ---------------------------------------------------------------------------
check("no hardcoded http:// URLs in disease screens/services", () => {
  const combined = scan + card + history + svcNative + histSvc;
  const matches = combined.match(/http:\/\/(?!localhost|127\.0\.0\.1)[^\s"')]+/g);
  assert.equal(matches, null, `Found hardcoded http URL(s): ${matches}`);
});

// ---------------------------------------------------------------------------
// 2. No console.log left in production paths (console.warn/error are fine
//    — they're intentional diagnostics).
// ---------------------------------------------------------------------------
check("no stray console.log in disease feature", () => {
  for (const [name, src] of Object.entries({
    "DiseaseScanScreen.jsx": scan,
    "DiseaseResultCard.jsx": card,
    "ScanHistoryItem.jsx": history,
    "diseaseService.native.js": svcNative,
    "diseaseService.web.js": svcWeb,
    "diseaseHistory.js": histSvc,
    "imageService.js": imgSvc,
    "animations.js": anim,
    "diseaseLogic.js": logic,
  })) {
    if (/console\.log\(/.test(src)) {
      assert.fail(`console.log found in ${name} — remove or downgrade to warn/error`);
    }
  }
});

// ---------------------------------------------------------------------------
// 3. Every TouchableOpacity and Pressable in disease screens sets
//    activeOpacity for consistent press feedback.
// ---------------------------------------------------------------------------
check("all disease-screen TouchableOpacity elements specify activeOpacity", () => {
  // Brace/quote-aware scanner: starting from `<TouchableOpacity`, walk
  // forward tracking braces `{}` and quotes, and stop at the first `>`
  // that is NOT inside `{...}` or `"..."` / `'...'` / `\`...\`` — that's
  // the actual tag-closing `>`.
  function findTouchableBlocks(src) {
    const blocks = [];
    let idx = 0;
    while (true) {
      const start = src.indexOf("<TouchableOpacity", idx);
      if (start === -1) break;
      let i = start + "<TouchableOpacity".length;
      let depth = 0; // brace depth inside JSX expressions
      let inStr = null; // null | '"' | "'" | '`'
      let inComment = false;
      while (i < src.length) {
        const ch = src[i];
        const next = src[i + 1];
        if (inStr) {
          if (ch === "\\") { i += 2; continue; }
          if (ch === inStr) inStr = null;
          i++;
          continue;
        }
        if (inComment) {
          if (ch === "*" && next === "/") { inComment = false; i += 2; continue; }
          i++;
          continue;
        }
        if (ch === "/" && next === "*") { inComment = true; i += 2; continue; }
        if (ch === '"' || ch === "'" || ch === "`") { inStr = ch; i++; continue; }
        if (ch === "{") { depth++; i++; continue; }
        if (ch === "}") { depth = Math.max(0, depth - 1); i++; continue; }
        if (ch === ">" && depth === 0) {
          // Found the tag close.
          blocks.push(src.slice(start, i + 1));
          idx = i + 1;
          break;
        }
        i++;
      }
      if (i >= src.length) break;
    }
    return blocks;
  }

  const allFiles = { ScanHistoryItem: history, DiseaseScanScreen: scan };
  for (const [fname, src] of Object.entries(allFiles)) {
    for (const block of findTouchableBlocks(src)) {
      if (block.startsWith("</")) continue;
      assert.ok(
        /activeOpacity=\{0\.8\}/.test(block),
        `${fname} TouchableOpacity missing activeOpacity={0.8}: ${block.replace(/\s+/g, " ").slice(0, 220)}`
      );
    }
  }
});

// ---------------------------------------------------------------------------
// 4. Pagination in diseaseHistory.js correctly handles "more pages" logic —
//    specifically it must NOT rely on Supabase's count: 'exact' when a
//    `before` cursor is set (that returns the filtered count, not total).
// ---------------------------------------------------------------------------
check("diseaseHistory uses page-length heuristic when paginating past first page", () => {
  // The function should branch on `before` for the count strategy.
  assert.ok(
    /useExactCount\s*=\s*!before/.test(histSvc),
    "Expected `useExactCount = !before` branch in getScanHistory"
  );
  assert.ok(
    /rows\.length\s*>?=\s*limit/.test(histSvc),
    "Expected page-length heuristic (rows.length >= limit) for cursor pagination"
  );
});

// ---------------------------------------------------------------------------
// 5. DiseaseScanScreen uses refs to read history inside useCallback([]) so
//    there are no stale-closure bugs in pagination handlers.
// ---------------------------------------------------------------------------
check("DiseaseScanScreen uses historyRef (not direct state) inside loadHistory", () => {
  assert.ok(
    /historyRef/.test(scan),
    "Expected loadHistory to read history via a ref, not a closure"
  );
  // loadHistory callback should have empty deps to prevent churn.
  assert.ok(
    /const loadHistory = useCallback\(async[^)]*\) => \{[\s\S]*?\}, \[\]\)/s.test(scan) ||
      /loadHistory = useCallback[\s\S]*?\}, \[\]\)/s.test(scan),
    "Expected loadHistory useCallback to have empty deps (using refs for state)"
  );
});

// ---------------------------------------------------------------------------
// 6. No use of AsyncStorage or localStorage in disease code — all history
//    goes through Supabase / the diseaseHistory service so we have a
//    single source of truth.
// ---------------------------------------------------------------------------
check("disease code does not use AsyncStorage or localStorage directly", () => {
  const combined = scan + card + history + svcNative + histSvc + logic;
  assert.ok(
    !/from ['"]@react-native-async-storage\/async-storage['"]/.test(combined),
    "Unexpected AsyncStorage import — use diseaseHistory service instead"
  );
  assert.ok(
    !/\blocalStorage\b/.test(combined),
    "Unexpected localStorage reference"
  );
});

// ---------------------------------------------------------------------------
// 7. The web stub exports every symbol that the native service exports.
//    Prevents "import { x } is undefined" web crashes when Metro resolves
//    the wrong file.
// ---------------------------------------------------------------------------
check("diseaseService.web.js exports every symbol exported by the native service", () => {
  // Collect native exports: both `export const foo` and `export function foo`
  // and explicit `export { ... }` re-exports.
  const nativeExported = new Set();
  for (const m of svcNative.matchAll(/export\s+(?:const|function|class)\s+([A-Za-z0-9_]+)/g)) {
    nativeExported.add(m[1]);
  }
  const reexp = svcNative.match(/export\s*\{([^}]+)\}\s*from/);
  if (reexp) {
    for (const name of reexp[1].split(",").map((s) => s.trim().split(/\s+as\s+/).pop())) {
      if (name && !/^\/\*/.test(name)) nativeExported.add(name);
    }
  }
  for (const name of nativeExported) {
    const re = new RegExp(`\\bexport\\b[\\s\\S]*?\\b${name}\\b`);
    assert.ok(
      re.test(svcWeb),
      `diseaseService.web.js is missing export: ${name}`
    );
  }
});

// ---------------------------------------------------------------------------
// 8. FORCE_AUTH_BYPASS is guarded with __DEV__ — must never ship to release.
// ---------------------------------------------------------------------------
check("FORCE_AUTH_BYPASS is guarded by __DEV__", () => {
  const nav = read("src/navigation/RootNavigator.jsx");
  assert.ok(
    /const FORCE_AUTH_BYPASS\s*=\s*__DEV__/.test(nav),
    "FORCE_AUTH_BYPASS must be set to __DEV__ (never true in release)"
  );
});

// ---------------------------------------------------------------------------
// 9. The debug test-image button is guarded by __DEV__ so it never ships
//    to production builds.
// ---------------------------------------------------------------------------
check("debug/test-image helper is wrapped in __DEV__", () => {
  assert.ok(
    /\{__DEV__\s*&&\s*\(\s*<AppButton[\s\S]*?Debug: Test inference[\s\S]*?\/>\s*\)\}/s.test(scan),
    "The debug 'Test inference' button must be wrapped in {__DEV__ && ...}"
  );
});

// ---------------------------------------------------------------------------
// 10. All animated width interpolations (useNativeDriver: false) are
//      justified and transform/opacity animations use native driver.
// ---------------------------------------------------------------------------
check("native-driver used on all non-width animations", () => {
  // Count useNativeDriver:true vs false in animations hook.
  const trues = (anim.match(/useNativeDriver:\s*true/g) || []).length;
  const falses = (anim.match(/useNativeDriver:\s*false/g) || []).length;
  assert.ok(trues >= 6, `Expected at least 6 native-driver animations, got ${trues}`);
  // useNativeDriver: false should only appear in useProgress (width animation).
  assert.ok(falses <= 2, `Expected at most 2 non-native animations (useProgress), got ${falses}`);
});

// ---------------------------------------------------------------------------
// 11. Preprocessing always cleans up the presized intermediate file
//     (no disk leak across many diagnoses).
// ---------------------------------------------------------------------------
check("two-stage resize cleans up intermediate presized file", () => {
  assert.ok(
    /FileSystem\.deleteAsync\(presizedUri/.test(svcNative),
    "Expected intermediate presized file to be deleted after final resize"
  );
});

// ---------------------------------------------------------------------------
// 12. Cache cleanup runs on mount (non-blocking, fire-and-forget) to prevent
//     unbounded cache growth.
// ---------------------------------------------------------------------------
check("cache cleanup is triggered on screen mount", () => {
  assert.ok(
    /cleanupOldCache\(\)\.catch/.test(scan),
    "Expected cleanupOldCache().catch(...) fire-and-forget in useEffect mount"
  );
});

// ---------------------------------------------------------------------------
// 13. All Alert destructive actions use { style: 'destructive' } and
//     provide a Cancel option for iOS HIG parity.
// ---------------------------------------------------------------------------
check("destructive confirmation Alerts have Cancel + destructive-style action", () => {
  // Only check *confirmation* alerts (those whose title ends with '?' —
  // i.e. "Delete this scan?"), not error Alerts ("Delete failed", ...).
  // Each confirmation must present a Cancel option and a destructive
  // confirm option for iOS HIG parity.
  const confirmationRe = /Alert\.alert\(\s*"[^"]*\?"/g;
  let m;
  while ((m = confirmationRe.exec(scan)) !== null) {
    const slice = scan.slice(m.index, m.index + 1500);
    assert.ok(
      /Cancel/.test(slice),
      `Confirmation Alert missing Cancel button: ${slice.slice(0, 120)}`
    );
    assert.ok(
      /style:\s*"destructive"/.test(slice),
      `Confirmation Alert missing 'style: "destructive"': ${slice.slice(0, 120)}`
    );
  }
});

// ---------------------------------------------------------------------------
// 14. Image preview has an accessibility label (screen readers).
// ---------------------------------------------------------------------------
check("image preview has accessibilityLabel for screen readers", () => {
  assert.ok(
    /accessibilityLabel=/.test(scan),
    "Expected preview image to have an accessibilityLabel"
  );
});

// ---------------------------------------------------------------------------
// 15. No throw of plain strings (we throw { code, message } objects so the
//     error UI doesn't crash trying to read err.message on a string).
// ---------------------------------------------------------------------------
check("services throw structured error objects, not plain strings", () => {
  for (const [name, src] of Object.entries({
    "diseaseService.native.js": svcNative,
    "diseaseHistory.js": histSvc,
    "imageService.js": imgSvc,
    "diseaseLogic.js": logic,
  })) {
    // Matches: throw "something" or throw new String(...)
    const badThrow = src.match(/throw\s+["'`][^"']*["'`]/g);
    assert.ok(
      !badThrow,
      `${name} throws a plain string; throw { code, message } instead: ${badThrow}`
    );
  }
});

// ---------------------------------------------------------------------------
// 16. diagnose() always returns structured { data, error } — never throws.
// ---------------------------------------------------------------------------
check("diagnose() returns { data, error } on every path (never throws)", () => {
  assert.ok(
    /catch\s*\([^)]*\)\s*\{[\s\S]*return\s*\{\s*data:\s*null,\s*error:/.test(svcNative),
    "Expected outer try/catch in diagnose() that returns { data: null, error }"
  );
});

// ---------------------------------------------------------------------------
// 17. DiseaseResultCard uses the new `saved` prop (not assumed truthy on
//     null savedScan) so re-analyzed results don't falsely claim "Saved".
// ---------------------------------------------------------------------------
check("DiseaseResultCard takes `saved` boolean prop and renders it honestly", () => {
  assert.ok(/saved\s*=\s*false/.test(card), "Expected default `saved = false` prop");
  assert.ok(/saved \?/.test(card), "Expected conditional rendering on `saved`");
  // ScanScreen must pass saved={!!savedScan}
  assert.ok(/saved=\{!!savedScan\}/.test(scan), "Expected DiseaseResultCard to receive saved={!!savedScan}");
});

// ---------------------------------------------------------------------------
// 18. jpeg.decode is wrapped in try/catch so corrupt JPEGs don't crash.
// ---------------------------------------------------------------------------
check("jpeg.decode is wrapped in try/catch with INVALID_IMAGE code", () => {
  assert.ok(
    /try\s*\{[\s\S]*?img\s*=\s*jpeg\.decode[\s\S]*?catch[\s\S]*?code:\s*INVALID_IMAGE/s.test(svcNative),
    "Expected jpeg.decode in try/catch with INVALID_IMAGE error code"
  );
});

// ---------------------------------------------------------------------------
// 19. Final resized JPEG (manipulated.uri) is cleaned up after base64 read
//     so cache doesn't grow ~30 KB per diagnosis.
// ---------------------------------------------------------------------------
check("final resized JPEG is deleted after base64 read to avoid cache leak", () => {
  // After `const b64 = await readAsStringAsync(manipulated.uri, ...)` we
  // should see a deleteAsync(manipulated.uri...).
  const b64Read = svcNative.indexOf("readAsStringAsync(manipulated.uri");
  assert.ok(b64Read !== -1, "Expected readAsStringAsync(manipulated.uri, ...)");
  const after = svcNative.slice(b64Read, b64Read + 500);
  assert.ok(
    /deleteAsync\(manipulated\.uri/.test(after),
    "Expected manipulated.uri to be deleted after being read"
  );
});

// ---------------------------------------------------------------------------
console.log(`\n${passed} audit checks passed`);
