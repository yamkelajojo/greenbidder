import React, { useEffect, useRef } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  interpolate,
  Easing,
} from "react-native-reanimated";

/**
 * ═══════════════════════════════════════════════════════════════════════
 *   AnimatedLogo — Brand Text Entrance
 *
 *   TWO MODES, same component:
 *
 *   1. FIRST MOUNT (cold app launch): full choreography. Letters start
 *      spaced apart (+4px tracking) at 0.96 scale with opacity 0, then
 *      collapse into their final position. The "assembling itself" moment.
 *      ~650ms total.
 *
 *   2. SUBSEQUENT MOUNTS (after logout, or re-entering Login from Register):
 *      just a quick fade in. ~250ms. The hero moment is for the user's
 *      first impression, not every time they hit this screen.
 *
 *   The distinction is tracked via a module-level variable. It persists
 *   across navigation (same JS runtime) but resets when the app is killed
 *   and reopened (module reloads from scratch) — exactly the behavior
 *   a human would expect.
 *
 *   ─── Props ────────────────────────────────────────────────────
 *   text           → the word to animate
 *   style          → text style (size, color, weight)
 *   delay          → ms to wait before starting (default 0)
 *   initialSpacing → starting letter-spacing in px, first-mount only (default 4)
 *   duration       → first-mount duration (default 650ms)
 * ═══════════════════════════════════════════════════════════════════════
 */

// Module-level flag — survives across component mounts within a single
// JS runtime, but resets on cold app launch (module reload).
let hasPlayedOnce = false;

export default function AnimatedLogo({
  text,
  style,
  delay = 0,
  initialSpacing = 4,
  duration = 650,
}) {
  const progress = useSharedValue(0);

  // Capture the mode synchronously at mount time so it doesn't shift
  // between renders. The first instance to mount claims the hero moment;
  // any mount after that gets the subtle fade.
  const isFirstMount = useRef(!hasPlayedOnce);
  if (isFirstMount.current) {
    hasPlayedOnce = true;
  }

  useEffect(() => {
    if (isFirstMount.current) {
      // Full choreography — letters collapse + scale + fade
      progress.value = withDelay(
        delay,
        withTiming(1, {
          duration,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
        }),
      );
    } else {
      // Subsequent entry — just a gentle fade
      progress.value = withDelay(
        delay,
        withTiming(1, {
          duration: 250,
          easing: Easing.out(Easing.quad),
        }),
      );
    }
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    if (isFirstMount.current) {
      return {
        opacity: progress.value,
        letterSpacing: interpolate(progress.value, [0, 1], [initialSpacing, 0]),
        transform: [{ scale: interpolate(progress.value, [0, 1], [0.96, 1]) }],
      };
    }
    // Subtle mode — opacity only, no geometry shift
    return {
      opacity: progress.value,
    };
  });

  return (
    <Animated.Text style={[style, animatedStyle]} allowFontScaling={false}>
      {text}
    </Animated.Text>
  );
}
