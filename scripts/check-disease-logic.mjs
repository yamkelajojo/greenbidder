/**
 * Node-based checks for the pure disease-detection logic.
 * Run with: npm run check:disease
 *
 * Covers the PRD §10 Stage-1 threshold rules, entropy OOD detection,
 * top-K predictions, and the binary helpers that `diseaseService.js`
 * depends on. No React Native / Expo / Supabase needed.
 */
import assert from "node:assert/strict";
import {
  CONFIDENCE_MIN,
  AMBIGUITY_MARGIN,
  ENTROPY_MAX,
  topK,
  topTwo,
  entropy,
  interpretOutput,
  formatConfidence,
} from "../src/utils/diseaseLogic.js";
import {
  base64ToArrayBuffer,
  arrayBufferToBase64,
} from "../src/utils/binaryUtils.js";

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}\n    ${err.message}`);
    process.exitCode = 1;
  }
}

console.log("diseaseLogic.js");

check("thresholds match deployment targets (0.5 / 0.15 / 1.85)", () => {
  assert.equal(CONFIDENCE_MIN, 0.5);
  assert.equal(AMBIGUITY_MARGIN, 0.15);
  assert.equal(ENTROPY_MAX, 1.85);
});

check("topK returns top-K in descending order", () => {
  const probs = [0.1, 0.5, 0.05, 0.3, 0.05];
  const top3 = topK(probs, 3);
  assert.equal(top3.length, 3);
  assert.equal(top3[0].index, 1);
  assert.equal(top3[0].prob, 0.5);
  assert.equal(top3[1].index, 3);
  assert.equal(top3[1].prob, 0.3);
  assert.equal(top3[2].index, 0);
  assert.equal(top3[2].prob, 0.1);
});

check("topK with k larger than array returns all elements", () => {
  const probs = [0.6, 0.4];
  const top5 = topK(probs, 5);
  assert.equal(top5.length, 2);
});

check("topK throws on empty array", () => {
  assert.throws(() => topK([]));
});

check("topTwo still works (backwards compat)", () => {
  const [first, second] = topTwo([0.1, 0.9, 0.01, 0.9]);
  assert.equal(first.prob, 0.9);
  assert.equal(second.prob, 0.9);
  assert.deepEqual([first.index, second.index].sort(), [1, 3]);
});

check("topTwo throws on < 2 classes", () => {
  assert.throws(() => topTwo([1.0]));
});

check("entropy of a certain distribution (one-hot) is 0", () => {
  const probs = [1, 0, 0, 0, 0, 0, 0, 0];
  assert.ok(entropy(probs) < 1e-10);
});

check("entropy of uniform 8-class distribution is ln(8) ≈ 2.079", () => {
  const u = 1 / 8;
  const probs = new Array(8).fill(u);
  const expected = Math.log(8);
  assert.ok(Math.abs(entropy(probs) - expected) < 1e-6);
});

check("entropy of two-way tie is ln(2) ≈ 0.693", () => {
  const probs = [0.5, 0.5, 0, 0, 0, 0, 0, 0];
  assert.ok(Math.abs(entropy(probs) - Math.log(2)) < 1e-6);
});

check("high-entropy near-uniform distribution -> unknown (high_entropy)", () => {
  const probs = new Array(8).fill(1 / 8);
  const r = interpretOutput(probs);
  assert.equal(r.isUnknown, true);
  // 1/8 = 0.125, well below 0.5, so reason could be either low_confidence or high_entropy.
  // entropy ln(8)≈2.08 > ENTROPY_MAX 1.6 AND first.prob 0.125 < minConfidence+0.1=0.6
  // => high_entropy triggers first.
  assert.equal(r.reason, "high_entropy");
  assert.ok(r.entropyValue > 1.6);
  assert.equal(r.predictions.length, 3);
});

check("confident single class -> diagnosed", () => {
  const r = interpretOutput([0.05, 0.7, 0.05, 0.05, 0.05, 0.05, 0.03, 0.02]);
  assert.equal(r.isUnknown, false);
  assert.equal(r.index, 1);
  assert.equal(r.confidence, 0.7);
  assert.equal(r.reason, "ok");
  assert.equal(r.predictions.length, 3);
  assert.equal(r.predictions[0].index, 1);
});

check("top < 0.50 -> unknown (low_confidence)", () => {
  const r = interpretOutput([0.45, 0.2, 0.15, 0.1, 0.05, 0.03, 0.01, 0.01]);
  assert.equal(r.isUnknown, true);
  assert.equal(r.reason, "low_confidence");
  assert.equal(r.index, null);
  assert.equal(r.confidence, 0.45);
});

check("top exactly 0.50 with clear gap -> diagnosed (>= boundary)", () => {
  // 0.5 top, 0.2 runner-up, rest small -> gap = 0.3 > 0.15, top >= 0.5, entropy low
  const r = interpretOutput([0.5, 0.2, 0.1, 0.08, 0.05, 0.03, 0.02, 0.02]);
  assert.equal(r.isUnknown, false);
  assert.equal(r.reason, "ok");
});

check("high top but narrow gap -> unknown (ambiguous)", () => {
  // 0.6 vs 0.5 => gap 0.1 < 0.15
  const r = interpretOutput([0.6, 0.5, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02]);
  assert.equal(r.isUnknown, true);
  assert.equal(r.reason, "ambiguous");
  assert.equal(r.index, null);
});

check("ambiguity boundary: gap exactly AMBIGUITY_MARGIN is accepted", () => {
  // 0.65 - 0.5 = 0.15 exactly
  const r = interpretOutput([0.65, 0.5, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02]);
  assert.equal(r.isUnknown, false);
});

check("accepts Float32Array input", () => {
  const r = interpretOutput(new Float32Array([0.9, 0.05, 0.01, 0.01, 0.01, 0.01, 0.005, 0.005]));
  assert.equal(r.isUnknown, false);
  assert.equal(r.index, 0);
});

check("formatConfidence", () => {
  assert.equal(formatConfidence(0.9234), "92.3%");
  assert.equal(formatConfidence(1), "100.0%");
  assert.equal(formatConfidence(NaN), "—");
  assert.equal(formatConfidence(null), "—");
  assert.equal(formatConfidence(undefined), "—");
});

check("custom options override defaults", () => {
  // Strong single-class prediction with relaxed threshold should pass
  const r = interpretOutput([0.45, 0.2, 0.1, 0.1, 0.05, 0.05, 0.03, 0.02], {
    minConfidence: 0.4,
  });
  assert.equal(r.isUnknown, false);
});

check("predictions array exposes full sorted top-K for UI", () => {
  const probs = [0.05, 0.6, 0.2, 0.1, 0.02, 0.01, 0.01, 0.01];
  const r = interpretOutput(probs);
  assert.equal(r.predictions.length, 3);
  assert.equal(r.predictions[0].index, 1);
  assert.equal(r.predictions[0].prob, 0.6);
  assert.equal(r.predictions[1].index, 2);
  assert.equal(r.predictions[2].index, 3);
});

console.log("binaryUtils.js");

check("base64 round-trips all byte values", () => {
  const data = new Uint8Array(256);
  for (let i = 0; i < 256; i++) data[i] = i;
  const b64 = arrayBufferToBase64(data);
  const back = new Uint8Array(base64ToArrayBuffer(b64));
  assert.deepEqual(back, data);
});

check("base64 decodes known vectors", () => {
  assert.equal(
    new Uint8Array(base64ToArrayBuffer("aGVsbG8="))[0],
    0x68,
    "'h'"
  );
  const bytes = new Uint8Array(base64ToArrayBuffer("SGVsbG8sIHdvcmxkIQ=="));
  assert.equal(
    Buffer.from(bytes).toString("utf8"),
    "Hello, world!"
  );
});

check("base64 tolerates newlines/whitespace and missing padding", () => {
  const withNewline = "TWFu\naGF0"; // "Manhat" without padding
  const bytes = new Uint8Array(base64ToArrayBuffer(withNewline));
  assert.equal(Buffer.from(bytes).toString("utf8"), "Manhat");
});

check("base64 rejects garbage", () => {
  assert.throws(() => base64ToArrayBuffer("not base64!!!"));
  assert.throws(() => base64ToArrayBuffer(42));
});

console.log(`\n${passed} checks passed${process.exitCode ? " (WITH FAILURES)" : ""}`);
