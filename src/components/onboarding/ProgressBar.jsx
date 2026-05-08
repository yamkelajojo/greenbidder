import React from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolate,
} from "react-native-reanimated";
import { colors, radius, springs } from "../../config/theme";

export default function ProgressBar({
  current,
  total,
  accentColor = colors.primary,
  motionState,
}) {
  const progress = (current / total) * 100;
  const activeIndex = motionState?.activeIndex;

  const fillStyle = useAnimatedStyle(() => ({
    width: withSpring(`${progress}%`, springs.gentle),
  }));

  return (
    <View style={styles.container}>
      <View style={styles.track} />
      <Animated.View style={[styles.fill, fillStyle, { backgroundColor: accentColor }]} />

      <View style={styles.dots}>
        {Array.from({ length: total }).map((_, index) => {
          const dotStyle = useAnimatedStyle(() => {
            const active = activeIndex ? activeIndex.value : current - 1;
            const delta = Math.abs(active - index);
            return {
              width: withSpring(interpolate(delta, [0, 1], [14, 6], Extrapolate.CLAMP), springs.gentle),
              opacity: withSpring(interpolate(delta, [0, 1], [1, 0.5], Extrapolate.CLAMP), springs.gentle),
            };
          });

          const isPassed = index < current;
          return (
            <Animated.View
              key={index}
              style={[
                styles.dot,
                dotStyle,
                { backgroundColor: isPassed ? accentColor : colors.border },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", height: 4, marginBottom: 20 },
  track: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.border,
    borderRadius: radius.full,
  },
  fill: { position: "absolute", height: "100%", borderRadius: radius.full },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 12 },
  dot: { height: 6, borderRadius: radius.full },
});
