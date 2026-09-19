/**
 * Disease service (web) — stub for the browser build.
 *
 * Metro resolves this file on web (`diseaseService.web.js`) and
 * `diseaseService.native.js` on Android/iOS. On-device inference needs the
 * TFLite native module (react-native-fast-tflite), which is unavailable in
 * the browser — importing it on web would crash the app at module
 * evaluation, so the web build gets a graceful stub instead.
 *
 * History operations (supabase-js) work on web and are shared via
 * `diseaseHistory.js`.
 */

/** Same error code as the native service. */
export const MODEL_NOT_READY = "MODEL_NOT_READY";

export {
  getScanImageUrl,
  saveScan,
  getScanHistory,
  deleteScan,
  clearAllScans,
} from "./diseaseHistory";

/** On-device inference is not available on web. */
export const isModelReady = () => false;

export const getModelMeta = () => ({
  model_not_ready: true,
  input_shape: [1, 384, 384, 3],
  preprocessing: "raw_0_255",
  classes: [],
});

export const loadModel = () =>
  Promise.reject({
    code: MODEL_NOT_READY,
    message:
      "On-device diagnosis is not available in the web build. Use the Android or iOS app.",
  });

export const preprocessImage = () =>
  Promise.reject({
    code: MODEL_NOT_READY,
    message: "On-device diagnosis is not available in the web build.",
  });

export const runInference = () =>
  Promise.reject({
    code: MODEL_NOT_READY,
    message: "On-device diagnosis is not available in the web build.",
  });

export const diagnose = async () => ({
  data: null,
  error: {
    code: MODEL_NOT_READY,
    message:
      "On-device diagnosis is not available in the web build. Use the Android or iOS app.",
  },
});
