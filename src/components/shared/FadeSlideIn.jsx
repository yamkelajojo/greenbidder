import React, { useEffect } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  interpolate,
} from "react-native-reanimated";

/**
 * ═══════════════════════════════════════════════════════════════════════
 *   FadeSlideIn — Mount Entrance Primitive
 *
 *   Wraps any children and animates them in from below on mount.
 *   Compound motion: opacity 0→1 + translateY 12→0, driven by ONE
 *   shared value for guaranteed sync.
 *
 *   Use for: screen content entrance, form fields, section headers,
 *   any element that should "arrive" rather than "appear".
 *
 *   ─── Stagger ──────────────────────────────────────────────────
 *   When rendering a list of these, pass `delay` per item:
 *     <FadeSlideIn delay={0}>  → arrives immediately
 *     <FadeSlideIn delay={70}> → arrives 70ms later
 *     <FadeSlideIn delay={140}>→ arrives 140ms later
 *   The ripple reads as "the app is thoughtfully laying things out".
 *
 *   ─── Props ────────────────────────────────────────────────────
 *   delay       → ms to wait before animating (default 0)
 *   distance    → px to slide from below (default 12, subtle)
 *   style       → merged with the animated wrapper
 *   children    → anything
 * ═══════════════════════════════════════════════════════════════════════
 */

// Gentle, natural — like a card settling onto paper
const ENTRANCE_SPRING = {
  damping: 20,
  stiffness: 180,
  mass: 0.9,
};

export default function FadeSlideIn({
  children,
  delay = 0,
  distance = 12,
  style,
  ...rest
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withSpring(1, ENTRANCE_SPRING));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1]),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [distance, 0]) },
    ],
  }));

  return (
    <Animated.View style={[style, animatedStyle]} {...rest}>
      {children}
    </Animated.View>
  );
}
