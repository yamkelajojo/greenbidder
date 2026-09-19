# REPO_NOTES — Cabbage Disease Detection (Task 1: repo inspection)

Inspected 2026-09-19 on `main` @ `732fdcd` (branch: `arena/01a0bae4-greenbidder`).

## Framework & versions

| Item | Value |
|---|---|
| Expo SDK | **54** (`expo ~54.0.33`) |
| React Native | **0.81.5** |
| React | 19.1.0 |
| New Architecture | **enabled** (`newArchEnabled: true`) |
| Language | Plain **JS/JSX** (tsconfig extends expo base but no TS files in `src/`) |

## Navigation

- **React Navigation v7** (`@react-navigation/native ^7.2.2`, bottom-tabs ^7.15.9, native-stack ^7.14.10). **Not** Expo Router.
- `src/navigation/RootNavigator.jsx`: `session ? <MainTabs/> : <AuthStack/>`
- `src/navigation/MainTabs.jsx`: 4 bottom tabs — Feed, Prices, Listings (role-aware label Create/Browse), Profile. Each tab wraps a `createNativeStackNavigator` with `headerShown: false`.
- Icons come from `@tamagui/lucide-icons-2` (verified: `Stethoscope`, `Camera`, `ImagePlus`, `Leaf`, `Trash2`, `RotateCcw`, `ScanLine` all exist in the installed version).

## Auth

- Supabase auth via `@supabase/supabase-js ^2.103.0`.
- Single client in `src/config/supabase.js` (rule: never call `createClient` elsewhere).
- `src/hooks/useAuth.js` — React context: `{ session, user, userRole, isLoading, isAuthenticated, isFarmer, isBuyer }`.
- Roles: `buyer` / `farmer` stored in `users.role` (custom table, not a Supabase role).
- Services get the current user via `supabase.auth.getSession()`.

## UI conventions

- **Screens use plain React Native** (`View`/`Text`/`TouchableOpacity`/`FlatList`/`StyleSheet`) — Tamagui is only a provider shell in `App.js`; no Tamagui primitives in screens.
- Design tokens in `src/config/theme.js` (`colors`, `spacing`, `fonts`, `radius`) — components import these, never hardcode hex (except white text on primary buttons, matching existing code).
- Reusable widgets live in `src/screens/shared/`: `AppButton.jsx` (variants: primary/outline/danger, `isLoading`), `AppInput.jsx`. **The new feature reuses `AppButton`.**
- Area folders: `src/screens/{auth,buyer,farmer,shared}` → the disease feature uses **`src/screens/disease/`** (note: PRD said `src/components/`, but the repo has no `components/` directory — area folders are the convention).
- Services: `src/services/*.js`, every function JSDoc'd, returns `{ data, error }` (or `{ data, error, hasMore }`).
- Utils: `src/utils/*.js` (e.g. `timeAgo` in `dateUtils.js`).
- Validation: `zod` schemas in `src/validators/schemas.js`.

## Supabase

- Env vars: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (in `.env`, mirrored in `.env.example`, read by `src/constants/env.js`).
- Migrations: single hand-run SQL files in `database/migrations/` (`001` = `gbdb.sql`, run in the Supabase SQL editor). → **002 added: `database/migrations/002_disease_scans.sql`** (idempotent, table + RLS + `disease-scans` public bucket + storage RLS).
- Existing storage bucket: `listing-images` (public, `getPublicUrl` pattern) — `disease-scans` follows the same convention.
- Deletion convention for listings is soft-delete (`status: archived`); disease scans are append-only history with hard delete per PRD §7.3 (storage object first, then row).

## Image handling

- `src/services/imageService.js`: `pickImage(source)` (expo-image-picker, permissions handled, `allowsEditing: true`, 4:3, quality 0.7) + `uploadListingImage` (FormData → `supabase.storage`). **`pickImage` is reused unchanged.**
- `expo-image-picker ~17.0.10`, `expo-file-system ~19.0.21` (new API — named exports like `readAsStringAsync`).
- `expo-image-manipulator` was **not** present — added at `~14.0.8` (the exact SDK 54 version from `node_modules/expo/bundledNativeModules.json`; `npx expo install` was unusable in this sandbox because `api.expo.dev` is unreachable, so the version was resolved from the bundled manifest).

## Native / build

- **`/android` and `/ios` are in `.gitignore`** ("generated native folders") → repo uses the **managed workflow** convention: native folders are generated locally with `npx expo prebuild` and **not committed**. The PRD's "commit native folders" instruction is explicitly conditional on repo convention — we follow the repo: **no native folders committed**.
- No `metro.config.js` existed → added one (only change: `assetExts += ["tflite"]`).
- No `eas.json` existed → added (development / preview / production profiles, Android-first per PRD).
- `npm run android` / `npm run ios` changed from `expo start --*` to `expo run:*` (dev builds — Expo Go can no longer run this app's native modules; accepted in PRD §3).
- `npx expo prebuild --no-install` verified in-sandbox: generates `android/` + `ios/` cleanly with the `react-native-fast-tflite` plugin applied. Autolinking verified: `react-native-fast-tflite` + `react-native-nitro-modules` resolve via RN autolinking; `expo-image-manipulator` via Expo module autolinking (same mechanism as the existing expo modules). Prebuild also wants to stamp `android.package`/`ios.bundleIdentifier` (`com.anonymous.GreenBidder`) into `app.json` on first run — intentionally **not committed** here (app-identity decision belongs to the user before EAS store builds).
- CI (`.github/workflows/ci.yml`): runs only on push to `main`/`develop`; does `npm ci --legacy-peer-deps` + `npx expo export` + required-file checks. All existing required files are untouched.

## Service layer split (web safety)

`diseaseService` is split by platform because the TFLite library registers its
native module at import time and would crash the **web** build at runtime:
- `src/services/diseaseService.native.js` — Android/iOS (inference + history)
- `src/services/diseaseService.web.js` — web stub (`MODEL_NOT_READY` state; history still works via supabase-js)
- `src/services/diseaseHistory.js` — shared Supabase scan-history operations (platform-agnostic)

Both platform bundles verified with `npx expo export` (android: tflite asset bundled; web: no native code pulled in).

## TFLite library

- **`react-native-fast-tflite@3.0.1`** (mrousavy/margelo) + peer `react-native-nitro-modules@0.37.1`.
  - v3 API: `await loadTensorflowModel(require('model.tflite'), delegates)` → model with `inputs`/`outputs` tensor descriptors and `runSync(ArrayBuffer[]): ArrayBuffer[]`.
  - New-Architecture compatible (since 1.6.0; 3.x is Nitro-based).
  - Expo config plugin: `["react-native-fast-tflite", { enableAndroidGpuLibraries: false }]` (no-op on CPU; flip to `true` later for GPU delegates).
  - **v3.0.1 includes fix #193: `require()`'d assets load from `res/raw` in Android release builds** — directly addresses PRD §11 risk "release build can't find bundled .tflite".
- Pixel pipeline (no new native CV dependency): `expo-image-manipulator` resize 384×384 → `expo-file-system` base64 read → pure-JS **`jpeg-js`** decode → Float32 tensor. Keeps the footprint to the mandated TFLite lib + standard Expo modules.
- **Model is a placeholder until the real artifact ships**: `src/models/cabbageguard.tflite` is a valid 1.6 KB TFLite with the exact contract ([1,384,384,3] → [1,8] softmax, random init) and `labels.json` carries `"model_not_ready": true`. The service shows a setup state while the placeholder is bundled and validates the tensor contract on load once the real model is dropped in.

## Env vars / secrets

- Nothing new introduced. The feature adds no API keys; inference is on-device.

## Branch note

PRD asked for branch `feature/cabbage-disease-detection`. This Arena session is bound to branch
`arena/01a0bae4-greenbidder` (fresh branch from `main`, main untouched). The work can be
renamed/rebased onto `feature/cabbage-disease-detection` by the user after merge-back.
