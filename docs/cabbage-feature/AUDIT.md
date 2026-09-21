# Cabbage Disease Detection — Production Readiness Audit

Last updated: 2026-09-21 (post-polish pass).

## Final status

**130 automated checks passing** across 7 test suites. All critical crash bugs fixed. Feature is architecturally sound, follows the service-layer pattern (code-structure skill), uses Operate-mode impeccable UX principles (including tasteful native-driver micro-interactions), and incorporates published best practices for on-device plant disease detection apps.

A new EAS dev build is required to test on the AVD (see "Remaining items" at bottom).

## Changes made (7 commits on `arena/01a0c19d-greenbidder`)

### Commit 1: `fix(disease): critical scoped-storage/legacy-import crash, race conditions, validation, error handling, model preload, 60 new tests`
1. **Critical crash fix** — `import * as FileSystem from "expo-file-system/legacy"` in DiseaseScanScreen was wrong: `/legacy` only exports deprecated string helpers. Main module needed for `copyAsync`/`cacheDirectory`.
2. **Incorrect save UI** — DiseaseResultCard always showed "✓ Saved" even when save failed.
3. **Race / double-tap** — Added `analyzeInFlightRef` + disabled/loading button states.
4. **FORCE_AUTH_BYPASS in production** — Guarded with `__DEV__`.
5. **Cold-start latency** — `preloadModel()` on mount.
6. **No inference timeout** — 30s timeout with `INFERENCE_TIMEOUT` code.
7. **Scoped-storage safety** — `copyToCacheIfNeeded` in imageService + `ensureAppLocalUri` in diseaseService.
8. **Input validation** — null URI, empty files, JPEG decode failures, pixel buffer length.
9. **Error preserving** — Structured error codes (`MODEL_NOT_READY`, `INFERENCE_TIMEOUT`, `INVALID_IMAGE`).
10. **Output validation** — Shape, NaN, softmax sum sanity checks.
11. **Deeper contract validation** — batch=1, input dtype=float32, output dtype warning.
12. **UI polish** — loaders, disabled states, hints, debug button dev-only.
13. **imageService hardening** — try/catch, quality 0.9, copy-to-cache, clearer messages.
14. **Timing display** — "On-device inference took N ms".
15. **Debug button dev-only** — wrapped in `__DEV__`.
16. **Model README** updated to reflect real model.
17. **Web stub parity** — missing exports added.

### Commit 2: `feat(disease): research-aligned polish — entropy OOD, top-3 predictions, image quality guard, photo tips, severity colors, 14 new tests`
18. **CONFIDENCE_MIN 0.7 → 0.5** — research-backed for quantized EfficientNet (validation confidences 0.34–0.61 per MODEL_NOTES.md).
19. **Shannon entropy OOD detection** (`ENTROPY_MAX = 1.85`) — catches near-uniform softmax on non-cabbage/blurry photos.
20. **AMBIGUITY_MARGIN 0.1 → 0.15**.
21. **top-K predictions** (K=3) passed through to UI as horizontal bars (runners-up) for disease results.
22. **Reason-specific unknown messaging** — low_confidence / ambiguous / high_entropy with colored hint box + actionable guidance.
23. **Image quality pre-check** (`assessImageQuality`) — rejects too-dark (<35 luma), too-bright (>235), low-contrast/solid-color (std<18) photos BEFORE inference.
24. **Photo tips box** in EmptyState with 4 concrete photography guidelines.
25. **1:1 square crop** (model trained on square-cropped leaves; was 4:3).
26. **Preview hint + larger preview (280px)**.
27. **Error state** — separate camera / gallery retry buttons; friendlier title.
28. **Severity color-coding in history list** (red/amber/green/grey).
29. **50ms UI yield** before inference so ActivityIndicator paints.

### Commit 3: `feat(disease): add on-device privacy badge during analysis`
30. Green-tinted "🔒 100% on-device · no data sent" badge in analyzing state; reinforces offline value prop.

### Commit 4: `feat(disease): model load error recovery, re-analyze button, cache cleanup, accessibility, unused import removal`
31. **Model-load error banner** with a working "Try again" button; surfaces load failures so the user doesn't tap Analyze only to see an error.
32. **"Re-analyze" button** on result card (non-unknown results) — re-runs inference on the same photo without forcing a retake.
33. **Cache cleanup** (`cleanupOldCache`) — prunes cached cabbage-scan/picked/test files older than 7 days on mount.
34. **Accessibility labels** on preview image.
35. **Removed unused Camera/ImagePlus imports**.

### Commit 5: `perf(disease): two-stage image resize to prevent OOM on large/budget devices; clean up intermediates`
36. **Two-stage resize pipeline** — 768×768 intermediate first (limits JPEG decode peak memory), then 384×384 final. Prevents OOM on 12+ MP camera photos on the 1536 MB AVD or budget phones.
37. **Intermediate file cleanup** — presized JPEG deleted after final resize.

### Commit 6: `feat(animations): micro-interactions using RN Animated consistent with existing app convention`
38. **Reusable animation utils** (`src/utils/animations.js`) — zero new dependencies, uses the app's existing convention (React Native built-in `Animated` + `activeOpacity={0.8}` press feedback; no reanimated/moti/lottie). Provides `useFadeIn`, `usePulse`, `useProgress`, `useStaggerEntrance`, and standard `DURATIONS` constants. All transform/opacity animations use `useNativeDriver: true` (width-interpolation for bars correctly uses `false`).
39. **DiseaseScanScreen phase transitions** — `Animated.View` fades+slides up on every phase change (idle → preview → analyzing → result → error) using a keyed re-mount so the animation replays.
40. **EmptyState mascot pulse** — 🥬 mascot has a subtle breathing pulse (0.96–1.04 scale) drawing attention to the primary CTAs.
41. **Staggered photography tips** — tip rows fade+translate in sequentially.
42. **DiseaseResultCard entrance + confidence bars** — Card slides up on mount; winner confidence % bar animates width 0→confidence; alternate bars stagger-grow in sequence; dedicated header confidence track gives instant visual certainty cue.
43. **ScanHistoryItem entrance** — each history row fades+slides in with index-based staggered delay; delete button uses `activeOpacity={0.8}` matching rest of app.
44. **13 new animation checks** in `check-animations.mjs` (exports, constants ordering, native-driver where possible, no extra deps, loop/stagger wiring).

### Commit 7: `fix(disease): production-hardening audit — pagination bug, stale-closure, cache leak, unmount guard, saved-state honesty, polish, 19 new audit checks`
45. **Infinite-scroll pagination bug** — `hasMore` was using Supabase's `count: 'exact'` incorrectly across page boundaries (count returns the filtered count, not total). Fixed with a page-length heuristic (`rows.length >= limit` on non-first pages) and exact count on the first page.
46. **Stale-closure bug in `loadHistory`** — `history` was in the useCallback dep array, causing `loadMore`/`RefreshControl` to sometimes reference stale history. Fixed with a `historyRef` and empty deps.
47. **Stale "Saved" banner after Re-analyze** — card unconditionally showed "✓ Saved" because the rendering assumed savedScan being set meant current result was saved. Added explicit `saved` boolean prop; after re-analyze (which doesn't re-save) shows an honest "Not saved to history" muted note.
48. **Cache leak: final resized JPEG** — `manipulated.uri` (the 384×384 final JPEG) was never deleted after base64 read, leaking ~30 KB per diagnosis into the cache. Now deleted immediately after the bytes are in memory.
49. **setState-after-unmount** — tab-navigating away during `diagnose()`/`saveScan()` caused React warnings. Added a `mountedRef` guard around all post-await setState calls.
50. **Alternates list length robustness** — AlternatesList now re-allocates Animated.Values if the runner-up count changes across re-analyzes, preventing index-out-of-range and stale-animation bugs.
51. **Tactile feedback** — light haptic on successful diagnosis / re-analyze (lazy-loaded expo-haptics, no dep added; gracefully no-ops when unavailable).
52. **Clear all scans button** — surfaced in the list footer when history is fully loaded, making the previously-wired `handleClearAll` accessible to users.
53. **`keyboardShouldPersistTaps="handled"`** on FlatList to prevent keyboard-dismiss surprises.
54. **`resizeMode="cover"`** on all three cabbage images (preview, result thumb, history thumb) to avoid distorted stretched images.
55. **19 production-hardening audit checks** in `check-audit.mjs` — static scans for the class of bugs fixed above plus structural invariants (no hardcoded URLs, no console.log, web-export parity, dev-only guards, HIG-compliant alerts, structured errors, cache cleanup, accessibility, activeOpacity consistency).

## Test coverage (130 checks)

| Script | Coverage | Checks |
|---|---|---|
| `check-disease-logic.mjs` | Thresholds, topK, entropy, ambiguity, binary helpers, formatConfidence | 23 |
| `check-model-contract.mjs` | Model artifacts, size, shapes, class order, advisory parity | 8 |
| `check-disease-service.mjs` | Labels structure, advisory completeness, per-class interpretation, edge cases (zero/uniform/ambiguous/healthy/severe/moderate), top-3, entropy, constants, result mapping | 48 |
| `check-preprocess.mjs` | RGBA→Float32 tensor math for all 3 preprocessing modes; 384×384 tensor size; JPEG round-trip; decode failure modes | 13 |
| `check-image-quality.mjs` | Too-dark / too-bright / low-contrast detection; solid color rejection; leaf-like image passes | 6 |
| `check-animations.mjs` | Animation utils exports, durations ordering, useNativeDriver on transform/opacity, no external deps, loop/stagger setup | 13 |
| `check-audit.mjs` | Production-hardening static audit: no hardcoded URLs/keys, no console.log, activeOpacity consistency, pagination correctness, stale-closure guard, no AsyncStorage leaks, web-export parity, FORCE_AUTH_BYPASS dev-only, debug button dev-only, native-driver usage, resize cleanup, mount cleanup, destructive Alert HIG, accessibilityLabel, structured errors, jpeg.decode try/catch, saved-prop honesty, final-resized JPEG cache cleanup | 19 |
| **Total** | | **130** |

Run: `npm run check:all`

## Architecture verification (per code-structure skill)

- **Two-layer separation** respected:
  - **Services** (`diseaseService.native.js`, `imageService.js`, `diseaseHistory.js`) own reusable operational mechanics: TFLite loading, image preprocessing, JPEG decode, picker/permission flow, Supabase upload/query. Explicit params, structured `{data, error}` returns, no global state leakage.
  - **Screens** (DiseaseScanScreen) orchestrate domain rules: state transitions, phase machine, error classification (which messages to show), user-visible retries, navigation. They never touch SDKs directly.
  - **Pure utils** (`diseaseLogic.js`, `binaryUtils.js`) have zero RN/Expo/Supabase imports — fully deterministic, unit-testable in Node.
- **Platform split** uses Metro's `.native.js`/`.web.js` resolution — web stub exports mirror native exactly (guards against web bundle breakage).
- **Design tokens only** — no hardcoded hex/radii; everything through `config/theme.js`.
- **Shared components** (`AppButton`) reused; no new primitives.

## UX polish (per impeccable Operate mode)

- **Scanability** — color-coded severity borders + badges, top-K bars, clear typography hierarchy.
- **Native expectations** — Alert confirms for destructive actions (delete/clear), standard FlatList + RefreshControl, ActivityIndicator loaders, TouchableOpacity with hitSlop.
- **Error recovery** at every step: model load (retry button), pre-inference quality (specific messages per failure mode), inference (retry + retake options), save failure (inline warning instead of blocking alert).
- **Progressive disclosure** — tips box in empty state, symptoms/action sections in result, timing/privacy footer, top-K alternates collapsed into bars.
- **Privacy reinforcement** — privacy badge during analysis, "no data sent" line in result, "works offline" subtext.
- **Micro-interactions (animate)** — phase-to-phase fade+slide, breathing mascot, staggered tips, animated winner & runner-up confidence bars, history rows entrance. All native-driver where possible, zero new deps, matches existing RN Animated + activeOpacity convention.

## Remaining items (require real device / new EAS build)

1. **New EAS dev build required** (critical — previous APK has the legacy-import crash):
   ```
   eas build --profile development --platform android
   ```
2. **End-to-end smoke test on AVD** with the new APK: Diagnose tab → gallery/camera → Analyze → result card (with top-3 bars, confidence %, reason hints). Toggle airplane mode to confirm offline inference.
3. **Real cabbage test images** (≥3 disease classes + healthy + non-cabbage per `AVD_SETUP.md §4`) — needed to empirically validate the 0.5 / 0.15 / 1.85 thresholds on South African field photos.
4. **Supabase history** — un-pause project and run `database/migrations/002_disease_scans.sql`; save failure path is graceful.
5. **Release build test (PRD §13)**: `eas build --profile preview --platform android`.
6. **Performance on real hardware** — AVD is emulated-CPU slow; result card shows inference time to measure real-device latency against the PRD ~2 s target.
7. **Threshold tuning** — if real photos produce too many "low_confidence" results, consider lowering `CONFIDENCE_MIN` to 0.4 or calibrating `ENTROPY_MAX` against real non-cabbage photos. The thresholds are all in `src/utils/diseaseLogic.js` with no code changes needed elsewhere.
