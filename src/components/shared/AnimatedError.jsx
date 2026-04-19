import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  interpolate,
} from "react-native-reanimated";
import { colors, spacing, fonts, radius } from "../../config/theme";

/**
 * ═══════════════════════════════════════════════════════════════════════
 *   AnimatedErrorText — Field-Level Error Feedback
 *
 *   Mounts once and stays mounted. When `error` changes from empty →
 *   string, maxHeight expands + opacity fades in + subtle slide from above.
 *   When it clears, the reverse. No re-mount, no layout jump.
 *
 *   Text is always rendered (empty space when no error) so that when an
 *   error arrives we're animating a shown → expanded transition rather
 *   than a mount, which Reanimated can drive on the UI thread.
 *
 *   Usage:
 *     <TextInput ... />
 *     <AnimatedErrorText error={errors.email} />
 * ═══════════════════════════════════════════════════════════════════════
 */

const SPRING = { damping: 18, stiffness: 280, mass: 0.8 };

export function AnimatedErrorText({ error, style }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(error ? 1 : 0, SPRING);
  }, [error]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: interpolate(progress.value, [0, 1], [-6, 0]) }],
    maxHeight: interpolate(progress.value, [0, 1], [0, 100]),
  }));

  // Always render the wrapper — the animated maxHeight collapses it when
  // no error. Inner text uses a space fallback so the Text node always
  // occupies a line internally; maxHeight clips it to zero when closed.
  return (
    <Animated.View style={[styles.errorWrapper, animatedStyle]}>
      <Text style={[styles.fieldError, style]}>{error || " "}</Text>
    </Animated.View>
  );
}

/**
 * ═══════════════════════════════════════════════════════════════════════
 *   AnimatedErrorBanner — Top-of-Form Error Surface
 *
 *   Springs down from above the form when an API error arrives. Slightly
 *   bouncier than field errors — it's a more prominent moment.
 *
 *   Usage:
 *     <AnimatedErrorBanner message={apiError} />
 * ═══════════════════════════════════════════════════════════════════════
 */

const BANNER_SPRING = { damping: 15, stiffness: 220, mass: 0.9 };

export function AnimatedErrorBanner({ message, style }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(message ? 1 : 0, BANNER_SPRING);
  }, [message]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [-12, 0]) },
      { scale: interpolate(progress.value, [0, 1], [0.96, 1]) },
    ],
    maxHeight: interpolate(progress.value, [0, 1], [0, 200]),
    marginBottom: interpolate(progress.value, [0, 1], [0, spacing.md]),
  }));

  return (
    <Animated.View style={[styles.bannerWrapper, animatedStyle]}>
      <View style={[styles.errorBanner, style]}>
        <Text style={styles.errorBannerText}>{message || " "}</Text>
      </View>
    </Animated.View>
  );
}

/**
 * ═══════════════════════════════════════════════════════════════════════
 *   useErrorShake — Horizontal Shake Hook
 *
 *   Returns [animatedStyle, triggerShake]. Wrap your input's parent View
 *   with the style, call triggerShake() when validation fails.
 *
 *   Shake: 5 oscillations, 6px amplitude, ~280ms total.
 *   The classic "nope" — physical, brief, unambiguous.
 *
 *   Usage:
 *     const [shakeStyle, shake] = useErrorShake();
 *     <Animated.View style={shakeStyle}>
 *       <TextInput ... />
 *     </Animated.View>
 *     if (!result.success) { shake(); setErrors(result.errors); }
 * ═══════════════════════════════════════════════════════════════════════
 */

export function useErrorShake() {
  const offset = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  const triggerShake = () => {
    offset.value = withSequence(
      withTiming(-6, { duration: 50 }),
      withTiming(6, { duration: 60 }),
      withTiming(-4, { duration: 60 }),
      withTiming(4, { duration: 60 }),
      withTiming(0, { duration: 50 }),
    );
  };

  return [animatedStyle, triggerShake];
}

const styles = StyleSheet.create({
  errorWrapper: {
    overflow: "hidden",
  },
  bannerWrapper: {
    overflow: "hidden",
  },
  fieldError: {
    color: colors.danger,
    fontSize: fonts.small,
    marginTop: spacing.xs,
  },
  errorBanner: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorBannerText: {
    color: colors.danger,
    fontSize: fonts.caption,
  },
});
