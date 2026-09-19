/**
 * Binary helpers — pure JavaScript (no React Native / Expo imports).
 *
 * `base64ToArrayBuffer` is implemented by hand (instead of relying on
 * `atob`) so the exact same code path runs on Hermes, JSC, and Node,
 * and can be unit-tested without a device (see
 * `scripts/check-disease-logic.js`).
 */

const B64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

let b64Lookup = null;
function getB64Lookup() {
  if (!b64Lookup) {
    b64Lookup = new Int8Array(256).fill(-1);
    for (let i = 0; i < B64_ALPHABET.length; i++) {
      b64Lookup[B64_ALPHABET.charCodeAt(i)] = i;
    }
    // Padding character '=' maps to -2 (sentinel: stop).
    b64Lookup["=".charCodeAt(0)] = -2;
  }
  return b64Lookup;
}

/**
 * Decodes a standard base64 string into an ArrayBuffer.
 * Tolerates missing padding and stray whitespace (as produced by some
 * base64 encoders).
 *
 * @param {string} base64
 * @returns {ArrayBuffer}
 * @throws {Error} on invalid base64 input
 */
export function base64ToArrayBuffer(base64) {
  if (typeof base64 !== "string") {
    throw new Error("base64ToArrayBuffer: expected a string");
  }
  // Strip whitespace; padding is handled via the lookup sentinel.
  const clean = base64.replace(/[\r\n\s]/g, "");
  if (clean.length % 4 === 1) {
    throw new Error("base64ToArrayBuffer: invalid base64 length");
  }
  const lookup = getB64Lookup();
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));

  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = lookup[clean.charCodeAt(i)];
    const b = i + 1 < clean.length ? lookup[clean.charCodeAt(i + 1)] : -2;
    const c = i + 2 < clean.length ? lookup[clean.charCodeAt(i + 2)] : -2;
    const d = i + 3 < clean.length ? lookup[clean.charCodeAt(i + 3)] : -2;

    if (a === -1 || b === -1 || (c !== -2 && c === -1) || (d !== -2 && d === -1)) {
      throw new Error("base64ToArrayBuffer: invalid base64 character");
    }

    out[o++] = ((a & 0x3f) << 2) | ((b & 0x30) >> 4);
    if (c !== -2) {
      out[o++] = ((b & 0x0f) << 4) | ((c & 0x3c) >> 2);
    }
    if (d !== -2) {
      out[o++] = ((c & 0x03) << 6) | (d & 0x3f);
    }
  }

  return out.buffer.slice(0, o);
}

/**
 * Encodes an ArrayBuffer/typed array to a base64 string.
 * (Used by tests to round-trip `base64ToArrayBuffer`.)
 *
 * @param {ArrayBuffer|Uint8Array} bytes
 * @returns {string}
 */
export function arrayBufferToBase64(bytes) {
  const data =
    bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let out = "";
  for (let i = 0; i < data.length; i += 3) {
    const b0 = data[i];
    const b1 = i + 1 < data.length ? data[i + 1] : 0;
    const b2 = i + 2 < data.length ? data[i + 2] : 0;
    out += B64_ALPHABET[b0 >> 2];
    out += B64_ALPHABET[((b0 & 0x03) << 4) | (b1 >> 4)];
    out += i + 1 < data.length ? B64_ALPHABET[((b1 & 0x0f) << 2) | (b2 >> 6)] : "=";
    out += i + 2 < data.length ? B64_ALPHABET[b2 & 0x3f] : "=";
  }
  return out;
}
