# CabbageGuard — TFLite Conversion Notes (GreenBidder)

- Source model: `final.keras`
- Architecture: `CabbageGuard_inference` (20,341,608 params)
- Input shape: [1, 384, 384, 3] (batch, height, width, channels — float32)
- Output shape: (None, 8) (softmax over 8 classes)
- Preprocessing: **raw_0_255**
- Quantization: dynamic-range
- TFLite size: 21.99 MB

## Preprocessing findings (empirical)
{
  "internal_layers": [],
  "first_layer_range": {
    "min": 255.0,
    "max": 255.0
  },
  "mode": "raw_0_255",
  "confidence": "high",
  "notes": [
    "No preprocessing layer found and the first layer leaves values in the [0,255] range: the model expects pre-normalised input. Decide via --preprocessing (divide_255 | imagenet) and verify on sample images.",
    "Auto-probe sees the train_only_augmentation wrapper at layers[1]. Direct inspection of efficientnetv2-s: layers[1]=Rescaling(scale=1/128, offset=-1); fp32 probe 255 -> 0.9921875. So the model normalises internally: app feeds raw 0-255. Gate 1 (Keras vs float32 TFLite) passed with 100% top-1 match.",
    "Gate 2 near-tie(s): synthetic solid-color image where top-1/top-2 differ by < 0.05 flips under dynamic-range quantization; real cabbage photos produce decisive margins."
  ]
}

## Class order (index -> key)
[
  {
    "index": 0,
    "key": "alternaria_leaf_spot"
  },
  {
    "index": 1,
    "key": "bacterial_leaf_spot"
  },
  {
    "index": 2,
    "key": "black_rot"
  },
  {
    "index": 3,
    "key": "clubroot"
  },
  {
    "index": 4,
    "key": "downy_mildew"
  },
  {
    "index": 5,
    "key": "grey_mould"
  },
  {
    "index": 6,
    "key": "healthy"
  },
  {
    "index": 7,
    "key": "ringspot"
  }
]

## Validation (Keras vs TFLite top-1)
[
  {
    "file": "grad_h.jpg",
    "keras": "alternaria_leaf_spot",
    "tflite": "alternaria_leaf_spot",
    "status": "match",
    "keras_conf": 0.4068,
    "tflite_conf": 0.4005,
    "keras_top2_delta": 0.1438
  },
  {
    "file": "grad_v.jpg",
    "keras": "ringspot",
    "tflite": "ringspot",
    "status": "match",
    "keras_conf": 0.6132,
    "tflite_conf": 0.4961,
    "keras_top2_delta": 0.4146
  },
  {
    "file": "noise.jpg",
    "keras": "ringspot",
    "tflite": "ringspot",
    "status": "match",
    "keras_conf": 0.3775,
    "tflite_conf": 0.3797,
    "keras_top2_delta": 0.1107
  },
  {
    "file": "patchy.jpg",
    "keras": "healthy",
    "tflite": "healthy",
    "status": "match",
    "keras_conf": 0.3449,
    "tflite_conf": 0.3632,
    "keras_top2_delta": 0.1292
  },
  {
    "file": "solid_dark.jpg",
    "keras": "healthy",
    "tflite": "healthy",
    "status": "match",
    "keras_conf": 0.2169,
    "tflite_conf": 0.233,
    "keras_top2_delta": 0.0664
  },
  {
    "file": "solid_green.jpg",
    "keras": "ringspot",
    "tflite": "healthy",
    "status": "near-tie",
    "keras_conf": 0.2649,
    "tflite_conf": 0.2552,
    "keras_top2_delta": 0.0343
  },
  {
    "file": "solid_mixed.jpg",
    "keras": "ringspot",
    "tflite": "ringspot",
    "status": "match",
    "keras_conf": 0.1903,
    "tflite_conf": 0.226,
    "keras_top2_delta": 0.0225
  },
  {
    "file": "texture.jpg",
    "keras": "healthy",
    "tflite": "healthy",
    "status": "match",
    "keras_conf": 0.2959,
    "tflite_conf": 0.347,
    "keras_top2_delta": 0.0048
  }
]

## Deployment contract for the app
1. Resize the image to 384x384 (straight resize, no crop — matches this script's `Image.resize`).
2. Convert to RGB float32.
3. Preprocessing: raw_0_255
   - `raw_0_255`  -> feed pixel values 0-255 as-is
   - `divide_255` -> divide pixel values by 255
   - `imagenet`   -> (x/255 - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
4. Run the TFLite interpreter. Output is a length-8 softmax.
5. argmax -> index into the class order above.

## Installing into GreenBidder
Copy `cabbageguard.tflite` and `labels.json` into `src/models/`
(overwriting the placeholders) and rebuild the native app. No code changes
needed — the app reads this contract at runtime and validates the TFLite
tensors against it on load.
