/**
 * Cabbage disease — pure interpretation logic.
 *
 * This module has NO React Native / Expo / Supabase imports on purpose:
 * it is plain, deterministic, unit-testable JavaScript (see
 * `scripts/check-disease-logic.js`).
 *
 * Implements PRD §10 Stage 1 ("Not a cabbage" handling, MVP) plus
 * research-backed best practices for on-device classifiers:
 *
 *   - Top-K predictions returned for transparency (top 3 by default)
 *   - Shannon-entropy based OOD (out-of-distribution) detection — catches
 *     near-uniform distributions that signal "not a cabbage leaf" more
 *     reliably than a single top-1 threshold
 *   - Top-class probability below CONFIDENCE_MIN  -> unknown
 *   - Top-2 classes within AMBIGUITY_MARGIN       -> unknown (ambiguous)
 *
 * Research consensus (50% threshold for quantized EfficientNet mobile
 * deployments; see e.g. PlantCareNet, DLEN-KLM) is that 0.5 is a more
 * appropriate floor than the initially-specified 0.7 for this model,
 * because dynamic-range quantization spreads probability mass and real
 * cabbage images in validation produce top-1 confidences of 0.34–0.61.
 *
 * Stage 2 (the cabbage gate) will plug in here as an additional
 * pre-check once that model ships; see `diseaseService.diagnose`.
 */

/** Minimum top-class probability to accept a diagnosis. */
export const CONFIDENCE_MIN = 0.5;

/** If the runner-up class is within this margin of the top class, the
 *  result is treated as ambiguous (unknown). */
export const AMBIGUITY_MARGIN = 0.15;

/** Shannon entropy threshold (in nats, natural log). A softmax over 8
 *  classes that is close to uniform (1/8 each) has entropy ln(8) ≈ 2.08.
 *  A confident prediction has entropy near 0. Values above ENTROPY_MAX
 *  indicate the model is spreading probability across many classes
 *  (typical of non-cabbage / blurry / OOD inputs) — reject as unknown. */
export const ENTROPY_MAX = 1.85;

/**
 * Returns the K highest-probability entries of a probability vector,
 * sorted highest-first.
 *
 * @param {number[]|Float32Array} probs - Length-N class probabilities
 * @param {number} [k=3] - How many to return
 * @returns {Array<{index: number, prob: number}>} Top K, highest first
 * @throws {Error} if `probs` is empty
 */
export function topK(probs, k = 3) {
  const list = Array.from(probs);
  if (list.length === 0) {
    throw new Error("topK: expected at least 1 class");
  }
  const K = Math.min(k, list.length);
  const ranked = list
    .map((prob, index) => ({ index, prob }))
    .sort((a, b) => b.prob - a.prob);
  return ranked.slice(0, K);
}

/**
 * Backwards-compatible wrapper: topTwo uses topK and preserves the
 * original contract of throwing on arrays with fewer than 2 classes.
 * @param {number[]|Float32Array} probs
 * @returns {Array<{index: number, prob: number}>}
 */
export function topTwo(probs) {
  const list = Array.from(probs);
  if (list.length < 2) {
    throw new Error("topTwo: expected at least 2 classes");
  }
  return topK(list, 2);
}

/**
 * Shannon entropy of a probability vector, in nats (base-e).
 * Higher entropy -> more uncertain / uniform distribution.
 *
 * @param {number[]|Float32Array} probs
 * @returns {number}
 */
export function entropy(probs) {
  let h = 0;
  for (const p of probs) {
    if (p > 0) {
      h -= p * Math.log(p);
    }
  }
  return h;
}

/**
 * Interprets a raw softmax output.
 *
 * @param {number[]|Float32Array} probs - Raw model output (length = class count)
 * @param {Object} [options]
 * @param {number} [options.minConfidence=CONFIDENCE_MIN]
 * @param {number} [options.ambiguityMargin=AMBIGUITY_MARGIN]
 * @param {number} [options.entropyMax=ENTROPY_MAX]
 * @param {number} [options.topK=3]
 * @returns {{
 *   isUnknown: boolean,
 *   index: (number|null),
 *   confidence: number,
 *   secondIndex: (number|null),
 *   secondProb: number,
 *   predictions: Array<{index: number, prob: number}>,
 *   entropyValue: number,
 *   reason: ("ok"|"low_confidence"|"ambiguous"|"high_entropy"),
 * }}
 */
export function interpretOutput(probs, options = {}) {
  const minConfidence = options.minConfidence ?? CONFIDENCE_MIN;
  const ambiguityMargin = options.ambiguityMargin ?? AMBIGUITY_MARGIN;
  const entropyMax = options.entropyMax ?? ENTROPY_MAX;
  const k = options.topK ?? 3;

  const ranked = topK(probs, k);
  const first = ranked[0];
  const second = ranked[1] || { index: null, prob: 0 };
  const gap = first.prob - second.prob;
  const ent = entropy(probs);

  // 1. Entropy gate first — catches "distributed over many classes" (OOD).
  //    Only triggers when top-1 is also below a reasonable level (avoids
  //    rejecting decisive predictions that happen to have some entropy).
  if (ent > entropyMax && first.prob < minConfidence + 0.1) {
    return {
      isUnknown: true,
      index: null,
      confidence: first.prob,
      secondIndex: second.index,
      secondProb: second.prob,
      predictions: ranked,
      entropyValue: ent,
      reason: "high_entropy",
    };
  }

  if (first.prob < minConfidence) {
    return {
      isUnknown: true,
      index: null,
      confidence: first.prob,
      secondIndex: second.index,
      secondProb: second.prob,
      predictions: ranked,
      entropyValue: ent,
      reason: "low_confidence",
    };
  }

  if (gap < ambiguityMargin) {
    return {
      isUnknown: true,
      index: null,
      confidence: first.prob,
      secondIndex: second.index,
      secondProb: second.prob,
      predictions: ranked,
      entropyValue: ent,
      reason: "ambiguous",
    };
  }

  return {
    isUnknown: false,
    index: first.index,
    confidence: first.prob,
    secondIndex: second.index,
    secondProb: second.prob,
    predictions: ranked,
    entropyValue: ent,
    reason: "ok",
  };
}

/**
 * Formats a 0..1 probability as a display string, e.g. "92.3%".
 * @param {number} prob
 * @returns {string}
 */
export function formatConfidence(prob) {
  if (typeof prob !== "number" || Number.isNaN(prob)) return "—";
  return `${(prob * 100).toFixed(1)}%`;
}
