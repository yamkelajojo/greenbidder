# Android emulator runbook (Windows, 8 GB RAM)

Decision (2026-09-19): MVP will be validated on a **lightweight AVD**, not a
physical phone. This doc is the full path: AVD setup → EAS dev build →
install → functional test → **EAS release build test (PRD §13 requirement)**.

All builds run in the EAS cloud — your machine only needs the Android SDK
(to run `adb`/the emulator), not a local Gradle build, which matters a lot on
8 GB RAM.

## 0. Memory budget (read first)

| Process | RAM |
|---|---|
| Windows + IDE | ~2 GB |
| AVD (configured below) | 2 GB |
| adb / misc | ~0.5 GB |
| **Headroom** | ~3 GB |

Rules while testing:
- Close Chrome/Electron apps and the IDE that doesn't need to be open.
- Build everything via `eas build` (cloud) — never `npx expo run:android`
  locally while the emulator is running (a local Gradle + Metro + AVD will
  thrash 8 GB).
- If the AVD still feels slow, drop it to 1.5 GB and a smaller screen.

## 1. Install the Android SDK (one-time)

1. Install [Android Studio](https://developer.android.com/studio) (you only
   need it for the SDK + emulator + Device Manager).
2. In Android Studio: **SDK Manager** → ensure:
   - SDK Platform **API 35** (or 34)
   - SDK Build-Tools (latest)
   - **Emulator** and **Android SDK Platform-Tools** (adb)
3. (Optional, recommended) Add to your user PATH:
   - `<Android SDK>/platform-tools` (for `adb`)
   - `<Android SDK>/emulator`
   - JDK 17 is bundled with Android Studio; EAS doesn't need a local JDK.

## 2. Create the lightweight AVD (one-time)

**Via GUI (easiest):** Android Studio → **Device Manager** → **Create Virtual
Device**:
- Hardware: **Pixel 5** (411×891 — small, fast)
- System image: **API 35, "x86_64"** image with **NO Google Play** (the plain
  image, not the "Google Play" one — saves RAM and install time)
- RAM: **2048 MB**, Storage: 8 GB, CPU cores: 2 (leave the rest to Windows)

**Or via CLI** (PowerShell, Android SDK on PATH):
```powershell
sdkmanager --list | findstr system-images        # find the "no play" x86_64 image
sdkmanager "system-images;android-35;default;x86_64"
avdmanager create avd -n gb_dev -k "system-images;android-35;default;x86_64" \
  -d pixel_5 --device pixel_5 -m 2048
```

**Before first boot:** AVD settings (pencil icon) → **Show Advanced Settings**:
- Memory → RAM **2048 MB**
- Emulated Performance → **Disable animations** (big UX win on emulators)
- GPU → **Automatic** (software if your machine stutters)

## 3. Get the app onto the emulator (EAS development build)

Prereqs: model artifacts in place (see below) + migration run (below).

```powershell
# One-time
npm i -g eas-cli
eas login

# Build the dev client (cloud build, debug APK)
eas build --profile development --platform android
```

EAS returns a download URL → download the `.apk` → with the AVD running:

```powershell
adb install -r GreenBidder-development-*.apk
adb shell am start -n com.anonymous.GreenBidder/.MainActivity
```

> First run of any EAS development build on a fresh emulator can take a
> minute or two (native module init) — give it time before judging a crash.

## 4. Feed the emulator real cabbage photos

The camera on an AVD can be mapped to your webcam, but for diagnosis testing
the **gallery** path is better (you control the exact image):

```powershell
adb push .\cabbage_test_photos\ .\ /sdcard/Pictures/cabbage/
adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE \
  -d file:///sdcard/Pictures/cabbage   # force media scan (or just wait)
```

Minimum photo set (PRD §14): **≥3 disease classes + 1 healthy**, ideally one
per class you want to prove, plus 1 deliberate non-cabbage photo (cat,
tomato, brick wall) for the "not a cabbage" state.

## 5. Functional test checklist (MVP gate, PRD §13)

On the AVD, with the model artifacts swapped in:

- [ ] Diagnose tab opens; pick from gallery → image preview
- [ ] "Analyze cabbage" → spinner → result card (on-device, airplane mode
      on — **nothing may hit the network during inference**)
- [ ] Diseased leaf → correct disease name + confidence % + advisory text +
      red/amber card
- [ ] Healthy leaf → "Healthy", green card
- [ ] Non-cabbage / blurry photo → "This doesn't look like a cabbage /
      retake" grey card (Stage 1)
- [ ] Result appears in **Scan history** (auto-saved)
- [ ] Delete one scan → gone from list, storage object removed (check
      Supabase Dashboard → Storage if curious)
- [ ] Clear all → confirm dialog → list empty
- [ ] Feed / Prices / Listings tabs work exactly as before (regression check)

**Timing expectation on the AVD:** emulator CPU is emulated (software
execution), so inference will be **much slower than a real mid-range phone**
— several seconds instead of the ~2 s target. Record the time, but treat the
PRD's "<2 s on a mid-range Android phone" acceptance as something to re-check
on real hardware whenever one is available. The AVD proves correctness, not
the latency target. (If later needed: flip
`enableAndroidGpuLibraries: true` in `app.json` for GPU-accelerated
inference.)

## 6. Release build test (PRD §13: "works in a release build")

This is the check that catches "bundled .tflite missing in release":

```powershell
eas build --profile preview --platform android
```

`preview` is an internal-distribution **release-mode** APK. Download, then:

```powershell
adb install -r GreenBidder-preview-*.apk
```

Note: a release build does NOT connect to a Metro dev server — it must be a
fully self-contained install. Repeat the short checklist: pick one diseased
photo + one healthy photo → both diagnose correctly. `react-native-fast-tflite`
v3.0.1 loads `require()`'d assets from `res/raw` in release (upstream fix
#193), so this should pass — but the PRD requires it to be *proven*.

## 7. Supabase migration (one-time, before any testing)

Supabase Dashboard → **SQL Editor** → new query → paste the full contents of
`database/migrations/002_disease_scans.sql` → **Run**.
(Verified idempotent; re-running is safe.)

## 8. Model artifacts (before step 3)

1. Colab: `docs/cabbage-feature/colab/cabbageguard-to-tflite.ipynb`
   (upload `final.keras` → run cells → watch for STOP messages → download the
   3 deliverables).
2. Copy `cabbageguard.tflite` + `labels.json` into `src/models/` (overwrite
   the placeholders) and `MODEL_NOTES.md` to `docs/cabbage-feature/`.
3. Commit, then `eas build` (EAS builds from the pushed repo — so the
   artifacts must be committed first, or use `eas build --local` semantics
   via the EAS build's "local" build option).
