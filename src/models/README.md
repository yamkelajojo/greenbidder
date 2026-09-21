# CabbageGuard model assets

This directory bundles the on-device disease-detection model with the app.

| File | Status | Source |
|---|---|---|
| `cabbageguard.tflite` | **REAL MODEL** (EfficientNetV2-S, 8-class, dynamic-range quantized, ~22 MB) | HuggingFace `Arko007/cabbageguard-efficientnetv2-8class`, converted via `docs/cabbage-feature/colab/cabbageguard-to-tflite.ipynb` |
| `labels.json` | **REAL** (input 1×384×384×3, preprocessing `raw_0_255`, 8 classes) | Colab conversion output |
| `advisories.json` | Ready | PRD §9, verbatim |

## Model contract

The disease service reads the model's input shape, preprocessing mode, and
class order from `labels.json` at runtime and validates them against the
TFLite tensor shapes on first load. If the `.tflite` and `labels.json` are
out of sync, the first inference fails fast with a descriptive error rather
than producing garbage predictions.

Run the contract checker at any time:

```
npm run check:model
```

## How to replace the model

1. Run the notebook `docs/cabbage-feature/colab/cabbageguard-to-tflite.ipynb`
   in Google Colab (upload `final.keras`).
2. Download the three deliverables: `cabbageguard.tflite`, `labels.json`,
   `MODEL_NOTES.md`.
3. Copy `cabbageguard.tflite` and `labels.json` into this directory,
   overwriting the existing files. Copy `MODEL_NOTES.md` to
   `docs/cabbage-feature/MODEL_NOTES.md`.
4. Run `npm run check:model` to verify the new artifacts pass all contract
   checks.
5. Rebuild the native app (`eas build`) — Metro bundles `.tflite` via the
   `assetExts` extension in `metro.config.js`.

No code changes should be required when replacing the model with one that
uses the same preprocessing (`raw_0_255`) and 8-class schema. If input shape,
preprocessing, or class count/order changes, update `labels.json` and (if
necessary) `advisories.json` so the advisory keys still line up with the
class keys in order.
