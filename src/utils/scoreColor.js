/**
 * ═══════════════════════════════════════════════════════════════════════
 *   scoreColor.js — AI Score → Color Gradient
 *
 *   A pure math utility. Given an AI condition score (0-10), returns a
 *   precise RGB color along the weighted amber→green gradient we locked
 *   in during design review ("Option B").
 *
 *   Design rationale:
 *     Real produce scores cluster between 6.5 and 9.5. A naive linear
 *     gradient (0=amber, 10=green) wastes most of its color range on
 *     scores that never appear. This weighted version concentrates the
 *     most color differentiation in the 7-9 range — where buyers and
 *     farmers actually need to tell a "good" from an "excellent" score
 *     at a glance.
 *
 *   Gradient zones:
 *     0.0 - 4.9  → deep amber, clamped (rare, bad produce)
 *     5.0 - 6.9  → amber-mid → warm amber       (poor to fair)
 *     7.0 - 7.9  → warm amber → fresh green     (transition — good)
 *     8.0 - 8.9  → fresh green → deep green     (high differentiation)
 *     9.0 - 10   → deepest green                (peak)
 *
 *   Every unique score from 0.0 to 10.0 resolves to a unique color — 8.5
 *   and 8.6 are visibly distinct dots on a card, which is the whole
 *   point of the indicator.
 *
 *   ─── Usage ────────────────────────────────────────────────────
 *     import { scoreToColor, scoreToHex, scoreToVerdict } from "...";
 *
 *     const rgb = scoreToColor(8.5);        // [45, 106, 65]
 *     const hex = scoreToHex(8.5);          // "#2D6A41"
 *     const word = scoreToVerdict(8.5);     // "Excellent"
 *
 *     <View style={{ backgroundColor: scoreToHex(score) }} />
 * ═══════════════════════════════════════════════════════════════════════
 */

// ─── Anchor colors ─────────────────────────────────────────────
// These are the key stops along the gradient. Linear interpolation
// happens between them within each zone. Values were color-picked from
// the design preview you approved.

const AMBER_DEEP = [122, 79, 9]; // clamp floor for scores < 5
const AMBER_MID = [186, 117, 23]; // at score 5.0
const AMBER_WARM = [239, 159, 39]; // at score 7.0
const GREEN_FRESH = [99, 153, 34]; // at score 8.0
const GREEN_DEEP = [45, 106, 65]; // at score 9.0+

/**
 * Linear interpolation between two RGB triplets at ratio t (0..1).
 * Rounded because sub-pixel colors waste memory and don't render.
 */
function lerp(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/**
 * scoreToColor(score) — the core function.
 *
 * @param {number} score - AI condition score, 0 to 10. Clamped if outside.
 * @returns {[number, number, number]} - RGB triplet, each 0-255
 */
export function scoreToColor(score) {
  // Clamp to valid range — never trust upstream data
  const s = Math.max(0, Math.min(10, score ?? 0));

  if (s < 5) {
    return AMBER_DEEP;
  }
  if (s < 7) {
    // 5.0 → 7.0 spans AMBER_MID → AMBER_WARM
    return lerp(AMBER_MID, AMBER_WARM, (s - 5) / 2);
  }
  if (s < 8) {
    // 7.0 → 8.0 spans AMBER_WARM → GREEN_FRESH (transition zone)
    return lerp(AMBER_WARM, GREEN_FRESH, s - 7);
  }
  if (s < 9) {
    // 8.0 → 9.0 spans GREEN_FRESH → GREEN_DEEP (high differentiation)
    return lerp(GREEN_FRESH, GREEN_DEEP, s - 8);
  }
  return GREEN_DEEP;
}

/**
 * scoreToHex(score) — same mapping, returned as a hex string.
 * Convenient for style props that want "#RRGGBB" directly.
 *
 * @param {number} score - 0 to 10
 * @returns {string} - e.g. "#2D6A41"
 */
export function scoreToHex(score) {
  const [r, g, b] = scoreToColor(score);
  const toHex = (n) => n.toString(16).padStart(2, "0").toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * scoreToRgba(score, alpha) — with transparency. Useful for the glow
 * and halo effects which need semi-transparent versions of the dot color.
 *
 * @param {number} score - 0 to 10
 * @param {number} alpha - 0 to 1
 * @returns {string} - e.g. "rgba(45, 106, 65, 0.3)"
 */
export function scoreToRgba(score, alpha = 1) {
  const [r, g, b] = scoreToColor(score);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * scoreToVerdict(score) — one-word label derived from the score.
 *
 * Used inside the AI modal (not on the badge itself) — the badge stays
 * clean with just the number + dot. The verdict appears in the modal
 * header as contextual framing.
 *
 * @param {number} score - 0 to 10
 * @returns {string} - Prime / Excellent / Good / Fair / Subpar / Poor
 */
export function scoreToVerdict(score) {
  const s = score ?? 0;
  if (s >= 9) return "Prime";
  if (s >= 8) return "Excellent";
  if (s >= 7) return "Good";
  if (s >= 6) return "Fair";
  if (s >= 5) return "Subpar";
  return "Poor";
}
