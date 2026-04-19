import React from "react";
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";

/**
 * ═══════════════════════════════════════════════════════════════════════
 *   ScrollAwareCard — Compound Cover-Flow Animation
 *
 *   Three parameters interpolate together, driven by ONE distance metric
 *   (how far this card's center is from the viewport's center):
 *
 *     1. scale       → 1.0 at center, 0.92 at edges — cards recede
 *     2. opacity     → 1.0 at center, 0.65 at edges — cards fade
 *     3. translateX  → 0 at center, ±8px at edges — subtle parallax drift
 *
 *   The parallax is the illusion amplifier. Without it, scale + fade read
 *   as "zooming," which is jarring. Adding a small horizontal offset
 *   in the direction of motion makes cards feel like they're *drifting
 *   away* from the center — three-dimensional without any 3D transforms.
 *
 *   ─── How the parallax works ───────────────────────────────────
 *   Cards to the LEFT of center drift slightly MORE left (negative tX).
 *   Cards to the RIGHT of center drift slightly MORE right (positive tX).
 *   The offset scales with distance from center — closest cards barely
 *   move, edge cards get the full 8px drift. This creates the sense
 *   of "speed differential" Airbnb and Apple use, without needing to
 *   desynchronize the scroll itself.
 *
 *   ─── Focus zone ───────────────────────────────────────────────
 *   The inner ~60% of the viewport is the "focus zone" — cards stay at
 *   full scale/opacity here. Only the outer 40% on each side applies the
 *   scale/fade falloff. This ensures that when you're scrolled mid-card,
 *   the active card doesn't feel "half animated."
 *
 *   ─── Props ────────────────────────────────────────────────────
 *   index          → card's position in the list (0-based)
 *   scrollX        → shared value from parent scroll handler
 *   viewportWidth  → shared value of the ScrollView's visible width
 *   cardWidth      → px width of a single card (e.g. 160)
 *   snapInterval   → px per card step (card width + margin, e.g. 172)
 *   contentOffset  → px left padding of the scroll content (e.g. 12)
 *   minScale       → scale at edge (default 0.92)
 *   minOpacity     → opacity at edge (default 0.65)
 *   parallaxAmount → max horizontal drift in px (default 8)
 *   focusZone      → fraction of viewport staying "full" (default 0.6)
 * ═══════════════════════════════════════════════════════════════════════
 */

export default function ScrollAwareCard({
  index,
  scrollX,
  viewportWidth,
  cardWidth,
  snapInterval,
  contentOffset = 0,
  minScale = 0.92,
  minOpacity = 0.65,
  parallaxAmount = 8,
  focusZone = 0.6,
  children,
  style,
}) {
  const animatedStyle = useAnimatedStyle(() => {
    // If viewport hasn't laid out yet, render at full scale
    if (viewportWidth.value === 0) {
      return { opacity: 1, transform: [{ scale: 1 }, { translateX: 0 }] };
    }

    // Where is THIS card's center, in absolute content coordinates
    const cardCenterX = contentOffset + index * snapInterval + cardWidth / 2;

    // Where is the viewport center, in the same coordinate space
    const viewportCenterX = scrollX.value + viewportWidth.value / 2;

    // Signed distance: negative = card is left of center, positive = right.
    // We keep the sign because parallax direction depends on it.
    const signedDistance = cardCenterX - viewportCenterX;
    const absDistance = Math.abs(signedDistance);

    // Define the falloff region. Inner focusZone of the viewport keeps
    // cards at full values. Outside that, they smoothly fall off.
    const halfViewport = viewportWidth.value / 2;
    const focusEdge = halfViewport * focusZone;
    const offscreenEdge = halfViewport + cardWidth;

    // Progress: 0 = in focus zone, 1 = at or past offscreen edge
    const progress = interpolate(
      absDistance,
      [focusEdge, offscreenEdge],
      [0, 1],
      Extrapolation.CLAMP,
    );

    // Scale + opacity fall off smoothly
    const scale = interpolate(progress, [0, 1], [1, minScale]);
    const opacity = interpolate(progress, [0, 1], [1, minOpacity]);

    // Parallax: direction matches signedDistance.
    // Sign is: Math.sign(signedDistance) * parallaxAmount * progress
    // Using interpolate to handle the sign properly at signedDistance=0
    const parallaxSign = signedDistance >= 0 ? 1 : -1;
    const translateX = parallaxSign * parallaxAmount * progress;

    return {
      opacity,
      transform: [{ scale }, { translateX }],
    };
  });

  return (
    <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
  );
}
