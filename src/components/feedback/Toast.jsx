import React, { useEffect } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  runOnJS,
  interpolate,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import {
  colors,
  spacing,
  radius,
  shadows,
  springs,
  text,
} from "../../config/theme";

/**
 * ═══════════════════════════════════════════════════════════════════════
 *   Toast — Ambient Feedback
 *
 *   A small card that slides down from the top, announces something,
 *   and gracefully leaves. Used for success confirmations, light
 *   info, gentle nudges.
 *
 *   Animation: three-parameter entrance — translateY, scale, opacity —
 *   all driven by a single spring. Exit is a softer timing curve.
 *
 *   Visual: frosted glass over the content behind. A coloured accent
 *   stripe on the left that communicates intent (success/error/info).
 *   An icon that animates in after the container arrives.
 *
 *   Used by FeedbackProvider; not instantiated directly by components.
 *   Components call `toast.success("...")` and the provider handles this.
 * ═══════════════════════════════════════════════════════════════════════
 */

const WIDTH = Dimensions.get("window").width;
const MAX_WIDTH = Math.min(WIDTH - spacing.lg * 2, 440);

const VARIANT_CONFIG = {
  success: {
    accent: colors.success,
    icon: "✓",
    iconBg: colors.successLight,
  },
  error: {
    accent: colors.danger,
    icon: "!",
    iconBg: colors.dangerLight,
  },
  warning: {
    accent: colors.warning,
    icon: "!",
    iconBg: colors.warningLight,
  },
  info: {
    accent: colors.info,
    icon: "i",
    iconBg: colors.infoLight,
  },
};

export default function Toast({ toast, onDismiss }) {
  const { id, variant = "success", title, message } = toast;
  const config = VARIANT_CONFIG[variant];

  // Entrance driver — 0 offscreen above, 1 in position
  const progress = useSharedValue(0);

  useEffect(() => {
    // Enter
    progress.value = withSpring(1, springs.standard);

    // Auto-dismiss after 2.5s
    const timeout = setTimeout(() => {
      progress.value = withTiming(0, { duration: 280 }, (finished) => {
        if (finished) runOnJS(onDismiss)(id);
      });
    }, 2500);

    return () => clearTimeout(timeout);
  }, [id]);

  const animatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(progress.value, [0, 1], [-80, 0]);
    const scale = interpolate(progress.value, [0, 1], [0.94, 1]);
    const opacity = interpolate(progress.value, [0, 0.4, 1], [0, 1, 1]);

    return {
      transform: [{ translateY }, { scale }],
      opacity,
    };
  });

  // Icon animates in slightly after container
  const iconProgress = useSharedValue(0);
  useEffect(() => {
    iconProgress.value = withDelay(150, withSpring(1, springs.bouncy));
  }, [id]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconProgress.value }],
  }));

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <BlurView
        intensity={80}
        tint="light"
        style={[styles.surface, shadows.floating]}
      >
        {/* Coloured accent stripe — signals intent at a glance */}
        <View style={[styles.accentStripe, { backgroundColor: config.accent }]} />

        {/* Icon badge */}
        <Animated.View
          style={[styles.iconBadge, { backgroundColor: config.iconBg }, iconStyle]}
        >
          <Text style={[styles.iconText, { color: config.accent }]}>
            {config.icon}
          </Text>
        </Animated.View>

        {/* Copy */}
        <View style={styles.content}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {message ? (
            <Text style={styles.message} numberOfLines={2}>
              {message}
            </Text>
          ) : null}
        </View>
      </BlurView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: spacing.xxl,
    alignSelf: "center",
    width: MAX_WIDTH,
    zIndex: 9999,
  },
  surface: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    paddingLeft: spacing.lg,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: "rgba(252, 251, 248, 0.85)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
  },
  accentStripe: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  iconText: {
    fontSize: 16,
    fontWeight: "800",
  },
  content: {
    flex: 1,
  },
  title: {
    ...text.bodyEmphasis,
    marginBottom: 1,
  },
  message: {
    ...text.caption,
    color: colors.textSecondary,
  },
});
