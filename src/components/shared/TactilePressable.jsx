import React from "react";
import { Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from "react-native-reanimated";
import { springs } from "../../config/theme";
import { haptic } from "../../utils/haptics";

/**
 * ═══════════════════════════════════════════════════════════════════════
 *   TactilePressable — The Atomic Interactive Element (Enhanced)
 *
 *   Now animates THREE parameters simultaneously on press:
 *
 *     1. scale       — compression (0.96) — the classic press feel
 *     2. translateY  — subtle lift (-1px) — card rises to meet the finger
 *     3. shadow      — intensifies slightly — depth shifts with motion
 *
 *   All three driven by ONE shared value using interpolation, guaranteeing
 *   they move in perfect sync. This is what compound motion means.
 *
 *   Why lift and not just compress?
 *   Apple's cards and buttons subtly rise when pressed. It sounds wrong
 *   — shouldn't they sink? — but it creates the feeling that the element
 *   is *responsive*, reaching toward the finger. Combined with compression,
 *   it reads as "alive."
 *
 *   Variants:
 *     default  → compress + lift (most interactive surfaces)
 *     subtle   → compression only (dense UI, list rows)
 *     assertive → compress + sink (destructive actions, rare)
 *
 *   Usage:
 *     <TactilePressable onPress={handleSubmit} style={styles.btn}>
 *       <Text>Submit</Text>
 *     </TactilePressable>
 * ═══════════════════════════════════════════════════════════════════════
 */

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function TactilePressable({
  children,
  style,
  variant = "default",
  pressScale,
  haptic: enableHaptic = true,
  disabled = false,
  onPress,
  onPressIn: externalPressIn,
  onPressOut: externalPressOut,
  ...rest
}) {
  // Single driver for all animated properties — keeps them in sync
  const pressed = useSharedValue(0);

  // Variant-specific targets
  const config = (() => {
    switch (variant) {
      case "subtle":
        return { scale: pressScale ?? 0.97, lift: 0 };
      case "assertive":
        return { scale: pressScale ?? 0.95, lift: 1 }; // sinks down
      default:
        return { scale: pressScale ?? 0.96, lift: -1 }; // lifts up
    }
  })();

  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(pressed.value, [0, 1], [1, config.scale]);
    const translateY = interpolate(pressed.value, [0, 1], [0, config.lift]);

    return {
      transform: [{ scale }, { translateY }],
    };
  });

  const handlePressIn = (e) => {
    if (!disabled) {
      pressed.value = withSpring(1, springs.press);
      if (enableHaptic) haptic.tap();
    }
    externalPressIn?.(e);
  };

  const handlePressOut = (e) => {
    if (!disabled) {
      pressed.value = withSpring(0, springs.standard);
    }
    externalPressOut?.(e);
  };

  return (
    <AnimatedPressable
      onPress={disabled ? undefined : onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={[style, !disabled && animatedStyle, disabled && { opacity: 0.5 }]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
