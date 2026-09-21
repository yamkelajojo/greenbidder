/**
 * Image-quality heuristic tests.
 *
 * These tests verify the dark/bright/low-contrast detection logic that
 * runs BEFORE model inference to catch obviously bad photos (blank wall,
 * pocket, overexposed sky, etc.). The heuristic is not exported from the
 * native service (it's a private helper), so we reimplement a reference
 * version here and verify its math against the stated thresholds.
 */
import assert from "node:assert/strict";

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

/** Reference implementation matching diseaseService.native.js. */
function assessImageQuality(rgba, width, height) {
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
    lowContrast: std < 18,
    meanLuma: mean,
    stdLuma: std,
  };
}

function makeImage(width, height, fn) {
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const { r, g, b } = fn(x, y);
      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = 255;
    }
  }
  return rgba;
}

console.log("image quality heuristic");

check("solid black image -> tooDark", () => {
  const img = makeImage(100, 100, () => ({ r: 0, g: 0, b: 0 }));
  const q = assessImageQuality(img, 100, 100);
  assert.equal(q.tooDark, true);
  assert.equal(q.lowContrast, true);
});

check("solid white image -> tooBright", () => {
  const img = makeImage(100, 100, () => ({ r: 255, g: 255, b: 255 }));
  const q = assessImageQuality(img, 100, 100);
  assert.equal(q.tooBright, true);
  assert.equal(q.lowContrast, true);
});

check("solid mid-grey -> lowContrast (but not dark/bright)", () => {
  const img = makeImage(100, 100, () => ({ r: 128, g: 128, b: 128 }));
  const q = assessImageQuality(img, 100, 100);
  assert.equal(q.tooDark, false);
  assert.equal(q.tooBright, false);
  assert.equal(q.lowContrast, true);
});

check("leaf-like image (green, high variation, veins/spots) -> passes all checks", () => {
  // Simulate a leaf with veins, spots, and strong variation like a real photo.
  const img = makeImage(384, 384, (x, y) => {
    const n = (Math.sin(x * 0.3) * 60 + Math.cos(y * 0.25) * 50 +
               ((x * y) % 73) * 0.5 - 40);
    return {
      r: Math.max(0, Math.min(255, 60 + n * 0.7)),
      g: Math.max(0, Math.min(255, 140 + n * 0.6)),
      b: Math.max(0, Math.min(255, 40 + n * 0.3)),
    };
  });
  const q = assessImageQuality(img, 384, 384);
  assert.equal(q.tooDark, false, `mean luma ${q.meanLuma.toFixed(1)} too dark`);
  assert.equal(q.tooBright, false);
  assert.equal(q.lowContrast, false, `std ${q.stdLuma.toFixed(1)} should be > 18`);
});

check("very dark (dim room) image -> tooDark", () => {
  const img = makeImage(200, 200, () => ({ r: 15, g: 15, b: 15 }));
  const q = assessImageQuality(img, 200, 200);
  assert.equal(q.tooDark, true);
});

check("mean luma for mid-grey (128,128,128) is ≈128", () => {
  const img = makeImage(50, 50, () => ({ r: 128, g: 128, b: 128 }));
  const q = assessImageQuality(img, 50, 50);
  assert.ok(Math.abs(q.meanLuma - 128) < 1, `expected mean ≈128, got ${q.meanLuma}`);
});

console.log(
  `\n${passed} quality checks passed${failed ? ` (${failed} FAILED)` : ""}`
);
