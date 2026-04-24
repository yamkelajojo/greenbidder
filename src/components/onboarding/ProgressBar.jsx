// src/components/onboarding/ProgressBar.jsx
import React from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { colors, radius } from "../../config/theme";

export default function ProgressBar({
  current,
  total,
  accentColor = colors.primary,
}) {
  // Calculate width percentage
  const progress = (current / total) * 100;

  const animatedStyle = useAnimatedStyle(() => ({
    width: withTiming(`${progress}%`, { duration: 300 }),
  }));

  return (
    <View style={styles.container}>
      {/* Track */}
      <View style={styles.track} />

      {/* Progress fill */}
      <Animated.View
        style={[styles.fill, animatedStyle, { backgroundColor: accentColor }]}
      />

      {/* Dots indicator */}
      <View style={styles.dots}>
        {Array.from({ length: total }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index < current
                ? { backgroundColor: accentColor, width: 12 }
                : { backgroundColor: colors.border },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: 4,
    marginBottom: 20,
  },
  track: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.border,
    borderRadius: radius.full,
  },
  fill: {
    position: "absolute",
    height: "100%",
    borderRadius: radius.full,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
  },
  dot: {
    height: 6,
    borderRadius: radius.full,
    transition: "width 0.2s",
  },
});
