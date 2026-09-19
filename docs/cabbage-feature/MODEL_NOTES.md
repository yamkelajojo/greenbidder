# MODEL_NOTES — CabbageGuard (TFLite)

> **STATUS: PLACEHOLDER.** The values below are the *expected* contract from the
> PRD, NOT empirically verified values. They get replaced by the real
> `MODEL_NOTES.md` produced by the pipeline in
> `docs/cabbage-feature/colab/` once `final.keras` is converted.
>
> The app reads the *contract* from `src/models/labels.json` at runtime and
> validates the TFLite tensors against it on load — so this document and the
> Colab run are the source of truth, and they must agree.

## Pipeline (executed)

- [x] Pipeline script: `docs/cabbage-feature/colab/cabbageguard_to_tflite.py`
      (tested end-to-end on a synthetic model: class-order stop,
      preprocessing stop, conversion, Keras/TFLite validation all verified)
- [x] Colab notebook wrapper: `docs/cabbage-feature/colab/cabbageguard-to-tflite.ipynb`
- [ ] Run against the real `final.keras` — **blocked on the model artifact**
      (see "What we need" below)

## Expected contract (to be confirmed by the run)

| Property | Expected | Verified |
|---|---|---|
| Architecture | EfficientNetV2-S (fine-tuned) | — |
| Input shape | `[1, 384, 384, 3]` float32 | — |
| Output shape | `[1, 8]` float32 softmax | — |
| Preprocessing | `raw_0_255` **or** `imagenet` (must be measured, PRD §6.2) | — |
| Quantization | dynamic-range (`Optimize.DEFAULT`) | — |
| TFLite size | ~45–55 MB (float32 EfficientNetV2-S) | — |

## Class order (must come from the model's training artifacts)

| Index | Key (expected) | Verified against known image |
|---|---|---|
| 0 | alternaria_leaf_spot | — |
| 1 | bacterial_leaf_spot | — |
| 2 | black_rot | — |
| 3 | clubroot | — |
| 4 | downy_mildew | — |
| 5 | grey_mould | — |
| 6 | healthy | — |
| 7 | ringspot | — |

**Rule (PRD §6.5 / mandate #5):** if the pipeline cannot recover the class
order from the model or its sidecars, it **stops** — a guessed order is never
shipped.

## Validation (PRD §6.4 — do not skip)

- [ ] TFLite vs Keras top-1 agreement on 5–10 sample images (one per class):
      **all must match** or the run fails
- [ ] One known image per class produces the expected class in the app
- [ ] Release build loads the bundled `.tflite` (not just dev)

## What we need to finish

1. The `final.keras` artifact (its Hugging Face repo could not be located from
   this sandbox — no public "CabbageGuard" repo was found, and
   `huggingface.co` is network-blocked here). Options:
   - run the Colab notebook (upload `final.keras` there), or
   - provide the file / repo URL so the conversion can be run here.
2. The class order (from the training notebook / model card) if it is not in
   a `class_names.json` sidecar — the pipeline will ask for it and stop
   otherwise.
3. 5–10 sample cabbage images (one per class) for the validation step.

## Deployment contract implemented by the app

`src/services/diseaseService.native.js` (+ `.web.js` stub, shared `diseaseHistory.js`) (reads `src/models/labels.json` at runtime):

1. Resize image to `<input_shape[1]>×<input_shape[2]>` (straight resize —
   matches the pipeline's `Image.resize`, no aspect cropping).
2. RGB float32, row-major NHWC.
3. Preprocessing per `labels.json.preprocessing`:
   - `raw_0_255` → pixels as-is
   - `divide_255` → pixels / 255
   - `imagenet` → (x/255 − mean)/std, ImageNet stats
4. TFLite interpreter (CPU delegate, `react-native-fast-tflite`).
5. Output length-8 softmax → Stage-1 threshold logic
   (`src/utils/diseaseLogic.js`: min 0.70 confidence, 0.10 top-2 margin)
   → label + advisory from `src/models/advisories.json`.
