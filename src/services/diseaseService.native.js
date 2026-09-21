import { Platform } from "react-native";
import { loadTensorflowModel } from "react-native-fast-tflite";
import * as ImageManipulator from "expo-image-manipulator";
// SDK 54 deprecated readAsStringAsync; import from /legacy to avoid the warning.
// Only readAsStringAsync comes from /legacy — all other file ops use the main
// expo-file-system module, which exports copyAsync, cacheDirectory, etc.
import { readAsStringAsync } from "expo-file-system/legacy";
import * as FileSystem from "expo-file-system";
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
/** Error code returned when inference or preprocessing exceeds its budget. */
export const INFERENCE_TIMEOUT = "INFERENCE_TIMEOUT";
/** Error code returned for images that can't be decoded / are invalid. */
export const INVALID_IMAGE = "INVALID_IMAGE";

/**
 * Inference + preprocessing timeout (ms). On a real mid-range Android device
 * inference is ~1-2 s; on an x86_64 AVD it can take 5-10 s. We set a generous
 * ceiling so we never hang the UI forever if something goes wrong with the
 * native module.
 */
const INFERENCE_TIMEOUT_MS = 30_000;

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
 * Eagerly start loading the model (e.g. on screen mount) so it's warm by the
 * time the user taps "Analyze". Safe to call multiple times; subsequent calls
 * are no-ops once loading has started.
 */
export const preloadModel = () => {
  if (!isModelReady() || Platform.OS === "web") return;
  // Silently kick off the load; errors surface when diagnose() is called.
  loadModel().catch(() => {});
};

/**
 * Verifies the loaded TFLite tensor contract matches labels.json.
 * A mismatch means the .tflite and labels.json are out of sync — fail fast.
 *
 * @param {Object} model - Loaded TFLite model handle
 * @throws {Error} on contract mismatch
 */
const validateModelContract = (model) => {
  const input = model.inputs[0];
  const output = model.outputs[0];
  const { shape } = input;
  const [, h, w, c] = modelMeta.input_shape; // [batch, height, width, channels]

  if (shape[0] !== 1) {
    throw new Error(
      `Model contract mismatch: expected batch size 1, got ${shape[0]}.`
    );
  }
  if (shape[1] !== h || shape[2] !== w || shape[3] !== c) {
    throw new Error(
      `Model contract mismatch: TFLite input is [${shape.join(",")}] ` +
        `but labels.json declares [1,${h},${w},${c}]. Re-run the Colab pipeline.`
    );
  }

  // Dynamic-range quantized models still expose a float32 input tensor
  // (only weights are int8; activations/inputs remain float32). If the
  // input is uint8 or int8 the preprocessing logic below will feed the
  // wrong range and silently produce garbage predictions.
  if (input.dataType && input.dataType !== "float32") {
    throw new Error(
      `Model contract mismatch: TFLite input dtype is "${input.dataType}" but ` +
        `preprocessing produces float32 (raw_0_255). Re-run the Colab pipeline with ` +
        `a float32-input model or update preprocessing.`
    );
  }

  const outDim = output.shape[output.shape.length - 1];
  if (outDim !== modelMeta.classes.length) {
    throw new Error(
      `Model contract mismatch: TFLite has ${outDim} outputs but labels.json declares ${modelMeta.classes.length} classes.`
    );
  }
  if (output.dataType && output.dataType !== "float32") {
    console.warn(
      `[diseaseService] TFLite output dtype is "${output.dataType}" (expected float32); ` +
        `softmax probabilities may not be directly interpretable.`
    );
  }
};

// ---------------------------------------------------------------------------
// Image preprocessing
// ---------------------------------------------------------------------------

/**
 * Lightweight image-quality heuristic over a decoded RGBA pixel buffer.
 *
 * Returns flags for problems that will cause the model to produce garbage
 * (too dark, too bright, low contrast). These are the most common user
 * mistakes when photographing a leaf. We deliberately keep this cheap
 * (single pass over pixels, no FFT/blur detection) because it runs on the
 * JS thread on every diagnose.
 *
 * @param {Uint8Array|Buffer} rgba - RGBA pixel data (width*height*4 bytes)
 * @param {number} width
 * @param {number} height
 * @returns {{ tooDark: boolean, tooBright: boolean, lowContrast: boolean, meanLuma: number, stdLuma: number }}
 */
const assessImageQuality = (rgba, width, height) => {
  // Sample at most ~20k pixels to bound cost on large buffers.
  const n = width * height;
  const stride = Math.max(1, Math.floor(n / 20000));
  let sum = 0;
  let count = 0;
  const lumas = [];
  for (let i = 0; i < n; i += stride) {
    const j = i * 4;
    const r = rgba[j];
    const g = rgba[j + 1];
    const b = rgba[j + 2];
    // Rec. 601 luma
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    lumas.push(y);
    sum += y;
    count++;
  }
  const mean = sum / count;
  let varSum = 0;
  for (const y of lumas) {
    const d = y - mean;
    varSum += d * d;
  }
  const std = Math.sqrt(varSum / count);
  return {
    tooDark: mean < 35,
    tooBright: mean > 235,
    // Standard deviation below ~18 means the image is essentially a solid
    // color (blank wall, sky, inside of a pocket, etc.). Threshold tuned
    // against synthetic solid-color test images that produced near-uniform
    // softmax outputs.
    lowContrast: std < 18,
    meanLuma: mean,
    stdLuma: std,
  };
};

/**
 * Android scoped-storage guard.
 *
 * On recent Android, content:// and /sdcard/Download URIs returned by the
 * photo picker may not be directly readable by expo-image-manipulator or
 * expo-file-system's readAsStringAsync. To be safe, copy any non-app-local
 * URI into the app's cache directory first. URIs already inside
 * cacheDirectory or documentDirectory are returned unchanged.
 *
 * @param {string} uri - Local file URI (file:// or content://)
 * @returns {Promise<string>} URI safe to pass to ImageManipulator / readAsStringAsync
 */
const ensureAppLocalUri = async (uri) => {
  if (!uri || typeof uri !== "string") return uri;
  // Already app-local — fast path.
  const cacheDir = FileSystem.cacheDirectory || "";
  const docDir = FileSystem.documentDirectory || "";
  if (uri.startsWith(cacheDir) || uri.startsWith(docDir)) {
    return uri;
  }
  // content:// URIs from the photo picker or /sdcard/... paths: copy to cache.
  try {
    const ext = (uri.split(".").pop() || "jpg").split("?")[0].toLowerCase();
    const safeExt = ["jpg", "jpeg", "png", "webp", "heic"].includes(ext) ? ext : "jpg";
    const dest = `${cacheDir}cabbage-scan-${Date.now()}.${safeExt}`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch (copyErr) {
    // If we can't copy (e.g. permission), return the original URI and let
    // downstream stages fail with a clearer error.
    console.warn("[diseaseService] copyToCache failed, using original URI:", copyErr);
    return uri;
  }
};

/**
 * Resizes the image to the model's input size and converts it to a float32
 * tensor, applying exactly the preprocessing declared in labels.json:
 *   - "raw_0_255"   : pixel values fed as-is (0–255)
 *   - "divide_255"  : pixel values / 255 (0–1)
 *   - "imagenet"    : (x / 255 - mean) / std per channel (ImageNet stats)
 *
 * The intermediate is JPEG at maximum quality (`compress: 1`). Models of
 * this class are trained on JPEG images, so high-quality JPEG resize does
 * not meaningfully affect predictions and avoids bringing in a PNG decoder
 * dependency.
 *
 * @param {string} imageUri - Local file URI of the picked image
 * @returns {Promise<Float32Array>} Row-major RGB tensor (H*W*3)
 */
export const preprocessImage = async (imageUri) => {
  const [, h, w] = modelMeta.input_shape;

  // 0. Defensive copy to app cache for scoped-storage safety (Android).
  const safeUri = await ensureAppLocalUri(imageUri);

  // 1. Native resize to exactly W×H (matches the Colab validation pipeline:
  //    PIL .resize((384, 384)) — a straight resize, no aspect cropping).
  //
  //    Two-step resize for memory safety on large camera images: first
  //    downscale to a 2x working size (768×768), then to the final 384×384.
  //    This avoids a direct 12+ MP → 384 resize that can OOM on 1.5 GB AVDs
  //    or budget phones.
  let workingUri = safeUri;
  let presizedUri = null;
  const PRESIZE = Math.max(w, h) * 2; // 768 for a 384 model
  try {
    const presized = await ImageManipulator.manipulateAsync(
      safeUri,
      [{ resize: { width: PRESIZE, height: PRESIZE } }],
      { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG }
    );
    presizedUri = presized.uri;
    workingUri = presizedUri;
  } catch (presizeErr) {
    // Fall through to direct resize on the original URI if presize fails.
    console.warn("[diseaseService] presize failed, using original:", presizeErr);
  }

  const manipulated = await ImageManipulator.manipulateAsync(
    workingUri,
    [{ resize: { width: w, height: h } }],
    { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
  );

  // Clean up the intermediate presized file — we don't need it after final resize.
  if (presizedUri && presizedUri !== safeUri) {
    FileSystem.deleteAsync(presizedUri, { idempotent: true }).catch(() => {});
  }

  // 2. Read the resized JPEG back as bytes.
  const b64 = await readAsStringAsync(manipulated.uri, {
    encoding: "base64",
  });

  // Clean up the final resized JPEG — we have the base64 in memory now and
  // don't need the on-disk copy. Leaving it would leak ~30 KB per diagnosis
  // into the cache directory.
  FileSystem.deleteAsync(manipulated.uri, { idempotent: true }).catch(() => {});

  if (!b64 || b64.length < 1024) {
    throw {
      code: INVALID_IMAGE,
      message: "The selected image could not be read (file too small or empty).",
    };
  }
  const bytes = base64ToArrayBuffer(b64);

  // 3. Pure-JS JPEG decode to RGBA.
  let img;
  try {
    img = jpeg.decode(bytes, { useTArray: true });
  } catch (decodeErr) {
    console.error("[diseaseService] JPEG decode failed:", decodeErr);
    throw {
      code: INVALID_IMAGE,
      message: "The selected image could not be decoded. Try a different photo.",
    };
  }

  if (img.width !== w || img.height !== h) {
    throw new Error(
      `Unexpected decoded size ${img.width}×${img.height}, expected ${w}×${h}`
    );
  }
  if (!img.data || img.data.length < w * h * 4) {
    throw {
      code: INVALID_IMAGE,
      message: "The selected image could not be decoded (corrupt pixel data).",
    };
  }

  // 4. Quick image-quality heuristic (cheap, runs before the expensive tensor
  //    build). Catches the most common user mistakes (too dark, solid color,
  //    blank) and surfaces a friendly message instead of a meaningless
  //    prediction.
  const quality = assessImageQuality(img.data, w, h);
  if (quality.tooDark) {
    throw {
      code: INVALID_IMAGE,
      message:
        "This photo is too dark. Move to better light and make sure the leaf is clearly visible.",
    };
  }
  if (quality.tooBright) {
    throw {
      code: INVALID_IMAGE,
      message:
        "This photo is overexposed. Move out of direct sunlight or reduce exposure and try again.",
    };
  }
  if (quality.lowContrast) {
    throw {
      code: INVALID_IMAGE,
      message:
        "This photo doesn't show enough detail. Fill the frame with a single leaf in good light.",
    };
  }

  // 5. RGBA -> RGB float32, per the declared preprocessing mode.
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
  // runSync is synchronous and blocks the JS thread while the native C++
  // inference runs. On a real device this is ~100-500 ms for a 384×384
  // EfficientNet with dynamic-range quantization; on an x86_64 AVD it can
  // be several seconds.
  const outputs = model.runSync([inputBuffer]);
  const outArray = outputs[0];
  if (!outArray) {
    throw new Error("TFLite returned no output tensor.");
  }
  return Array.from(new Float32Array(outArray));
};

// ---------------------------------------------------------------------------
// Timeout helper
// ---------------------------------------------------------------------------

/**
 * Wraps a promise with a timeout. Rejects with { code: INFERENCE_TIMEOUT } if
 * the promise doesn't settle within `ms`.
 */
const withTimeout = (promise, ms) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject({
        code: INFERENCE_TIMEOUT,
        message: `Diagnosis timed out after ${Math.round(ms / 1000)} seconds. Please try again.`,
      });
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });

// ---------------------------------------------------------------------------
// Full pipeline
// ---------------------------------------------------------------------------

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
    if (!imageUri || typeof imageUri !== "string") {
      throw {
        code: INVALID_IMAGE,
        message: "No image selected.",
      };
    }

    const tensor = await withTimeout(
      preprocessImage(imageUri),
      INFERENCE_TIMEOUT_MS
    );
    const probs = await withTimeout(
      runInference(tensor),
      INFERENCE_TIMEOUT_MS
    );

    // Sanity-check the model output shape.
    if (!Array.isArray(probs) || probs.length !== modelMeta.classes.length) {
      throw new Error(
        `Model returned ${probs?.length ?? 0} probabilities, expected ${modelMeta.classes.length}.`
      );
    }
    // Softmax outputs should sum to roughly 1.0 and be non-negative; warn if
    // the model returned something nonsensical (but don't fail).
    const sum = probs.reduce((a, b) => a + b, 0);
    if (sum < 0.5 || sum > 2.0 || probs.some((p) => Number.isNaN(p))) {
      console.warn(
        "[diseaseService] Suspicious model output (sum=",
        sum,
        ", probs=",
        probs,
        ")"
      );
    }

    const interp = interpretOutput(probs);

    // Build the top-K alternatives list (class + label + confidence) for
    // the UI to display. Users trust a diagnosis more when they can see
    // what else the model considered.
    const topPredictions = interp.predictions.map((p) => {
      const cls = modelMeta.classes[p.index];
      const adv = advisories[cls.key] || advisories.unknown;
      return {
        key: cls.key,
        label: cls.label,
        confidence: p.prob,
        severity: adv.severity,
      };
    });

    let result;
    if (interp.isUnknown) {
      // Stage 1 "not a cabbage / low confidence" state (PRD §10).
      // isCabbage is conservatively false: we could not confirm it is a
      // cabbage. Stage 2 (the cabbage gate) will replace this guess.
      const adv = advisories.unknown;
      // Provide more specific user guidance based on *why* the prediction
      // was rejected so users know exactly what to fix on the next photo.
      const reasonMessages = {
        low_confidence:
          "The model wasn't confident enough from this photo.",
        ambiguous:
          "This photo looks like it could be more than one disease.",
        high_entropy:
          "The image doesn't look like a clear cabbage leaf photo.",
      };
      result = {
        diseaseKey: "unknown",
        diseaseLabel: adv.label,
        confidence: interp.confidence,
        isCabbage: false,
        severity: "unknown",
        advisory: adv.summary,
        symptoms: adv.symptoms,
        action: adv.action,
        reason: interp.reason, // "low_confidence" | "ambiguous" | "high_entropy"
        reasonDetail: reasonMessages[interp.reason] || "",
        topPredictions,
        entropy: interp.entropyValue,
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
        reasonDetail: "",
        topPredictions,
        entropy: interp.entropyValue,
      };
    }
    result.ms = Date.now() - startedAt;
    return { data: result, error: null };
  } catch (err) {
    // Surface structured error codes so the UI can render the right message.
    if (err && err.code === MODEL_NOT_READY) {
      return { data: null, error: err };
    }
    if (err && (err.code === INFERENCE_TIMEOUT || err.code === INVALID_IMAGE)) {
      return { data: null, error: { code: err.code, message: err.message } };
    }
    // Catch-all: log for debugging, return a user-friendly message.
    console.error("[diseaseService] diagnose failed:", err);
    return {
      data: null,
      error: {
        code: "UNKNOWN",
        message:
          err?.message ||
          "Diagnosis failed. Please try again with a clearer photo.",
      },
    };
  }
};
