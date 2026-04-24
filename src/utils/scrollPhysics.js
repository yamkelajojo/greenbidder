/**
 * ═══════════════════════════════════════════════════════════════════════
 *   scrollPhysics.js — Worklet-Based Scroll Physics
 *
 *   Pure math helpers for building physics-driven horizontal carousels.
 *   Every export is a worklet — runs on the UI thread, zero JS bridge.
 *   Import in any Reanimated handler:
 *
 *     import { projectEndpoint, snapDecision, CAROUSEL_SPRING } from "...";
 *
 *   ─── Why we need this ─────────────────────────────────────────
 *   React Native's ScrollView has two scroll behaviors:
 *
 *     snapToInterval      → clunky. Snaps to nearest edge on release
 *                           regardless of your intent. A fast flick and
 *                           a tiny drag both end up on the next card.
 *
 *     decelerationRate    → fluid, but doesn't respect card boundaries.
 *                           Ends mid-card if that's where inertia lands.
 *
 *   What we actually want (Apple Photos, Instagram Stories):
 *
 *     • Drag → 1:1 with finger, zero latency
 *     • Release with velocity → predict where inertia would land
 *     • Snap decision → which card edge is that predicted endpoint near?
 *     • If the predicted endpoint is clearly past the next card, skip to it.
 *     • If velocity is high enough to traverse multiple cards, honor that.
 *     • Ease into the chosen card with a tuned spring — not linear.
 *
 *   This file provides the math. FadeEdgeScroll applies it.
 *
 *   ─── The endpoint formula ─────────────────────────────────────
 *   iOS UIScrollView uses exponential decay:
 *
 *     offsetAtTime(t) = currentOffset + velocity * (1 - exp(-t/tau)) * tau
 *
 *   where tau is a time constant derived from decelerationRate.
 *   At t → infinity, this converges to:
 *
 *     endpoint = currentOffset + velocity * tau
 *
 *   That's the `projectEndpoint` formula. It's what Airbnb published
 *   in their horizontal-list optimization blog post — same as UIKit.
 * ═══════════════════════════════════════════════════════════════════════
 */

/**
 * ─── projectEndpoint ────────────────────────────────────────────
 *
 * Predicts where a scroll will naturally come to rest given its
 * current offset and velocity. This is the "where would it land
 * if I just let iOS handle it" number.
 *
 * Tau derivation: for deceleration d (0..1, where 1 = no friction):
 *   tau = d / (1 - d)
 *
 * So for the iOS "normal" deceleration of 0.998:
 *   tau ≈ 499   (long, gliding)
 *
 * For the iOS "fast" deceleration of 0.99:
 *   tau ≈ 99    (short, snappy)
 *
 * In practice we pass the deceleration value directly and derive tau.
 *
 * @param currentOffset  px - where the scroll is right now
 * @param velocity       px/ms - signed velocity at moment of release
 * @param deceleration   0..1 - iOS decelerationRate value (default 0.998)
 * @returns predicted endpoint in px
 */
export function projectEndpoint(currentOffset, velocity, deceleration = 0.998) {
  "worklet";
  // Convert deceleration to time constant (in ms, since velocity is px/ms)
  const tau = deceleration / (1 - deceleration);
  return currentOffset + velocity * tau;
}

/**
 * ─── snapDecision ───────────────────────────────────────────────
 *
 * Given a predicted endpoint and the carousel's layout, decides
 * which card edge (in px offset) to actually commit to.
 *
 * The decision algorithm:
 *   1. Find the card index nearest to the predicted endpoint.
 *   2. But if velocity is above threshold, honor that direction:
 *      - Velocity > threshold → round UP (toward next card)
 *      - Velocity < -threshold → round DOWN (toward previous card)
 *      - Low velocity → round to nearest (default banker's rounding)
 *   3. Clamp result to [0, maxIndex].
 *
 * This matches Instagram/Apple Photos:
 *   • A fast flick always moves at least one card.
 *   • A slow drag lands on whichever card is closer.
 *   • Super-fast flicks with large predicted endpoints can skip 2-3.
 *
 * @param currentOffset    px - current scroll position
 * @param predictedEndpoint px - from projectEndpoint()
 * @param velocity         px/ms - for direction decisions
 * @param snapInterval     px per card (e.g. 172 = card 160 + margin 12)
 * @param contentOffset    px left padding (e.g. 12 for spacing.md - 4)
 * @param maxIndex         highest card index (items.length - 1)
 * @param velocityThreshold px/ms above which direction is honored (default 0.3)
 * @returns { targetOffset, targetIndex } — where to animate to
 */
export function snapDecision(
  currentOffset,
  predictedEndpoint,
  velocity,
  snapInterval,
  contentOffset,
  maxIndex,
  velocityThreshold = 0.3,
) {
  "worklet";

  // Card index at the predicted endpoint, as a float
  const rawIndex = (predictedEndpoint - contentOffset) / snapInterval;

  // Card index at current position, for direction reference
  const currentIndex = (currentOffset - contentOffset) / snapInterval;

  let targetIndex;

  if (Math.abs(velocity) > velocityThreshold) {
    // High-velocity fling — honor the direction
    // Look at the SIGN of velocity, then round in that direction
    // from the current position (not the predicted endpoint).
    // This prevents super-long predictions from overshooting —
    // we commit to the next card in the fling direction AT MINIMUM,
    // but take the further of that vs where prediction landed.
    if (velocity > 0) {
      // Scrolling right
      const minTarget = Math.ceil(currentIndex + 0.001);
      const predictedTarget = Math.round(rawIndex);
      targetIndex = Math.max(minTarget, predictedTarget);
    } else {
      // Scrolling left
      const maxTarget = Math.floor(currentIndex - 0.001);
      const predictedTarget = Math.round(rawIndex);
      targetIndex = Math.min(maxTarget, predictedTarget);
    }
  } else {
    // Low velocity — just round to nearest
    targetIndex = Math.round(rawIndex);
  }

  // Clamp to valid range
  targetIndex = Math.max(0, Math.min(maxIndex, targetIndex));

  const targetOffset = contentOffset + targetIndex * snapInterval;

  return { targetOffset, targetIndex };
}

/**
 * ─── CAROUSEL_SPRING ────────────────────────────────────────────
 *
 * The spring config used for settling onto a target card after release.
 *
 * Tuning notes:
 *   damping   = 26 → high enough to avoid visible bounce
 *   stiffness = 180 → moderate — not too fast (glitchy) not too slow (lazy)
 *   mass      = 0.8 → light, feels nimble; 1.0 felt heavier than wanted
 *   overshootClamping = true → prevents tiny back-bounce after landing
 *   restDisplacementThreshold + restSpeedThreshold → faster "done"
 *                                                    detection, less
 *                                                    frame-burning at end
 *
 * Feeling: commits to the target with confidence, settles cleanly.
 * Not bouncy. Not sluggish. "Magnetic" is the word.
 * ═══════════════════════════════════════════════════════════════════════
 */
export const CAROUSEL_SPRING = {
  damping: 26,
  stiffness: 180,
  mass: 0.8,
  overshootClamping: true,
  restDisplacementThreshold: 0.1,
  restSpeedThreshold: 0.1,
};

/**
 * ─── rubberBand ────────────────────────────────────────────────
 *
 * Apple's elastic resistance curve for over-scroll. When the user drags
 * past the valid range, instead of hitting a wall, the offset follows
 * a decaying curve — each additional px of drag contributes less and
 * less movement. Creates the feeling of pulling against a rubber band.
 *
 * Formula is Apple's published one (used in UIScrollView since iOS 1):
 *
 *   resistance(x, dim) = (1 - 1/((x * 0.55 / dim) + 1)) * dim
 *
 * Where x is how far past the boundary you've dragged, and dim is
 * the carousel's width. At x = 0 returns 0 (no past). At x → infinity
 * asymptotically approaches dim (never breaks).
 *
 * Only used if we add custom drag handling later — default ScrollView
 * has its own rubber-band. Exposed here for the future.
 *
 * @param x   px - distance dragged past the boundary
 * @param dim px - reference dimension (usually scroll view width)
 * @returns resisted distance
 */
export function rubberBand(x, dim) {
  "worklet";
  return (1 - 1 / ((Math.abs(x) * 0.55) / dim + 1)) * dim * Math.sign(x);
}
