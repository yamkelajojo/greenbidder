import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  interpolate,
  Easing,
} from "react-native-reanimated";
import { colors, spacing, radius } from "../../config/theme";

/**
 * ═══════════════════════════════════════════════════════════════════════
 *   SkeletonCard — Loading Placeholder
 *
 *   A card-shaped placeholder with a gentle breathing pulse. Used while
 *   the feed's listings are being fetched. Feels more alive than a blank
 *   spinner, less annoying than generic shimmer.
 *
 *   The pulse: opacity eases between 0.6 and 1.0 over 1.4s. Soft enough
 *   to be ambient, fast enough that the user knows something's loading.
 *
 *   ─── Props ────────────────────────────────────────────────────
 *   height   → total card height (default 260 — matches real listing)
 *   delay    → ms before the pulse starts (for staggered placeholders)
 * ═══════════════════════════════════════════════════════════════════════
 */

export default function SkeletonCard({ height = 260, delay = 0 }) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    // Start the breathing cycle after `delay` ms
    const timer = setTimeout(() => {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        ),
        -1, // infinite
        false,
      );
    }, delay);

    return () => clearTimeout(timer);
  }, []);

  const breathStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.6, 1.0]),
  }));

  return (
    <Animated.View style={[styles.card, { height }, breathStyle]}>
      <View style={[styles.image, { height: height * 0.65 }]} />
      <View style={styles.body}>
        <View style={styles.lineShort} />
        <View style={styles.lineMedium} />
        <View style={styles.lineLong} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    backgroundColor: colors.backgroundTertiary,
  },
  body: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  lineShort: {
    height: 12,
    width: "35%",
    borderRadius: 4,
    backgroundColor: colors.backgroundTertiary,
  },
  lineMedium: {
    height: 16,
    width: "65%",
    borderRadius: 4,
    backgroundColor: colors.backgroundTertiary,
  },
  lineLong: {
    height: 12,
    width: "80%",
    borderRadius: 4,
    backgroundColor: colors.backgroundTertiary,
  },
});
