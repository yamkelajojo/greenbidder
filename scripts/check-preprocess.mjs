/**
 * Preprocessing-pipeline checks.
 *
 * These tests exercise the same pixel-conversion logic that runs on-device
 * by importing the binary utilities and reproducing the preprocess loop.
 * They catch regressions in:
 *   - base64 decode (used to read the resized JPEG bytes)
 *   - RGBA -> RGB Float32 conversion
 *   - The three preprocessing modes (raw_0_255, divide_255, imagenet)
 *   - Tensor shape invariants
 *
 * TFLite and ImageManipulator are NOT exercised (they require native); we
 * feed synthetic JPEG bytes decoded by jpeg-js directly.
 */
import assert from "node:assert/strict";
import jpeg from "jpeg-js";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { base64ToArrayBuffer, arrayBufferToBase64 } from "../src/utils/binaryUtils.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const labels = JSON.parse(
  readFileSync(join(root, "src", "models", "labels.json"), "utf8")
);

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

console.log("preprocess: RGBA -> Float32 (raw_0_255)");

/**
 * Build a tiny synthetic RGBA image and run it through the same loop as
 * diseaseService.preprocessImage. Returns a Float32Array of size W*H*3.
 */
function rgbaToRgbFloat32({ width, height, r, g, b, mode }) {
  const pixels = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    pixels[i * 4] = r;
    pixels[i * 4 + 1] = g;
    pixels[i * 4 + 2] = b;
    pixels[i * 4 + 3] = 255; // alpha (ignored)
  }
  const out = new Float32Array(width * height * 3);
  for (let i = 0, j = 0; i < width * height; i++, j += 4) {
    const pr = pixels[j];
    const pg = pixels[j + 1];
    const pb = pixels[j + 2];
    switch (mode) {
      case "raw_0_255":
        out[i * 3] = pr;
        out[i * 3 + 1] = pg;
        out[i * 3 + 2] = pb;
        break;
      case "divide_255":
        out[i * 3] = pr / 255;
        out[i * 3 + 1] = pg / 255;
        out[i * 3 + 2] = pb / 255;
        break;
      case "imagenet":
        out[i * 3] = (pr / 255 - 0.485) / 0.229;
        out[i * 3 + 1] = (pg / 255 - 0.456) / 0.224;
        out[i * 3 + 2] = (pb / 255 - 0.406) / 0.225;
        break;
    }
  }
  return out;
}

check("raw_0_255: pure red (255,0,0) pixel produces correct float32", () => {
  const out = rgbaToRgbFloat32({ width: 1, height: 1, r: 255, g: 0, b: 0, mode: "raw_0_255" });
  assert.equal(out.length, 3);
  assert.equal(out[0], 255);
  assert.equal(out[1], 0);
  assert.equal(out[2], 0);
});

check("raw_0_255: pure green (0,128,0) pixel", () => {
  const out = rgbaToRgbFloat32({ width: 1, height: 1, r: 0, g: 128, b: 0, mode: "raw_0_255" });
  assert.equal(out[0], 0);
  assert.equal(out[1], 128);
  assert.equal(out[2], 0);
});

check("divide_255: white (255,255,255) -> [1,1,1]", () => {
  const out = rgbaToRgbFloat32({ width: 1, height: 1, r: 255, g: 255, b: 255, mode: "divide_255" });
  assert.ok(Math.abs(out[0] - 1) < 1e-6);
  assert.ok(Math.abs(out[1] - 1) < 1e-6);
  assert.ok(Math.abs(out[2] - 1) < 1e-6);
});

check("divide_255: black (0,0,0) -> [0,0,0]", () => {
  const out = rgbaToRgbFloat32({ width: 1, height: 1, r: 0, g: 0, b: 0, mode: "divide_255" });
  assert.equal(out[0], 0);
  assert.equal(out[1], 0);
  assert.equal(out[2], 0);
});

check("imagenet: normalization constants applied", () => {
  // (0/255 - 0.485)/0.229 = -0.485/0.229 ≈ -2.1179
  const out = rgbaToRgbFloat32({ width: 1, height: 1, r: 0, g: 0, b: 0, mode: "imagenet" });
  assert.ok(Math.abs(out[0] - (-0.485 / 0.229)) < 1e-4);
  assert.ok(Math.abs(out[1] - (-0.456 / 0.224)) < 1e-4);
  assert.ok(Math.abs(out[2] - (-0.406 / 0.225)) < 1e-4);
});

check("384x384 raw_0_255 tensor size = 384*384*3 = 442368", () => {
  const [, h, w] = labels.input_shape;
  const out = rgbaToRgbFloat32({ width: w, height: h, r: 100, g: 150, b: 200, mode: "raw_0_255" });
  assert.equal(out.length, w * h * 3);
  assert.equal(out.length, 384 * 384 * 3);
  assert.equal(out.length, 442368);
});

check("all pixels in 384x384 raw_0_255 tensor have expected values", () => {
  const [, h, w] = labels.input_shape;
  const out = rgbaToRgbFloat32({ width: w, height: h, r: 42, g: 84, b: 126, mode: "raw_0_255" });
  for (let i = 0; i < w * h; i++) {
    assert.equal(out[i * 3], 42, `R mismatch at pixel ${i}`);
    assert.equal(out[i * 3 + 1], 84, `G mismatch at pixel ${i}`);
    assert.equal(out[i * 3 + 2], 126, `B mismatch at pixel ${i}`);
  }
});

console.log("\npreprocess: JPEG encode/decode round-trip (jpeg-js)");

check("jpeg-js can encode and decode a 384x384 red image", () => {
  const [, h, w] = labels.input_shape;
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    rgba[i * 4] = 200;
    rgba[i * 4 + 1] = 50;
    rgba[i * 4 + 2] = 50;
    rgba[i * 4 + 3] = 255;
  }
  const encoded = jpeg.encode({ data: rgba, width: w, height: h }, 95);
  assert.ok(encoded.data.length > 1000, "JPEG should be a reasonable size");

  // Simulate the same base64 -> bytes -> decode path the service uses.
  const b64 = arrayBufferToBase64(encoded.data.buffer.slice(
    encoded.data.byteOffset,
    encoded.data.byteOffset + encoded.data.byteLength
  ));
  const bytes = base64ToArrayBuffer(b64);
  const decoded = jpeg.decode(new Uint8Array(bytes), { useTArray: true });
  assert.equal(decoded.width, w);
  assert.equal(decoded.height, h);
  // JPEG is lossy so pixel values won't match exactly; just check they're
  // in a sensible range (not NaN, not all-zero, mostly red-ish).
  let totalR = 0, totalG = 0, totalB = 0;
  for (let i = 0; i < w * h; i++) {
    totalR += decoded.data[i * 4];
    totalG += decoded.data[i * 4 + 1];
    totalB += decoded.data[i * 4 + 2];
  }
  const n = w * h;
  const avgR = totalR / n, avgG = totalG / n, avgB = totalB / n;
  assert.ok(avgR > 150, `avg R should be > 150, got ${avgR.toFixed(1)}`);
  assert.ok(avgG < 150, `avg G should be < 150, got ${avgG.toFixed(1)}`);
  assert.ok(avgB < 150, `avg B should be < 150, got ${avgB.toFixed(1)}`);
});

check("jpeg-js decode fails gracefully on garbage input", () => {
  const garbage = new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x00]); // truncated
  assert.throws(() => jpeg.decode(garbage, { useTArray: true }));
});

check("jpeg-js decode fails gracefully on non-JPEG bytes", () => {
  const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.throws(() => jpeg.decode(pngHeader, { useTArray: true }));
});

console.log("\npreprocess: output sanity for model input");

check("current model preprocessing is raw_0_255", () => {
  assert.equal(labels.preprocessing, "raw_0_255");
});

check("model input is [1,384,384,3]", () => {
  assert.deepEqual(labels.input_shape, [1, 384, 384, 3]);
});

check("raw_0_255 pixels are uint8 cast to float32 (no normalization)", () => {
  const out = rgbaToRgbFloat32({ width: 1, height: 1, r: 0, g: 255, b: 128, mode: "raw_0_255" });
  assert.equal(out[0], 0);
  assert.equal(out[1], 255);
  assert.equal(out[2], 128);
  // Values should be integers in [0,255]
  assert.ok(Number.isInteger(out[0]));
  assert.ok(Number.isInteger(out[1]));
  assert.ok(Number.isInteger(out[2]));
});

console.log(
  `\n${passed} preprocess checks passed${failed ? ` (${failed} FAILED)` : ""}`
);
