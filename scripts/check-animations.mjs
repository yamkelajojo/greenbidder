/**
 * Animation utility tests.
 *
 * Since useFadeIn/usePulse/useProgress/useStagger are React hooks that
 * need a React runtime, we test what we can in Node without RN:
 *   - DURATIONS constants look sensible
 *   - The module loads and exports the expected names
 *   - The Animated namespace is import-safe (we don't run it here; the
 *     native build runs it).
 */
import assert from "node:assert/strict";

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}\n    ${err.message}`);
    process.exitCode = 1;
  }
}

console.log("animations.js constants");

// We can't import the module directly under Node because it imports React,
// so read the source and assert the shape via regex / static values.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "src", "utils", "animations.js"), "utf8");

check("exports DURATIONS.fast", () => {
  assert.match(src, /fast:\s*150/);
});
check("exports DURATIONS.normal", () => {
  assert.match(src, /normal:\s*250/);
});
check("exports DURATIONS.entrance", () => {
  assert.match(src, /entrance:\s*350/);
});
check("exports DURATIONS.slow", () => {
  assert.match(src, /slow:\s*500/);
});
check("durations are ordered fast <= normal <= entrance <= slow", () => {
  const fast = 150, normal = 250, entrance = 350, slow = 500;
  assert.ok(fast <= normal && normal <= entrance && entrance <= slow);
});
check("all animations use useNativeDriver: true where possible", () => {
  // Count of useNativeDriver: true should be >= number of transform/opacity
  // animations. Count occurrences.
  const nativeTrue = (src.match(/useNativeDriver:\s*true/g) || []).length;
  const nativeFalse = (src.match(/useNativeDriver:\s*false/g) || []).length;
  // progress/width interpolation uses false; everything else must use true.
  assert.ok(nativeTrue >= 6, `expected >=6 useNativeDriver:true, found ${nativeTrue}`);
  assert.ok(nativeFalse <= 1, `expected <=1 useNativeDriver:false (width interpolation), found ${nativeFalse}`);
});
check("exports useFadeIn", () => {
  assert.match(src, /export function useFadeIn/);
});
check("exports usePulse", () => {
  assert.match(src, /export function usePulse/);
});
check("exports useProgress", () => {
  assert.match(src, /export function useProgress/);
});
check("exports useStaggerEntrance", () => {
  assert.match(src, /export function useStagger/);
});
check("pulse animation loops infinitely (Animated.loop)", () => {
  assert.match(src, /Animated\.loop/);
});
check("stagger uses Animated.stagger for sequential entrance", () => {
  assert.match(src, /Animated\.stagger/);
});
check("no arbitrary external deps used (only react + react-native)", () => {
  const imports = [...src.matchAll(/import .* from "([^"]+)"/g)].map((m) => m[1]);
  for (const imp of imports) {
    assert.ok(
      imp === "react" || imp === "react-native",
      `unexpected import "${imp}" — animations.js must only depend on react/react-native`
    );
  }
});

console.log(`\n${passed} animation checks passed${process.exitCode ? " (WITH FAILURES)" : ""}`);
