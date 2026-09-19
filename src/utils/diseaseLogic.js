/**
 * Cabbage disease — pure interpretation logic.
 *
 * This module has NO React Native / Expo / Supabase imports on purpose:
 * it is plain, deterministic, unit-testable JavaScript (see
 * `scripts/check-disease-logic.js`).
 *
 * Implements PRD §10 Stage 1 ("Not a cabbage" handling, MVP):
 *   - top-class probability below CONFIDENCE_MIN  -> unknown
 *   - top-2 classes within AMBIGUITY_MARGIN       -> unknown (ambiguous)
 *
 * Stage 2 (the cabbage gate) will plug in here as an additional
 * pre-check once that model ships; see `diseaseService.diagnose`.
 */

/** Minimum top-class probability to accept a diagnosis. */
export const CONFIDENCE_MIN = 0.7;

/** If the runner-up class is within this margin of the top class, the
 *  result is treated as ambiguous (unknown). */
export const AMBIGUITY_MARGIN = 0.1;

/**
 * Returns the two highest-probability entries of a probability vector.
 * @param {number[]|Float32Array} probs - Length-N class probabilities
 * @returns {Array<{index: number, prob: number}>} Top two, highest first
 * @throws {Error} if `probs` is empty
 */
export function topTwo(probs) {
  const list = Array.from(probs);
  if (list.length < 2) {
    throw new Error("topTwo: expected at least 2 classes");
  }
  const ranked = list
    .map((prob, index) => ({ index, prob }))
    .sort((a, b) => b.prob - a.prob);
  return [ranked[0], ranked[1]];
}

/**
 * Interprets a raw softmax output.
 *
 * @param {number[]|Float32Array} probs - Raw model output (length = class count)
 * @param {Object} [options]
 * @param {number} [options.minConfidence=CONFIDENCE_MIN]
 * @param {number} [options.ambiguityMargin=AMBIGUITY_MARGIN]
 * @returns {{
 *   isUnknown: boolean,
 *   index: (number|null),
 *   confidence: number,
 *   secondIndex: (number|null),
 *   secondProb: number,
 *   reason: ("ok"|"low_confidence"|"ambiguous"),
 * }}
 */
export function interpretOutput(probs, options = {}) {
  const minConfidence = options.minConfidence ?? CONFIDENCE_MIN;
  const ambiguityMargin = options.ambiguityMargin ?? AMBIGUITY_MARGIN;

  const [first, second] = topTwo(probs);
  const gap = first.prob - second.prob;

  if (first.prob < minConfidence) {
    return {
      isUnknown: true,
      index: null,
      confidence: first.prob,
      secondIndex: second.index,
      secondProb: second.prob,
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
      reason: "ambiguous",
    };
  }

  return {
    isUnknown: false,
    index: first.index,
    confidence: first.prob,
    secondIndex: second.index,
    secondProb: second.prob,
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
