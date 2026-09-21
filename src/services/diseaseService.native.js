import { Platform } from "react-native";
import { loadTensorflowModel } from "react-native-fast-tflite";
import * as ImageManipulator from "expo-image-manipulator";
import { readAsStringAsync } from "expo-file-system/legacy";
import jpeg from "jpeg-js";
import { interpretOutput } from "../utils/diseaseLogic";
import { base64ToArrayBuffer } from "../utils/binaryUtils";
import advisories from "../models/advisories.json";
import modelMeta from "../models/labels.json";

// Re-export the platform-agnostic history operations (supabase-js only).
export {
  getScanImageUrl,
  saveScan,
  getScanHistory,
  deleteScan,
  clearAllScans,
} from "./diseaseHistory";

/**
 * Disease service (native) — CabbageGuard on-device inference + scan history.
 *
 * Metro resolves this file on Android/iOS (`diseaseService.native.js`);
 * the web build resolves `diseaseService.web.js` instead, because the
 * TFLite native module is unavailable there.
 *
 * Components call these functions, never TFLite / Supabase directly.
 * Criterion 2 — Service Layer.
 *
 * Pipeline per PRD §4 / §8.2:
 *   1. Preprocess image to the model's input size (384×384 RGB by default)
 *   2. Cabbage gate (Stage 2 — not yet implemented, see PRD §10)
 *   3. CabbageGuard TFLite inference (on-device, no server round-trip)
 *   4. Confidence threshold (Stage 1 — see utils/diseaseLogic.js)
 *   5. Map to label + advisory
 *
 * The model contract (input shape, preprocessing mode, class order) is read
 * from `src/models/labels.json` at runtime — it is NOT hardcoded here, so
 * the Colab-produced artifact can be dropped in without code changes.
 */

/** Error code returned when the bundled model is still the placeholder
 *  (or, on web, when inference is unavailable). */
export const MODEL_NOT_READY = "MODEL_NOT_READY";

// ---------------------------------------------------------------------------
// Model loading
// ---------------------------------------------------------------------------

let modelPromise = null;

/**
 * True when the real CabbageGuard model has been bundled (i.e.
 * `labels.json` was replaced with the Colab-produced file).
 * @returns {boolean}
 */
export const isModelReady = () => modelMeta.model_not_ready !== true;

/**
 * The model contract as declared in labels.json (input shape, preprocessing,
 * class order). Exposed for UI/tests — never trust anything else.
 */
export const getModelMeta = () => modelMeta;

/**
 * Lazily loads the TFLite model and caches the handle.
 *
 * Rejected with `{ code: MODEL_NOT_READY }` while the placeholder model is
 * still bundled, so screens can show a setup state instead of a crash.
 * A failed load clears the cache, so the next call retries.
 *
 * @returns {Promise<Object>} The loaded TFLite model handle
 */
export const loadModel = () => {
  if (Platform.OS === "web") {
    return Promise.reject({
      code: MODEL_NOT_READY,
      message: "On-device inference is only available in native builds.",
    });
  }
  if (modelMeta.model_not_ready === true) {
    return Promise.reject({
      code: MODEL_NOT_READY,
      message:
        "The CabbageGuard model has not been bundled yet. Run the Colab pipeline in docs/cabbage-feature/colab and drop cabbageguard.tflite + labels.json into src/models/.",
    });
  }
  if (!modelPromise) {
    modelPromise = loadTensorflowModel(require("../models/cabbageguard.tflite"), [])
      .then((model) => {
        validateModelContract(model);
        return model;
      })
      .catch((err) => {
        modelPromise = null;
        throw err;
      });
  }
  return modelPromise;
};

/**
 * Verifies the loaded TFLite tensor contract matches labels.json.
 * A mismatch means the .tflite and labels.json are out of sync — fail fast.
 *
 * @param {Object} model - Loaded TFLite model handle
 * @throws {Error} on contract mismatch
 */
const validateModelContract = (model) => {
  const { shape } = model.inputs[0];
  const [, h, w, c] = modelMeta.input_shape; // [batch, height, width, channels]
  if (shape[1] !== h || shape[2] !== w || shape[3] !== c) {
    throw new Error(
      `Model contract mismatch: TFLite input is [1,${shape[1]},${shape[2]},${shape[3]}] ` +
        `but labels.json declares [1,${h},${w},${c}]. Re-run the Colab pipeline.`
    );
  }
  const outDim = model.outputs[0].shape[model.outputs[0].shape.length - 1];
  if (outDim !== modelMeta.classes.length) {
    throw new Error(
      `Model contract mismatch: TFLite has ${outDim} outputs but labels.json declares ${modelMeta.classes.length} classes.`
    );
  }
};

// ---------------------------------------------------------------------------
// Inference
// ---------------------------------------------------------------------------

/**
 * Resizes the image to the model's input size and converts it to a float32
 * tensor, applying exactly the preprocessing declared in labels.json:
 *   - "raw_0_255"   : pixel values fed as-is (0–255)
 *   - "divide_255"  : pixel values / 255 (0–1)
 *   - "imagenet"    : (x / 255 - mean) / std per channel (ImageNet stats)
 *
 * @param {string} imageUri - Local file URI of the picked image
 * @returns {Promise<Float32Array>} Row-major RGB tensor (H*W*3)
 */
export const preprocessImage = async (imageUri) => {
  const [, h, w] = modelMeta.input_shape;

  // 1. Native resize to exactly W×H (matches the Colab validation pipeline:
  //    PIL .resize((384, 384)) — a straight resize, no aspect cropping).
  const manipulated = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: w, height: h } }],
    { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
  );

  // 2. Read the resized JPEG back as bytes.
  const b64 = await readAsStringAsync(manipulated.uri, {
    encoding: "base64",
  });
  const bytes = base64ToArrayBuffer(b64);

  // 3. Pure-JS JPEG decode to RGBA.
  const img = jpeg.decode(bytes, { useTArray: true });
  if (img.width !== w || img.height !== h) {
    throw new Error(
      `Unexpected decoded size ${img.width}×${img.height}, expected ${w}×${h}`
    );
  }

  // 4. RGBA -> RGB float32, per the declared preprocessing mode.
  const out = new Float32Array(w * h * 3);
  const rgba = img.data;
  const mode = modelMeta.preprocessing;

  for (let i = 0, j = 0; i < w * h; i++, j += 4) {
    const r = rgba[j];
    const g = rgba[j + 1];
    const b = rgba[j + 2];
    switch (mode) {
      case "raw_0_255":
        out[i * 3] = r;
        out[i * 3 + 1] = g;
        out[i * 3 + 2] = b;
        break;
      case "divide_255":
        out[i * 3] = r / 255;
        out[i * 3 + 1] = g / 255;
        out[i * 3 + 2] = b / 255;
        break;
      case "imagenet":
        // ImageNet normalization used by torchvision/EfficientNet variants.
        out[i * 3] = (r / 255 - 0.485) / 0.229;
        out[i * 3 + 1] = (g / 255 - 0.456) / 0.224;
        out[i * 3 + 2] = (b / 255 - 0.406) / 0.225;
        break;
      default:
        throw new Error(
          `Unsupported preprocessing mode in labels.json: "${mode}" ` +
            "(expected raw_0_255, divide_255, or imagenet)"
        );
    }
  }
  return out;
};

/**
 * Runs the TFLite model on a preprocessed tensor.
 *
 * @param {Float32Array} tensor - Output of `preprocessImage`
 * @returns {Promise<number[]>} Raw softmax probabilities (length = class count)
 */
export const runInference = async (tensor) => {
  const model = await loadModel();
  // Slice a fresh ArrayBuffer — the native side may hold the buffer.
  const inputBuffer = tensor.buffer.slice(
    tensor.byteOffset,
    tensor.byteOffset + tensor.byteLength
  );
  const outputs = model.runSync([inputBuffer]);
  return Array.from(new Float32Array(outputs[0]));
};

/**
 * Full diagnosis pipeline: preprocess -> infer -> interpret -> advisory.
 *
 * @param {string} imageUri - Local file URI of the picked image
 * @returns {Promise<{data: Object|null, error: Object|null}>}
 *   data: {
 *     diseaseKey, diseaseLabel, confidence, isCabbage, severity,
 *     advisory, symptoms, action, reason, ms
 *   }
 */
export const diagnose = async (imageUri) => {
  const startedAt = Date.now();
  try {
    const tensor = await preprocessImage(imageUri);
    const probs = await runInference(tensor);
    const interp = interpretOutput(probs);

    let result;
    if (interp.isUnknown) {
      // Stage 1 "not a cabbage / low confidence" state (PRD §10).
      // isCabbage is conservatively false: we could not confirm it is a
      // cabbage. Stage 2 (the cabbage gate) will replace this guess.
      const adv = advisories.unknown;
      result = {
        diseaseKey: "unknown",
        diseaseLabel: adv.label,
        confidence: interp.confidence,
        isCabbage: false,
        severity: "unknown",
        advisory: adv.summary,
        symptoms: adv.symptoms,
        action: adv.action,
        reason: interp.reason, // "low_confidence" | "ambiguous"
      };
    } else {
      const cls = modelMeta.classes[interp.index];
      const adv = advisories[cls.key] || advisories.unknown;
      result = {
        diseaseKey: cls.key,
        diseaseLabel: cls.label,
        confidence: interp.confidence,
        isCabbage: true,
        severity: adv.severity, // "healthy" | "moderate" | "severe"
        advisory: adv.summary,
        symptoms: adv.symptoms,
        action: adv.action,
        reason: "ok",
      };
    }
    result.ms = Date.now() - startedAt;
    return { data: result, error: null };
  } catch (err) {
    if (err && err.code === MODEL_NOT_READY) {
      return { data: null, error: err };
    }
    return {
      data: null,
      error: { message: err?.message || "Diagnosis failed. Please try again." },
    };
  }
};
