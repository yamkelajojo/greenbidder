import React from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { colors, spacing } from "../../config/theme";

/**
 * ═══════════════════════════════════════════════════════════════════════
 *   FadeEdgeScroll — Horizontal carousel with scroll-aware edges
 *
 *   Responsibilities:
 *     • Track scrollX and viewportWidth as shared values
 *     • Render the scroll view with custom deceleration + snap behavior
 *     • Overlay left/right fade gradients whose opacity is driven by
 *       scroll position (invisible when nothing to reveal in that direction)
 *     • Expose scrollX + viewportWidth via render-prop so child cards
 *       can apply their own per-card animation (scale, opacity, parallax)
 *
 *   ─── Usage ────────────────────────────────────────────────────
 *     <FadeEdgeScroll
 *       snapInterval={172}
 *       fadeWidth={24}
 *       contentPaddingLeft={12}
 *       contentPaddingRight={16}
 *     >
 *       {(scrollX, viewportWidth) =>
 *         items.map((item, i) => (
 *           <ScrollAwareCard
 *             key={item.id}
 *             index={i}
 *             scrollX={scrollX}
 *             viewportWidth={viewportWidth}
 *             ...
 *           >
 *             <Card ... />
 *           </ScrollAwareCard>
 *         ))
 *       }
 *     </FadeEdgeScroll>
 *
 *   ─── Scroll physics ───────────────────────────────────────────
 *   decelerationRate: 0.92 — fluid, not sticky. Standard "fast" is 0.9
 *   which snaps too eagerly; 0.99 drifts forever; 0.92 is the sweet spot
 *   for horizontal carousels — cards come to rest naturally while still
 *   allowing flick-to-multiple-cards.
 *
 *   snapToInterval is still used for subtle end-alignment but tuned
 *   so it doesn't feel "clunky" — just gentle guidance to card edges.
 *
 *   scrollEventThrottle: 16 is the standard 60fps budget. Reanimated
 *   runs the handler on the UI thread so we could go lower (8 = 120fps)
 *   but 16 is enough to feel silky and saves battery.
 * ═══════════════════════════════════════════════════════════════════════
 */

export default function FadeEdgeScroll({
  children,
  snapInterval = 172,
  fadeWidth = 24,
  contentPaddingLeft = spacing.md - 4,
  contentPaddingRight = spacing.md,
  backgroundColor = colors.backgroundSecondary,
  decelerationRate = 0.92,
}) {
  const scrollX = useSharedValue(0);
  const contentWidth = useSharedValue(0);
  const viewportWidth = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
      contentWidth.value = event.contentSize.width;
      viewportWidth.value = event.layoutMeasurement.width;
    },
  });

  // Left fade: invisible at start, grows in over first 48px of scroll
  const leftFadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, [0, 48], [0, 1], Extrapolation.CLAMP),
  }));

  // Right fade: visible until you approach the end, then dissolves
  const rightFadeStyle = useAnimatedStyle(() => {
    const maxScroll = contentWidth.value - viewportWidth.value;
    if (maxScroll <= 0) return { opacity: 0 };
    return {
      opacity: interpolate(
        scrollX.value,
        [maxScroll - 48, maxScroll],
        [1, 0],
        Extrapolation.CLAMP,
      ),
    };
  });

  return (
    <View style={styles.wrapper}>
      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        decelerationRate={decelerationRate}
        snapToInterval={snapInterval}
        snapToAlignment="start"
        contentContainerStyle={{
          paddingLeft: contentPaddingLeft,
          paddingRight: contentPaddingRight,
          paddingVertical: spacing.xs,
        }}
      >
        {/* Render-prop: children receive the live shared values */}
        {typeof children === "function"
          ? children(scrollX, viewportWidth)
          : children}
      </Animated.ScrollView>

      {/* Left edge dissolve — grows as user scrolls right */}
      <Animated.View
        style={[styles.fadeLeft, { width: fadeWidth }, leftFadeStyle]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={[backgroundColor, backgroundColor + "00"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Right edge dissolve — shrinks as user reaches end */}
      <Animated.View
        style={[styles.fadeRight, { width: fadeWidth }, rightFadeStyle]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={[backgroundColor + "00", backgroundColor]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
  },
  fadeLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
  },
  fadeRight: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
  },
});
