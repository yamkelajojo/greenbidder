# PROGRESS — Cabbage Disease Detection feature

Branch: `arena/01a0bae4-greenbidder` (fresh branch from `main` @ 732fdcd —
main and all other branches are untouched). The PRD's
`feature/cabbage-disease-detection` name is unavailable because this Arena
session is bound to the branch above.

Legend: ✅ done · 🚧 in progress · ⛔ blocked (external input needed) · ⏳ deferred

## Task list (PRD §12)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Inspect repo → `REPO_NOTES.md` | ✅ | See `REPO_NOTES.md` — SDK 54, RN 0.81.5, React Navigation v7, Supabase, plain-RN screens + theme tokens |
| 2 | Create feature branch | ✅ | Session-bound branch (see note above) |
| 3 | `expo prebuild`, native folders per repo convention | 🚧 | **Repo `.gitignore` already ignores `/android` + `/ios`** → repo convention = managed workflow → native folders are NOT committed. Prebuild still required on the dev machine before running the app (see "Build runbook" below) |
| 4 | Colab: obtain + inspect model (§6.1–6.2) | ⛔ | Pipeline built + tested on a synthetic model. **Blocked on `final.keras`** (not downloadable from this sandbox: no public "CabbageGuard" repo found, `huggingface.co` network-blocked) |
| 5 | Colab: convert + validate (§6.3–6.4) | ⛔ | Same block; conversion + Keras/TFLite validation code verified end-to-end on a synthetic model |
| 6 | Colab: deliverables (§6.5–6.6) | ⛔ | Same block; `labels.json`/`MODEL_NOTES.md` emitters verified |
| 7 | Supabase: table, bucket, RLS (§7) | ✅ (code) | `database/migrations/002_disease_scans.sql` — idempotent, must be run in the Supabase SQL editor (no Supabase credentials exist in this sandbox) |
| 8 | Dependencies + Metro `.tflite` assets (§8.1, §8.4) | ✅ | `react-native-fast-tflite@3.0.1`, `react-native-nitro-modules@0.37.1`, `expo-image-manipulator@~14.0.8` (exact SDK 54 version), `jpeg-js` (pure-JS decode — no extra native CV dep). `metro.config.js` adds `tflite` to `assetExts` |
| 9 | `diseaseService` (§8.2) — native/web split + shared history module | ✅ | All methods: loadModel (lazy+cached+contract-validated), preprocessImage, runInference, interpretOutput (in `utils/diseaseLogic.js`), diagnose, saveScan, getScanHistory (paginated), deleteScan, clearAllScans |
| 10 | Screen + components (§8.2) | ✅ | `src/screens/disease/{DiseaseScanScreen,DiseaseResultCard,ScanHistoryItem}.jsx` (repo uses area folders, not `src/components/`) |
| 11 | Bottom tab (§8.3) | ✅ | 5th tab "Diagnose" (Stethoscope icon) inserted between Prices and Listings; existing tabs unchanged |
| 12 | `advisories.json` (§9) | ✅ | Verbatim text, + severity for color coding |
| 13 | Stage-1 not-a-cabbage (§10) | ✅ | 0.70 confidence floor + 0.10 top-2 margin in `src/utils/diseaseLogic.js`; pure + node-tested |
| 14 | **MVP milestone on Android** | ⛔ | Needs: (a) real model artifact (task 4–6), (b) Supabase migration run (task 7), (c) prebuild + Android device or lightweight AVD, (d) real cabbage photos across ≥3 disease classes + healthy |
| 15 | EAS Build (dev profile, Android) + release test | 🚧 | `eas.json` added (development/preview/production). Builds run on the user's machine (EAS cloud) — commands in "Build runbook" |
| 16 | Stage-2 cabbage gate | ⏳ | Deferred per PRD until MVP validated. Hook point documented in `diseaseService.diagnose` |
| 17 | Re-validate end-to-end, mark complete | ⏳ | After 14 + 15 |

## Acceptance criteria status (PRD §13)

| Criterion | Status |
|---|---|
| Diagnose tab + pick/photo | ✅ built (runtime check pending device) |
| On-device, offline, <~2 s | ✅ architecture (CPU delegate; GPU delegate flagged as a speed-up option) |
| Diseased → correct class + advisory + color-coded card | ⛔ pending real model |
| Healthy → "Healthy" | ⛔ pending real model |
| Non-cabbage / low-confidence → retake state (Stage 1) | ✅ implemented (threshold logic unit-tested) |
| Every scan saved to history | ✅ implemented (pending Supabase migration run) |
| Delete individual + clear all | ✅ implemented (storage-first deletion order per §7.3) |
| Valuation/listing flows unaffected | ✅ no changes to any existing screen/service; only additive files + one tab + one stack |
| Works in a release build | 🚧 `react-native-fast-tflite` v3.0.1 includes the res/raw release-asset fix (#193); needs the real EAS release test |

## Build runbook (for the dev machine — Windows, 8 GB RAM)

```bash
# 0. Get the real model first (docs/cabbage-feature/colab/) and copy
#    cabbageguard.tflite + labels.json into src/models/ (overwrite placeholders)

# 1. Run the database migration: Supabase Dashboard → SQL Editor →
#    paste database/migrations/002_disease_scans.sql → Run

# 2. Prebuild (generates android/ locally; gitignored by repo convention)
npx expo prebuild

# 3. Dev build on a physical Android device (USB debugging on):
npx expo run:android

# 4. Or via EAS (development profile = debug APK dev client):
npm i -g eas-cli
eas login
eas build --profile development --platform android

# 5. Release (preview) build for the PRD "release build" acceptance check:
eas build --profile preview --platform android
```

Notes:
- Expo Go can no longer be used for this feature (native module) — the app
  still runs in Expo Go for everything else: the Diagnose tab shows the
  model-not-ready / setup state instead of crashing.
- 8 GB RAM: prefer a physical Android phone; if using the emulator, a
  low-RAM (2 GB), no-Play AVD while Metro runs.

## Verification done in this sandbox

- `node --check` on every new/changed JS file
- `scripts/check-disease-logic.js` — pure-logic unit tests (thresholds,
  ambiguity, top-2, base64 round-trip, tensor math) — all pass
- `npx expo export` — full Metro production bundle succeeds (proves all
  imports/asset requires resolve, including the `.tflite` asset)
- Colab pipeline script run end-to-end on a synthetic EfficientNet-style
  model: class-order stop ✔, preprocessing stop ✔, quantized conversion ✔,
  Keras/TFLite top-1 validation ✔, `labels.json`/`MODEL_NOTES.md` output ✔
- Placeholder TFLite verified: input [1,384,384,3] f32 → output [1,8] f32,
  1.6 KB, random-init (outputs near-uniform → always "unknown" if ever run)

## Open questions for the user (blocking the model milestone)

1. **Where is `final.keras`?** Hugging Face repo URL, or upload the file.
   (No public "CabbageGuard" repo is findable from this sandbox.)
2. **Class order** — from the training notebook/model card, if not shipped
   in a `class_names.json` sidecar.
3. **Android device** available for the MVP milestone, or emulator?
