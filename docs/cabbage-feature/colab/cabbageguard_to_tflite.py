# ============================================================
# CabbageGuard: final.keras -> cabbageguard.tflite
# GreenBidder model pipeline (PRD §6)
#
# Works in Google Colab (paste this whole file into one cell, or run
# `python cabbageguard_to_tflite.py final.keras --classes ...`) and in any
# local environment with TensorFlow 2.15+.
#
# Hard rules implemented here (PRD §5 / mandate #5):
#   * Class order is NEVER guessed. It is recovered from a sidecar
#     (class_names.json) or given explicitly via --classes. If neither is
#     available, the script STOPS and tells you what to do.
#   * Preprocessing is determined empirically (layer inspection + input
#     range probe), documented in MODEL_NOTES.md, and can be overridden
#     with --preprocessing when the probe is inconclusive.
#   * The TFLite output is validated against the Keras model on sample
#     images: top-1 classes must match on every sample or the script fails.
#
# Deliverables (written next to the input .keras file):
#   cabbageguard.tflite   — the mobile model
#   labels.json           — the exact app contract (drop into src/models/)
#   MODEL_NOTES.md        — documented contract + validation log
# ============================================================

import argparse
import json
import os
import sys

import numpy as np

try:
    import tensorflow as tf
except ImportError:
    sys.exit(
        "TensorFlow is not installed. In Colab run:\n"
        "  !pip install -q tensorflow==2.16.1 pillow numpy\n"
        "locally: pip install 'tensorflow-cpu>=2.15' pillow numpy"
    )

from PIL import Image

EXPECTED_CLASS_KEYS = [
    "alternaria_leaf_spot",
    "bacterial_leaf_spot",
    "black_rot",
    "clubroot",
    "downy_mildew",
    "grey_mould",
    "healthy",
    "ringspot",
]

IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


def die(msg):
    sys.exit("\n" + "=" * 60 + f"\nSTOP: {msg}\n" + "=" * 60 + "\n")


# ----------------------------------------------------------------------
# 1. Load the Keras model (with fallbacks)
# ----------------------------------------------------------------------
def load_model(path):
    attempts = [
        dict(),
        dict(compile=False),
        dict(compile=False, safe_mode=False),
    ]
    last_err = None
    for kwargs in attempts:
        try:
            return tf.keras.models.load_model(path, **kwargs)
        except Exception as e:  # noqa: BLE001 — try next fallback
            last_err = e
    die(f"Could not load {path!r} with any strategy. Last error:\n{last_err}")


# ----------------------------------------------------------------------
# 2. Class order (NEVER guessed)
# ----------------------------------------------------------------------
def resolve_class_order(model, keras_dir, cli_classes):
    n_out = model.output_shape[-1]

    def fail():
        die(
            "Class order could not be recovered — and it will NOT be guessed "
            "(a wrong order = wrong diagnoses in production).\n\n"
            "Provide it in one of these ways:\n"
            f"  1. Write the {n_out} class names (in index order) to "
            f"{os.path.join(keras_dir, 'class_names.json')} as a JSON list, "
            "then re-run.\n"
            f"  2. Pass them via --classes \"a,b,c,...\".\n\n"
            "Where to find them: your CabbageGuard training notebook (the "
            "dataset folder order), the model card on Hugging Face, or the "
            "class list of the dataset you fine-tuned on.\n\n"
            "For reference, the order the PRD expects is:\n"
            + json.dumps(EXPECTED_CLASS_KEYS, indent=2)
        )

    if cli_classes:
        names = [s.strip() for s in cli_classes.split(",") if s.strip()]
        if len(names) != n_out:
            die(
                f"--classes has {len(names)} entries but the model has "
                f"{n_out} outputs."
            )
        print(f"Class order from --classes: {names}")
        return names

    sidecar = os.path.join(keras_dir, "class_names.json")
    if os.path.exists(sidecar):
        with open(sidecar) as f:
            names = json.load(f)
        if len(names) != n_out:
            die(
                f"class_names.json has {len(names)} entries but the model "
                f"has {n_out} outputs."
            )
        print(f"Class order from {sidecar}: {names}")
        return names

    fail()


# ----------------------------------------------------------------------
# 3. Preprocessing determination (empirical, documented)
# ----------------------------------------------------------------------
def inspect_preprocessing(model):
    """Inspect the model for built-in preprocessing layers and probe the
    first transform with a known-value input. Returns a dict describing the
    finding."""
    findings = {
        "internal_layers": [],
        "first_layer_range": None,
        "mode": None,
        "confidence": "low",
        "notes": [],
    }

    # 3a. Look for explicit preprocessing layers near the front.
    for i, layer in enumerate(model.layers[:5], start=0):
        lname = layer.name.lower()
        ltype = type(layer).__name__.lower()
        is_prep = (
            "rescal" in ltype or "normal" in ltype or "normal" in lname
            or "rescal" in lname
        )
        if is_prep:
            try:
                cfg = layer.get_config()
            except Exception:  # noqa: BLE001
                cfg = None
            findings["internal_layers"].append(
                {"index": i, "name": layer.name, "type": type(layer).__name__, "config": cfg}
            )

    # 3b. Probe: feed raw 255.0 and observe the range after layer 1.
    try:
        input_shape = list(model.input_shape)
        probe_in = tf.constant(
            np.full((1, *input_shape[1:]), 255.0, dtype=np.float32)
        )
        probe = tf.keras.Model(inputs=model.input, outputs=model.layers[1].output)
        out = probe(probe_in).numpy().ravel()
        findings["first_layer_range"] = {
            "min": float(out.min()),
            "max": float(out.max()),
        }
    except Exception as e:  # noqa: BLE001
        findings["notes"].append(f"range probe failed: {e}")

    # 3c. Decide.
    min_v = findings["first_layer_range"]["min"] if findings["first_layer_range"] else None
    max_v = findings["first_layer_range"]["max"] if findings["first_layer_range"] else None

    for found in findings["internal_layers"]:
        cfg = found["config"] or {}
        scale = None
        offset = None
        if "scale" in cfg and isinstance(cfg["scale"], (int, float)):
            scale = float(cfg["scale"])
        if "offset" in cfg and isinstance(cfg["offset"], (int, float, list)):
            offset = cfg["offset"]
        if scale == 1.0 / 255.0:
            findings["mode"] = "raw_0_255"
            findings["confidence"] = "high"
            findings["notes"].append(
                f"Found {found['name']} rescaling by 1/255 -> model normalises "
                "internally. App must feed raw [0,255]."
            )
            return findings
        if scale == 1.0 / 127.5 and offset == -1.0:
            findings["mode"] = "raw_0_255"
            findings["confidence"] = "high"
            findings["notes"].append(
                f"Found {found['name']} (x/127.5 - 1) -> model expects raw "
                "[0,255]."
            )
            return findings
        if "mean" in cfg and "std" in cfg:
            findings["mode"] = "raw_0_255"
            findings["confidence"] = "high"
            findings["notes"].append(
                f"Found {found['name']} with mean/std -> ImageNet-style "
                "normalisation baked in. App must feed raw [0,255]."
            )
            return findings

    if min_v is not None:
        if max_v <= 1.0 and min_v >= -1.01:
            # Something already scaled the input down.
            findings["mode"] = "raw_0_255"
            findings["confidence"] = "medium"
            findings["notes"].append(
                f"First layer maps raw-255 input into "
                f"[{min_v:.3f}, {max_v:.3f}] -> scaling happens inside the "
                "model. App feeds raw [0,255]."
            )
            return findings
        if max_v >= 100:
            findings["mode"] = None  # inconclusive — needs a decision
            findings["confidence"] = "low"
            findings["notes"].append(
                "No preprocessing layer found and the first layer leaves "
                "values in the [0,255] range: the model expects "
                "pre-normalised input. Decide via --preprocessing "
                "(divide_255 | imagenet) and verify on sample images."
            )
            return findings

    findings["notes"].append(
        "Inconclusive probe. Decide via --preprocessing and verify on "
        "sample images."
    )
    return findings


def apply_preprocessing(arr, mode):
    """arr: uint8 HWC. Returns float32 HWC ready for the model."""
    if mode == "raw_0_255":
        return arr.astype(np.float32)
    if mode == "divide_255":
        return arr.astype(np.float32) / 255.0
    if mode == "imagenet":
        x = arr.astype(np.float32) / 255.0
        return (x - IMAGENET_MEAN) / IMAGENET_STD
    die(f"Unknown preprocessing mode: {mode!r}")


# ----------------------------------------------------------------------
# 4. Convert to TFLite (with fallbacks)
# ----------------------------------------------------------------------
def convert(model, out_path):
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    try:
        tflite_model = converter.convert()
        quant = "dynamic-range"
    except Exception as e:  # noqa: BLE001
        print(f"Quantized conversion failed ({e}); retrying without quantization...")
        converter2 = tf.lite.TFLiteConverter.from_keras_model(model)
        try:
            tflite_model = converter2.convert()
            quant = "none"
        except Exception:  # noqa: BLE001
            print("Retrying via SavedModel...")
            model.save("/tmp/cabbageguard_saved")
            converter3 = tf.lite.TFLiteConverter.from_saved_model(
                "/tmp/cabbageguard_saved"
            )
            converter3.optimizations = [tf.lite.Optimize.DEFAULT]
            tflite_model = converter3.convert()
            quant = "dynamic-range (via saved_model)"

    with open(out_path, "wb") as f:
        f.write(tflite_model)
    print(f"Wrote {out_path} ({os.path.getsize(out_path) / 1e6:.2f} MB, {quant})")
    return quant


# ----------------------------------------------------------------------
# 5. Validate TFLite vs Keras (do not skip)
# ----------------------------------------------------------------------
def validate(model, tflite_path, test_dir, mode, class_names):
    interpreter = tf.lite.Interpreter(model_path=tflite_path)
    interpreter.allocate_tensors()
    inp = interpreter.get_input_details()[0]
    out = interpreter.get_output_details()[0]
    print(f"TFLite input : {inp['shape']} {inp['dtype']}")
    print(f"TFLite output: {out['shape']} {out['dtype']}")

    if test_dir is None or not os.path.isdir(test_dir):
        print(
            "\nWARNING: no test images directory given (--tests). "
            "Skipping Keras/TFLite agreement check — do this before "
            "shipping (5-10 images, ideally one per class)."
        )
        return None

    files = sorted(
        f
        for f in os.listdir(test_dir)
        if f.lower().endswith((".jpg", ".jpeg", ".png"))
    )
    if not files:
        die(f"No images found in {test_dir}")

    h, w = model.input_shape[1], model.input_shape[2]
    results = []
    all_match = True
    for fname in files:
        img = Image.open(os.path.join(test_dir, fname)).convert("RGB")
        arr = np.asarray(img.resize((w, h)))
        tensor = apply_preprocessing(arr, mode)[None, ...]

        k = model.predict(tensor, verbose=0)[0]
        interpreter.set_tensor(inp["index"], tensor.astype(inp["dtype"]))
        interpreter.invoke()
        t = interpreter.get_tensor(out["index"])[0]

        k_cls = int(np.argmax(k))
        t_cls = int(np.argmax(t))
        match = k_cls == t_cls
        all_match &= match
        results.append(
            {
                "file": fname,
                "keras": class_names[k_cls],
                "tflite": class_names[t_cls],
                "match": match,
                "keras_conf": round(float(np.max(k)), 4),
                "tflite_conf": round(float(np.max(t)), 4),
            }
        )
        print(
            f"{fname}: Keras={class_names[k_cls]}({np.max(k):.3f}) "
            f"TFLite={class_names[t_cls]}({np.max(t):.3f}) "
            f"{'MATCH' if match else 'MISMATCH'}"
        )

    if not all_match:
        die(
            "Top-1 MISMATCH between Keras and TFLite — the preprocessing or "
            "conversion is wrong. Fix before proceeding (PRD §6.4)."
        )
    print(f"\nAll {len(results)} samples: top-1 class matches Keras. ✔")
    return results


# ----------------------------------------------------------------------
# 6. Emit deliverables
# ----------------------------------------------------------------------
def emit(labels_path, notes_path, tflite_path, model, class_names, mode,
         quant, validation, findings, keras_path):
    input_shape = list(model.input_shape)
    batch = 1 if input_shape[0] in (None, -1) else int(input_shape[0])
    labels = {
        "input_shape": [batch, int(input_shape[1]), int(input_shape[2]), int(input_shape[3])],
        "preprocessing": mode,
        "classes": [
            {"index": i, "key": k, "label": k.replace("_", " ").title()}
            for i, k in enumerate(class_names)
        ],
    }
    with open(labels_path, "w") as f:
        json.dump(labels, f, indent=2)
    print(f"Wrote {labels_path}")

    notes = f"""# CabbageGuard — TFLite Conversion Notes (GreenBidder)

- Source model: `{os.path.basename(keras_path)}`
- Architecture: `{model.name}` ({sum(int(p.shape.num_elements()) for p in model.weights):,} params)
- Input shape: {labels['input_shape']} (batch, height, width, channels — float32)
- Output shape: {model.output_shape} (softmax over {len(class_names)} classes)
- Preprocessing: **{mode}**
- Quantization: {quant}
- TFLite size: {os.path.getsize(tflite_path) / 1e6:.2f} MB

## Preprocessing findings (empirical)
{json.dumps(findings, indent=2, default=str)}

## Class order (index -> key)
{json.dumps([{'index': i, 'key': k} for i, k in enumerate(class_names)], indent=2)}

## Validation (Keras vs TFLite top-1)
{json.dumps(validation, indent=2) if validation else 'NOT RUN — run on 5-10 sample images before shipping (PRD §6.4).'}

## Deployment contract for the app
1. Resize the image to {int(input_shape[1])}x{int(input_shape[2])} (straight resize, no crop — matches this script's `Image.resize`).
2. Convert to RGB float32.
3. Preprocessing: {mode}
   - `raw_0_255`  -> feed pixel values 0-255 as-is
   - `divide_255` -> divide pixel values by 255
   - `imagenet`   -> (x/255 - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
4. Run the TFLite interpreter. Output is a length-{len(class_names)} softmax.
5. argmax -> index into the class order above.

## Installing into GreenBidder
Copy `cabbageguard.tflite` and `labels.json` into `src/models/`
(overwriting the placeholders) and rebuild the native app. No code changes
needed — the app reads this contract at runtime and validates the TFLite
tensors against it on load.
"""
    with open(notes_path, "w") as f:
        f.write(notes)
    print(f"Wrote {notes_path}")
    print("\nDone. Deliverables ready to copy into src/models/ .")


# ----------------------------------------------------------------------
# main
# ----------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("model", help="Path to final.keras")
    ap.add_argument("--classes", default=None,
                    help='Comma-separated class keys in index order, e.g. '
                         '"alternaria_leaf_spot,bacterial_leaf_spot,..."')
    ap.add_argument("--preprocessing", default=None,
                    choices=["raw_0_255", "divide_255", "imagenet"],
                    help="Override the empirical preprocessing decision")
    ap.add_argument("--tests", default=None,
                    help="Directory of sample images for Keras/TFLite validation")
    ap.add_argument("--out", default="cabbageguard.tflite")
    args = ap.parse_args()

    if not os.path.exists(args.model):
        die(f"Model not found at {args.model!r}. Upload final.keras first "
            "(Colab: use the file-upload widget in the notebook).")
    keras_dir = os.path.dirname(os.path.abspath(args.model))
    out_path = os.path.join(keras_dir, args.out)

    print(f"TensorFlow {tf.__version__} | model: {args.model} "
          f"({os.path.getsize(args.model) / 1e6:.2f} MB)")

    model = load_model(args.model)
    model.summary()
    print(f"\nInput shape : {model.input_shape}")
    print(f"Output shape: {model.output_shape}")
    print(f"Num classes : {model.output_shape[-1]}")

    class_names = resolve_class_order(
        model, keras_dir, args.classes
    )

    findings = inspect_preprocessing(model)
    print("\nPreprocessing findings:")
    print(json.dumps(findings, indent=2, default=str))

    if args.preprocessing:
        mode = args.preprocessing
        findings["notes"].append(f"preprocessing overridden by --preprocessing={mode}")
    elif findings["mode"] is None:
        die(
            "Preprocessing could not be determined automatically. "
            "Re-run with --preprocessing divide_255|imagenet|raw_0_255 after "
            "checking how the model was trained (see the findings above)."
        )
    else:
        mode = findings["mode"]
    print(f"\nUsing preprocessing mode: {mode} (confidence: {findings['confidence']})")

    quant = convert(model, out_path)
    validation = validate(model, out_path, args.tests, mode, class_names)
    emit(
        labels_path=os.path.join(keras_dir, "labels.json"),
        notes_path=os.path.join(keras_dir, "MODEL_NOTES.md"),
        tflite_path=out_path,
        model=model,
        class_names=class_names,
        mode=mode,
        quant=quant,
        validation=validation,
        findings=findings,
        keras_path=args.model,
    )


if __name__ == "__main__":
    main()
