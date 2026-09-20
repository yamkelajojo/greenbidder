/**
 * Model-artifact contract gate for CabbageGuard.
 *
 * This mirrors the checks `diseaseService.native.js` performs at runtime
 * (see `validateModelContract` there) so a stale placeholder model, a
 * misordered labels file, or a preprocessing mismatch fails FAST in CI /
 * before a build — not on the user's phone mid-diagnosis.
 *
 * Run with: npm run check:model
 *
 * No React Native / TFLite / Supabase needed — pure Node over the JSON files
 * and the bundled .tflite file header.
 */
import assert from "node:assert/strict";
import { readFileSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const models = join(root, "src", "models");
const tflitePath = join(models, "cabbageguard.tflite");
const labelsPath = join(models, "labels.json");
const advisoriesPath = join(models, "advisories.json");

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  \u2713 ${name}`);
  } catch (err) {
    console.error(`  \u2717 ${name}\n    ${err.message}`);
    process.exitCode = 1;
  }
}

console.log("CabbageGuard model artifact contract");

check("model files exist", () => {
  for (const p of [tflitePath, labelsPath, advisoriesPath]) {
    assert.ok(existsSync(p), `missing ${p}`);
  }
});

check("tflite is the REAL model, not the 8.6 MB placeholder", () => {
  const size = statSync(tflitePath).size;
  // Placeholder was ~8.6 MB; the real dynamic-range CabbageGuard model is
  // ~22 MB. The 0x00..0x1F header check catches a zero-filled stub.
  assert.ok(size > 12_000_000, `tflite is only ${size} bytes -- placeholder?`);
  const head = readFileSync(tflitePath).subarray(0, 32);
  assert.ok(
    !head.every((b) => b === 0),
    "tflite has all-zero header (stub/empty bundle)"
  );
});

const labels = JSON.parse(readFileSync(labelsPath, "utf8"));
const advisories = JSON.parse(readFileSync(advisoriesPath, "utf8"));

check("labels.json declares the real model (no model_not_ready)", () => {
  assert.notEqual(labels.model_not_ready, true, "isModelReady() would report a placeholder");
});

check("labels.json input is 1x384x384x3", () => {
  assert.deepEqual(labels.input_shape, [1, 384, 384, 3]);
});

check("labels.json preprocessing is raw_0_255", () => {
  assert.equal(labels.preprocessing, "raw_0_255");
});

check("labels.json has exactly 8 classes in order", () => {
  assert.equal(labels.classes.length, 8);
  assert.deepEqual(
    labels.classes.map((c) => c.key),
    [
      "alternaria_leaf_spot",
      "bacterial_leaf_spot",
      "black_rot",
      "clubroot",
      "downy_mildew",
      "grey_mould",
      "healthy",
      "ringspot",
    ]
  );
});

check("every class has a matching advisory", () => {
  for (const cls of labels.classes) {
    assert.ok(
      advisories[cls.key],
      `no advisory for class "${cls.key}"`
    );
  }
});

check("class indexes match the PRD order", () => {
  labels.classes.forEach((cls, i) => {
    assert.equal(cls.index, i, `class ${cls.key} index ${cls.index} != ${i}`);
  });
});

console.log(`\n${passed} artifact checks passed${process.exitCode ? " (WITH FAILURES)" : ""}`);
