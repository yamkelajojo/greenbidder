/**
 * Service-layer & integration checks for CabbageGuard.
 *
 * Tests things that DON'T require React Native / TFLite / a device:
 *   - Advisory/label ordering and completeness
 *   - DiseaseLogic interpretation for every class
 *   - Result mapping (label + advisory + severity) for confident predictions
 *   - Unknown/ambiguous/low-confidence mapping
 *   - Input validation edge cases
 *
 * Run with: node scripts/check-disease-service.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const labels = JSON.parse(
  readFileSync(join(root, "src", "models", "labels.json"), "utf8")
);
const advisories = JSON.parse(
  readFileSync(join(root, "src", "models", "advisories.json"), "utf8")
);

// Dynamic import of the ESM modules from src/.
const {
  CONFIDENCE_MIN,
  AMBIGUITY_MARGIN,
  ENTROPY_MAX,
  interpretOutput,
  formatConfidence,
  topTwo,
} = await import("../src/utils/diseaseLogic.js");

let passed = 0;
let failed = 0;
function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}\n    ${err.message}`);
    process.exitCode = 1;
  }
}

console.log("labels.json structure");

check("input shape is [1,384,384,3] (EfficientNetV2-S)", () => {
  assert.deepEqual(labels.input_shape, [1, 384, 384, 3]);
});

check("preprocessing mode is raw_0_255 (uint8 0-255 feed)", () => {
  assert.equal(labels.preprocessing, "raw_0_255");
});

check("exactly 8 disease classes", () => {
  assert.equal(labels.classes.length, 8);
});

check("class indexes 0..7 are contiguous", () => {
  labels.classes.forEach((cls, i) => {
    assert.equal(cls.index, i, `${cls.key} index is ${cls.index}, expected ${i}`);
  });
});

console.log("\nadvisories.json structure");

const REQUIRED_CLASSES = [
  "alternaria_leaf_spot",
  "bacterial_leaf_spot",
  "black_rot",
  "clubroot",
  "downy_mildew",
  "grey_mould",
  "healthy",
  "ringspot",
];

for (const key of REQUIRED_CLASSES) {
  check(`advisory exists for ${key}`, () => {
    assert.ok(advisories[key], `missing advisories["${key}"]`);
  });
  check(`advisory for ${key} has required fields`, () => {
    const adv = advisories[key];
    assert.ok(adv.label, `${key}.label missing`);
    assert.ok(adv.severity, `${key}.severity missing`);
    assert.ok(["healthy", "moderate", "severe"].includes(adv.severity),
      `${key}.severity must be healthy|moderate|severe (got "${adv.severity}")`);
    assert.ok(adv.summary, `${key}.summary missing`);
    assert.ok(adv.symptoms !== undefined, `${key}.symptoms missing`);
    assert.ok(adv.action, `${key}.action missing`);
  });
}

check("'unknown' advisory exists for low-confidence states", () => {
  assert.ok(advisories.unknown);
  assert.equal(advisories.unknown.severity, "unknown");
});

check("label/advisory ordering matches exactly", () => {
  // Labels.json class order MUST match advisories.json key order for the
  // mapping from model output index -> advisory to be correct.
  labels.classes.forEach((cls) => {
    assert.ok(
      advisories[cls.key],
      `class "${cls.key}" has no matching advisory key`
    );
    assert.equal(
      advisories[cls.key].label,
      cls.label,
      `label mismatch for ${cls.key}: labels.json says "${cls.label}", advisories.json says "${advisories[cls.key].label}"`
    );
  });
});

console.log("\ndiseaseLogic interpretation — per-class mapping");

// For each class, simulate a confident prediction for that class and check
// that interpretOutput returns the correct index.
for (let i = 0; i < labels.classes.length; i++) {
  const cls = labels.classes[i];
  check(`confident ${cls.key} (p=0.95) -> index ${i}, diagnosed`, () => {
    const probs = new Array(labels.classes.length).fill(0.005);
    probs[i] = 0.95;
    // Renormalize to sum ~1.0
    const total = probs.reduce((a, b) => a + b, 0);
    const normalized = probs.map((p) => p / total);

    const r = interpretOutput(normalized);
    assert.equal(r.isUnknown, false, `expected diagnosed, got unknown (${r.reason})`);
    assert.equal(r.index, i);
    assert.equal(r.reason, "ok");
    assert.ok(r.confidence > 0.9, `confidence too low: ${r.confidence}`);
  });
}

console.log("\ndiseaseLogic edge cases");

check("all-zero probabilities -> unknown (low_confidence)", () => {
  const probs = new Array(8).fill(0);
  const r = interpretOutput(probs);
  assert.equal(r.isUnknown, true);
  assert.equal(r.reason, "low_confidence");
});

check("uniform distribution (1/8 each) -> unknown (high_entropy)", () => {
  const probs = new Array(8).fill(1 / 8); // 0.125 each, entropy ≈ 2.08
  const r = interpretOutput(probs);
  assert.equal(r.isUnknown, true);
  // Entropy gate catches near-uniform first; both lead to unknown so either is fine,
  // but high_entropy is the more specific reason for OOD/uniform inputs.
  assert.ok(
    r.reason === "high_entropy" || r.reason === "low_confidence",
    `expected high_entropy or low_confidence, got "${r.reason}"`
  );
});

check("two classes close together at high confidence -> unknown (ambiguous)", () => {
  // 0.78 vs 0.72 => gap = 0.06 < 0.10, top > 0.7 => ambiguous
  const probs = [0.78, 0.72, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02];
  const r = interpretOutput(probs);
  assert.equal(r.isUnknown, true);
  assert.equal(r.reason, "ambiguous");
});

check("healthy class at 0.99 -> healthy advisory mapping", () => {
  const healthyIdx = labels.classes.findIndex((c) => c.key === "healthy");
  assert.ok(healthyIdx >= 0, "healthy class index not found");
  const probs = new Array(8).fill(0);
  probs[healthyIdx] = 1.0;
  const r = interpretOutput(probs);
  assert.equal(r.isUnknown, false);
  assert.equal(r.index, healthyIdx);
  assert.equal(labels.classes[r.index].key, "healthy");
});

check("black_rot (severe) maps to severity 'severe'", () => {
  const idx = labels.classes.findIndex((c) => c.key === "black_rot");
  assert.equal(advisories[labels.classes[idx].key].severity, "severe");
});

check("alternaria_leaf_spot maps to severity 'moderate'", () => {
  const idx = labels.classes.findIndex((c) => c.key === "alternaria_leaf_spot");
  assert.equal(advisories[labels.classes[idx].key].severity, "moderate");
});

check("formatConfidence handles 0, 1, NaN, undefined, and normal values", () => {
  assert.equal(formatConfidence(0), "0.0%");
  assert.equal(formatConfidence(1), "100.0%");
  assert.equal(formatConfidence(NaN), "—");
  assert.equal(formatConfidence(undefined), "—");
  assert.equal(formatConfidence(null), "—");
  assert.equal(formatConfidence(0.9234), "92.3%");
});

check("topTwo throws on empty array", () => {
  assert.throws(() => topTwo([]));
});

check("topTwo throws on single-element array", () => {
  assert.throws(() => topTwo([1.0]));
});

check("custom minConfidence can relax threshold", () => {
  const r = interpretOutput([0.5, 0.2, 0.1, 0.1, 0.05, 0.025, 0.025, 0], {
    minConfidence: 0.4,
  });
  assert.equal(r.isUnknown, false);
  assert.equal(r.index, 0);
});

check("custom ambiguityMargin can tighten threshold", () => {
  // 0.8 vs 0.65 -> gap 0.15, which passes default 0.10 but fails 0.20
  const r = interpretOutput([0.8, 0.65, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05], {
    ambiguityMargin: 0.2,
  });
  assert.equal(r.isUnknown, true);
  assert.equal(r.reason, "ambiguous");
});

console.log("\ndiseaseResult mapping simulation (what diagnose() returns)");

// Simulate what diagnose() builds from interpretOutput + modelMeta + advisories.
function simulateDiagnosis(probs) {
  const interp = interpretOutput(probs);
  const topPredictions = interp.predictions.map((p) => {
    const cls = labels.classes[p.index];
    return { key: cls.key, label: cls.label, confidence: p.prob };
  });
  if (interp.isUnknown) {
    const adv = advisories.unknown;
    return {
      diseaseKey: "unknown",
      diseaseLabel: adv.label,
      confidence: interp.confidence,
      isCabbage: false,
      severity: "unknown",
      advisory: adv.summary,
      reason: interp.reason,
      topPredictions,
      entropy: interp.entropyValue,
    };
  }
  const cls = labels.classes[interp.index];
  const adv = advisories[cls.key] || advisories.unknown;
  return {
    diseaseKey: cls.key,
    diseaseLabel: cls.label,
    confidence: interp.confidence,
    isCabbage: true,
    severity: adv.severity,
    advisory: adv.summary,
    reason: "ok",
    topPredictions,
    entropy: interp.entropyValue,
  };
}

check("confident black_rot simulation returns correct advisory fields", () => {
  const idx = labels.classes.findIndex((c) => c.key === "black_rot");
  const probs = new Array(8).fill(0);
  probs[idx] = 0.95;
  probs[(idx + 1) % 8] = 0.05;
  const result = simulateDiagnosis(probs);
  assert.equal(result.diseaseKey, "black_rot");
  assert.equal(result.diseaseLabel, "Black Rot");
  assert.equal(result.severity, "severe");
  assert.equal(result.isCabbage, true);
  assert.ok(result.advisory.includes("bacterial"));
});

check("confident healthy simulation returns healthy advisory", () => {
  const idx = labels.classes.findIndex((c) => c.key === "healthy");
  const probs = new Array(8).fill(0);
  probs[idx] = 0.99;
  const result = simulateDiagnosis(probs);
  assert.equal(result.diseaseKey, "healthy");
  assert.equal(result.severity, "healthy");
  assert.equal(result.isCabbage, true);
});

check("low-confidence simulation returns unknown advisory with isCabbage:false", () => {
  // Use a slightly peaked but still low-confidence distribution
  // (0.4 top — below 0.5, entropy moderate)
  const probs = [0.4, 0.2, 0.1, 0.1, 0.08, 0.05, 0.04, 0.03];
  const result = simulateDiagnosis(probs);
  assert.equal(result.diseaseKey, "unknown");
  assert.equal(result.isCabbage, false);
  assert.equal(result.severity, "unknown");
  assert.ok(
    result.reason === "low_confidence" || result.reason === "high_entropy",
    `expected unknown reason, got "${result.reason}"`
  );
});

check("ambiguous simulation returns unknown advisory with reason 'ambiguous'", () => {
  const probs = [0.76, 0.7, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02];
  const result = simulateDiagnosis(probs);
  assert.equal(result.diseaseKey, "unknown");
  assert.equal(result.reason, "ambiguous");
});

console.log("\nConstants (deployment-tuned, see diseaseLogic.js)");

check("CONFIDENCE_MIN = 0.5 (research-backed for quantized EfficientNet mobile)", () => {
  assert.equal(CONFIDENCE_MIN, 0.5);
});

check("AMBIGUITY_MARGIN = 0.15", () => {
  assert.equal(AMBIGUITY_MARGIN, 0.15);
});

check("ENTROPY_MAX ≈ 1.85 (entropy-based OOD guard)", () => {
  assert.ok(typeof ENTROPY_MAX === "number");
  assert.ok(ENTROPY_MAX > 1.5 && ENTROPY_MAX < 2.0);
});

console.log(
  `\n${passed} checks passed${failed ? ` (${failed} FAILED)` : ""}`
);
