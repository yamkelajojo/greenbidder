# CabbageGuard model assets

This directory bundles the on-device disease-detection model with the app.

| File | Status | Source |
|---|---|---|
| `cabbageguard.tflite` | **PLACEHOLDER** (valid TFLite, 8 output classes, no learned weights) | Replaced by the real conversion artifact |
| `labels.json` | **PLACEHOLDER** (schema-correct, `model_not_ready: true`) | Replaced by the Colab output |
| `advisories.json` | Ready | PRD §9, verbatim |

## When the model is not ready

While `labels.json` contains `"model_not_ready": true`, the Diagnose tab shows a
setup screen instead of diagnosing. Nothing else in the app is affected.

## How the real files are produced

1. Run the notebook `docs/cabbage-feature/colab/cabbageguard-to-tflite.ipynb`
   in Google Colab (upload `final.keras` in cell 2).
   Or run `python docs/cabbage-feature/colab/cabbageguard_to_tflite.py final.keras`
   on any machine with TensorFlow 2.15+.
2. Download the three deliverables: `cabbageguard.tflite`, `labels.json`,
   `MODEL_NOTES.md`.
3. Copy `cabbageguard.tflite` and `labels.json` into this directory, overwriting
   the placeholders. Copy `MODEL_NOTES.md` to `docs/cabbage-feature/MODEL_NOTES.md`.
4. Rebuild the native app (`npx expo run:android` / `eas build`).

No code changes are required — `diseaseService.js` reads the input shape,
preprocessing mode, and class order from `labels.json` at runtime and validates
the TFLite tensor contract against it before the first inference.
