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
 *     • UI-thread animation via Reanimated (zero bridge traffic, 60-120fps)
 *
 *   Philosophy: compression is visual feedback that EVERY tap deserves.
 *   Haptics are for decisive moments only — committing an action, toggling
 *   state, errors, success. Not for navigation or list browsing.
 *
 *   ─── Press spec ────────────────────────────────────────────────
 *   Press-in  : snap to compressed state in ~70ms (stiff, low damping)
 *   Press-out : return to rest in ~150ms (snappy, high damping, no bounce)
 *
 *   ─── Variants ──────────────────────────────────────────────────
 *   default    → compress (0.97) + lift (-1px). Primary buttons, cards.
 *   compact    → compress (0.98) only, no lift. Chips, list rows, small tappables.
 *   assertive  → compress (0.95) + sink (+1px). Destructive actions.
 *
 *   ─── Haptic ───────────────────────────────────────────────────
 *   Off by default. Pass `haptic` prop to enable:
 *     <TactilePressable haptic onPress={handleSubmit}> → light tap on press-in
 *     <TactilePressable haptic="commit" ...>           → medium haptic
 *     <TactilePressable haptic="success" ...>          → success pattern
 *
 *   Usage:
 *     <TactilePressable onPress={navigate}>Tap me</TactilePressable>
 *     <TactilePressable haptic onPress={submit}>Submit</TactilePressable>
 *     <TactilePressable haptic="success" onPress={save}>Save</TactilePressable>
 * ═══════════════════════════════════════════════════════════════════════
 */

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Snappy press-in: fast, slight overshoot
const PRESS_IN_SPRING = {
  damping: 18,
  stiffness: 450,
  mass: 0.5,
};

// Snappy release: fast, no bounce
const PRESS_OUT_SPRING = {
  damping: 22,
  stiffness: 400,
  mass: 0.6,
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
        return { scale: pressScale ?? 0.98, lift: 0 };
      case "assertive":
        return { scale: pressScale ?? 0.95, lift: 1 };
      default:
        return { scale: pressScale ?? 0.97, lift: -1 };
    }
  })();

  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(pressed.value, [0, 1], [1, config.scale]);
    const translateY = interpolate(pressed.value, [0, 1], [0, config.lift]);
    return {
      transform: [{ scale }, { translateY }],
    };
  });

  /**
   * Resolve haptic from prop. Supports:
   *   true       → haptic.tap() on press-in
   *   "tap"      → haptic.tap()
   *   "commit"   → haptic.commit()
   *   "success"  → haptic.success() (fires on press-in; for decisive buttons)
   *   false/unset → no haptic
   */
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
      pressed.value = withSpring(1, PRESS_IN_SPRING);
      fireHaptic();
    }
    externalPressIn?.(e);
  };

  const handlePressOut = (e) => {
    if (!disabled) {
      pressed.value = withSpring(0, PRESS_OUT_SPRING);
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
