import { useCallback } from "react";
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { springs } from "../config/theme";
import { haptic } from "./haptics";

/**
 * ═══════════════════════════════════════════════════════════════════════
 *   usePressAnimation — The Tactile Feel
 *
 *   Apple's secret: when you press a button on iOS, it doesn't just
 *   change colour. It *compresses*. Scale shifts from 1.0 → 0.96, and
 *   bounces back. Happens in ~150ms. Your brain reads this as "solid,
 *   responsive, made of something."
 *
 *   This hook gives any pressable element that same feel. Use it like:
 *
 *     const { animatedStyle, onPressIn, onPressOut } = usePressAnimation();
 *     <Animated.View style={[styles.btn, animatedStyle]}
 *       onPressIn={onPressIn} onPressOut={onPressOut} />
 *
 *   It runs entirely on the UI thread (reanimated shared values), so
 *   there's zero bridge traffic. 120fps smooth on capable devices.
 *
 *   Options:
 *     scale    — compression target (default 0.96, tighter = more pressed)
 *     opacity  — fade on press (default 1, no fade — set < 1 for ghost buttons)
 *     hapticOnPress — whether to fire haptic.tap() on press-in (default true)
 * ═══════════════════════════════════════════════════════════════════════
 */

export const usePressAnimation = (options = {}) => {
  const {
    scale: targetScale = 0.96,
    opacity: targetOpacity = 1,
    hapticOnPress = true,
  } = options;

  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const onPressIn = useCallback(() => {
    scale.value = withSpring(targetScale, springs.press);
    if (targetOpacity !== 1) {
      opacity.value = withSpring(targetOpacity, springs.press);
    }
    if (hapticOnPress) haptic.tap();
  }, [targetScale, targetOpacity, hapticOnPress]);

  const onPressOut = useCallback(() => {
    scale.value = withSpring(1, springs.standard);
    if (targetOpacity !== 1) {
      opacity.value = withSpring(1, springs.standard);
    }
  }, [targetOpacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return { animatedStyle, onPressIn, onPressOut };
};
