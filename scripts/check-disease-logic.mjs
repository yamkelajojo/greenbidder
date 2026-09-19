/**
 * Node-based checks for the pure disease-detection logic.
 * Run with: npm run check:disease
 *
 * Covers the PRD §10 Stage-1 threshold rules and the binary helpers that
 * `diseaseService.js` depends on. No React Native / Expo / Supabase needed.
 */
import assert from "node:assert/strict";
import {
  CONFIDENCE_MIN,
  AMBIGUITY_MARGIN,
  topTwo,
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

check("thresholds match PRD §10", () => {
  assert.equal(CONFIDENCE_MIN, 0.7);
  assert.equal(AMBIGUITY_MARGIN, 0.1);
});

check("topTwo ranks correctly (incl. ties keep both)", () => {
  const [first, second] = topTwo([0.1, 0.9, 0.01, 0.9]);
  assert.equal(first.prob, 0.9);
  assert.equal(second.prob, 0.9);
  assert.deepEqual([first.index, second.index].sort(), [1, 3]);
});

check("topTwo throws on < 2 classes", () => {
  assert.throws(() => topTwo([1.0]));
});

check("confident single class -> diagnosed", () => {
  const r = interpretOutput([0.1, 0.8, 0.05, 0.05]);
  assert.equal(r.isUnknown, false);
  assert.equal(r.index, 1);
  assert.equal(r.confidence, 0.8);
  assert.equal(r.reason, "ok");
});

check("top < 0.70 -> unknown (low_confidence)", () => {
  const r = interpretOutput([0.5, 0.2, 0.2, 0.1]);
  assert.equal(r.isUnknown, true);
  assert.equal(r.reason, "low_confidence");
  assert.equal(r.index, null);
  assert.equal(r.confidence, 0.5);
});

check("top exactly 0.70 with clear gap -> diagnosed (>= boundary)", () => {
  const r = interpretOutput([0.7, 0.2, 0.05, 0.05]);
  assert.equal(r.isUnknown, false);
  assert.equal(r.reason, "ok");
});

check("top-2 within 0.10 -> unknown", () => {
  const r = interpretOutput([0.69, 0.6, 0.2, 0.05, 0.2, 0.05, 0.05, 0.05]);
  assert.equal(r.isUnknown, true);
  assert.equal(r.reason, "low_confidence"); // 0.69 < 0.7 triggers first
});

check("high top but ambiguous gap -> unknown (ambiguous)", () => {
  const r = interpretOutput([0.75, 0.68, 0.2, 0.05, 0.2, 0.05, 0.05, 0.05]);
  assert.equal(r.isUnknown, true);
  assert.equal(r.reason, "ambiguous");
  assert.equal(r.index, null);
});

check("ambiguous boundary: gap exactly 0.10 is accepted", () => {
  const r = interpretOutput([0.8, 0.7, 0.2, 0.05, 0.2, 0.05, 0.05, 0.05]);
  // gap = 0.0999...? 0.8-0.7 = 0.1 (float: 0.10000000000000009) -> ok
  assert.equal(r.isUnknown, false);
});

check("accepts Float32Array input", () => {
  const r = interpretOutput(new Float32Array([0.9, 0.05, 0.03, 0.02]));
  assert.equal(r.isUnknown, false);
  assert.equal(r.index, 0);
});

check("formatConfidence", () => {
  assert.equal(formatConfidence(0.9234), "92.3%");
  assert.equal(formatConfidence(1), "100.0%");
  assert.equal(formatConfidence(NaN), "—");
});

check("custom options override defaults", () => {
  const r = interpretOutput([0.5, 0.3, 0.2], { minConfidence: 0.4 });
  assert.equal(r.isUnknown, false);
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
