import React from "react";
import { Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from "react-native-reanimated";
import { haptic } from "../../utils/haptics";

/**
 * ═══════════════════════════════════════════════════════════════════════
 *   TactilePressable — The Atomic Interactive Element
 *
 *   Every pressable thing in the app uses this. Provides:
 *
 *     • Spring-physics compression on press (scale + lift)
 *     • Optional haptic feedback (off by default — opt-in per instance)
 *     • UI-thread animation via Reanimated
 *
 *   ─── Variants ──────────────────────────────────────────────────
 *   default    → compress (0.97) + lift (-1px). Buttons, small cards.
 *   compact    → compress (0.98) only. Chips, list rows, small tappables.
 *   card       → compress (0.985) only, gentle spring. Big content cards.
 *                Lifts read as "floaty" on large surfaces — use card
 *                variant when the user presses a full-width listing card.
 *   assertive  → compress (0.95) + sink (+1px). Destructive actions.
 *
 *   ─── Haptic ───────────────────────────────────────────────────
 *   Off by default. Pass haptic prop to enable:
 *     <TactilePressable haptic onPress={...}>           light tap
 *     <TactilePressable haptic="commit" onPress={...}>  medium
 *     <TactilePressable haptic="success" ...>           success pattern
 *     <TactilePressable haptic="selection" ...>         toggle tick
 * ═══════════════════════════════════════════════════════════════════════
 */

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Default press-in: fast, slight overshoot
const PRESS_IN_SPRING = {
  damping: 18,
  stiffness: 450,
  mass: 0.5,
};

// Default press-out: snappy, no bounce
const PRESS_OUT_SPRING = {
  damping: 22,
  stiffness: 400,
  mass: 0.6,
};

// Card-specific: slower, weightier — big surfaces need more inertia
// to feel "pressed into the page" rather than floating.
const CARD_PRESS_IN_SPRING = {
  damping: 24,
  stiffness: 320,
  mass: 0.7,
};

const CARD_PRESS_OUT_SPRING = {
  damping: 26,
  stiffness: 280,
  mass: 0.75,
};

export default function TactilePressable({
  children,
  style,
  variant = "default",
  pressScale,
  haptic: hapticMode = false,
  disabled = false,
  onPress,
  onPressIn: externalPressIn,
  onPressOut: externalPressOut,
  ...rest
}) {
  const pressed = useSharedValue(0);

  const config = (() => {
    switch (variant) {
      case "compact":
        return { scale: pressScale ?? 0.98, lift: 0, useCardSpring: false };
      case "card":
        // Cards: light compression, zero lift, weightier spring
        return { scale: pressScale ?? 0.985, lift: 0, useCardSpring: true };
      case "assertive":
        return { scale: pressScale ?? 0.95, lift: 1, useCardSpring: false };
      default:
        return { scale: pressScale ?? 0.97, lift: -1, useCardSpring: false };
    }
  })();

  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(pressed.value, [0, 1], [1, config.scale]);
    const translateY = interpolate(pressed.value, [0, 1], [0, config.lift]);
    return {
      transform: [{ scale }, { translateY }],
    };
  });

  const fireHaptic = () => {
    if (!hapticMode) return;
    if (hapticMode === true || hapticMode === "tap") haptic.tap();
    else if (hapticMode === "commit") haptic.commit();
    else if (hapticMode === "success") haptic.success();
    else if (hapticMode === "warning") haptic.warning();
    else if (hapticMode === "error") haptic.error();
    else if (hapticMode === "selection") haptic.selection();
  };

  const handlePressIn = (e) => {
    if (!disabled) {
      const inSpring = config.useCardSpring
        ? CARD_PRESS_IN_SPRING
        : PRESS_IN_SPRING;
      pressed.value = withSpring(1, inSpring);
      fireHaptic();
    }
    externalPressIn?.(e);
  };

  const handlePressOut = (e) => {
    if (!disabled) {
      const outSpring = config.useCardSpring
        ? CARD_PRESS_OUT_SPRING
        : PRESS_OUT_SPRING;
      pressed.value = withSpring(0, outSpring);
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
