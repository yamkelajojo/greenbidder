import React, { useEffect, useRef } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useFrameCallback,
  withTiming,
  withDelay,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

/**
 * ═══════════════════════════════════════════════════════════════════════
 *   AnalyzingGlow v3 — Aurora overlay, rendered ON TOP of child
 *
 *   Architecture shift from v1/v2: instead of rendering the glow BEHIND
 *   children (which ran into zIndex/overflow clipping issues), we now
 *   render it as an OVERLAY on top, with pointerEvents:none so taps
 *   still reach the child.
 *
 *   Each blob is a LinearGradient that fades from a color (at the card
 *   edge) out to transparent (heading away from the card). This creates
 *   a colored "rim" visible against the card — card center remains
 *   undisturbed because blobs are transparent there.
 *
 *   Positioning:
 *   - Overlay is absoluteFill inside container
 *   - Top blob: positioned at top edge, extends UPWARD past container
 *     via negative margin. Since container has overflow:visible (default)
 *     and overlay has overflow:visible, the blob's overflow portion
 *     renders in the space outside the card.
 *   - Same principle for all four sides + diagonal accent.
 *
 *   If parent DOES clip overflow, the outer halo is clipped but the inner
 *   rim (the part that overlaps the card edge) is still visible. Either
 *   way, the effect is seen.
 * ═══════════════════════════════════════════════════════════════════════
 */

const PHI = 1.618033988749;
const SQRT2 = 1.414213562373;
const SQRT3 = 1.732050807568;

const RAMP_UP_DURATION = 380;
const HOLD_DURATION = 380;
const RAMP_DOWN_DURATION = 440;
const TOTAL_DURATION = RAMP_UP_DURATION + HOLD_DURATION + RAMP_DOWN_DURATION;

export default function AnalyzingGlow({
  children,
  active = false,
  bleed = 40,
}) {
  const intensity = useSharedValue(0);
  const motionTime = useSharedValue(0);
  const phase = useRef(Math.random() * Math.PI * 2).current;

  const frameLoop = useFrameCallback((frameInfo) => {
    const dt = (frameInfo.timeSincePreviousFrame ?? 16) / 1000;
    motionTime.value += dt;
  }, false);

  useEffect(() => {
    if (!frameLoop) return;
    if (active) {
      frameLoop.setActive(true);
      intensity.value = withTiming(1, {
        duration: RAMP_UP_DURATION,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
      });
      intensity.value = withDelay(
        RAMP_UP_DURATION + HOLD_DURATION,
        withTiming(0, {
          duration: RAMP_DOWN_DURATION,
          easing: Easing.bezier(0.4, 0, 0.4, 1),
        }),
      );
      const timer = setTimeout(() => {
        frameLoop.setActive(false);
        motionTime.value = 0;
      }, TOTAL_DURATION + 150);
      return () => clearTimeout(timer);
    } else {
      intensity.value = withTiming(0, { duration: 200 });
    }
  }, [active]);

  // Animated styles: opacity driven by intensity, transforms driven by
  // motion time (pulse + drift).

  const topBlobStyle = useAnimatedStyle(() => {
    const t = motionTime.value;
    const driftX = Math.sin(t / PHI + phase) * 16;
    const scaleBreath = 1 + 0.1 * Math.sin(t / SQRT2 + phase * 1.7);
    const pulse = interpolate(
      Math.sin(t / SQRT3 + phase * 2.3),
      [-1, 1],
      [0.75, 1.0],
    );
    return {
      opacity: intensity.value * pulse,
      transform: [{ translateX: driftX }, { scale: scaleBreath }],
    };
  });

  const bottomBlobStyle = useAnimatedStyle(() => {
    const t = motionTime.value;
    const driftX = Math.sin(t / PHI + phase + Math.PI) * 14;
    const scaleBreath = 1 + 0.12 * Math.sin(t / SQRT2 + phase + Math.PI / 2);
    const pulse = interpolate(
      Math.sin(t / SQRT3 + phase + Math.PI / 4),
      [-1, 1],
      [0.7, 0.95],
    );
    return {
      opacity: intensity.value * pulse,
      transform: [{ translateX: driftX }, { scale: scaleBreath }],
    };
  });

  const leftBlobStyle = useAnimatedStyle(() => {
    const t = motionTime.value;
    const driftY = Math.sin(t / (PHI * 1.2) + phase + 1.1) * 16;
    const scaleBreath = 1 + 0.11 * Math.sin(t / (SQRT2 * 1.1) + phase);
    const pulse = interpolate(
      Math.sin(t / (SQRT3 * 0.9) + phase + 0.7),
      [-1, 1],
      [0.65, 0.9],
    );
    return {
      opacity: intensity.value * pulse,
      transform: [{ translateY: driftY }, { scale: scaleBreath }],
    };
  });

  const rightBlobStyle = useAnimatedStyle(() => {
    const t = motionTime.value;
    const driftY = Math.sin(t / (PHI * 1.1) + phase + 2.4) * 14;
    const scaleBreath = 1 + 0.13 * Math.sin(t / SQRT2 + phase + 1.2);
    const pulse = interpolate(
      Math.sin(t / (SQRT3 * 1.2) + phase + 1.9),
      [-1, 1],
      [0.7, 0.95],
    );
    return {
      opacity: intensity.value * pulse,
      transform: [{ translateY: driftY }, { scale: scaleBreath }],
    };
  });

  const accentBlobStyle = useAnimatedStyle(() => {
    const t = motionTime.value;
    const driftX = Math.sin(t / (PHI * 0.8) + phase + 0.3) * 24;
    const driftY = Math.sin(t / (SQRT2 * 0.9) + phase + 1.5) * 18;
    const scaleBreath = 1 + 0.16 * Math.sin(t / (SQRT3 * 1.1) + phase);
    const pulse = interpolate(
      Math.sin(t / (SQRT2 * 1.3) + phase + 2.1),
      [-1, 1],
      [0.5, 0.85],
    );
    return {
      opacity: intensity.value * pulse,
      transform: [
        { translateX: driftX },
        { translateY: driftY },
        { scale: scaleBreath },
      ],
    };
  });

  return (
    <View style={styles.container}>
      {children}
      {/* Overlay — renders ON TOP of children, pointerEvents:none so
          taps pass through. Each blob extends outward from the card edges. */}
      <View style={styles.overlay} pointerEvents="none">
        {/* TOP — amber bleed from top edge upward and into top of card */}
        <Animated.View
          style={[
            styles.blobBase,
            {
              top: -bleed,
              left: -bleed * 0.3,
              right: -bleed * 0.3,
              height: bleed * 2.2,
            },
            topBlobStyle,
          ]}
        >
          <LinearGradient
            colors={[
              "rgba(239, 159, 39, 0)",
              "rgba(239, 159, 39, 0.7)",
              "rgba(239, 159, 39, 0.4)",
              "rgba(239, 159, 39, 0)",
            ]}
            locations={[0, 0.45, 0.65, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* BOTTOM — green */}
        <Animated.View
          style={[
            styles.blobBase,
            {
              bottom: -bleed,
              left: -bleed * 0.3,
              right: -bleed * 0.3,
              height: bleed * 2.2,
            },
            bottomBlobStyle,
          ]}
        >
          <LinearGradient
            colors={[
              "rgba(99, 153, 34, 0)",
              "rgba(99, 153, 34, 0.4)",
              "rgba(99, 153, 34, 0.65)",
              "rgba(99, 153, 34, 0)",
            ]}
            locations={[0, 0.35, 0.55, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* LEFT — pink */}
        <Animated.View
          style={[
            styles.blobBase,
            {
              left: -bleed,
              top: -bleed * 0.3,
              bottom: -bleed * 0.3,
              width: bleed * 2.2,
            },
            leftBlobStyle,
          ]}
        >
          <LinearGradient
            colors={[
              "rgba(230, 150, 180, 0)",
              "rgba(230, 150, 180, 0.65)",
              "rgba(230, 150, 180, 0.4)",
              "rgba(230, 150, 180, 0)",
            ]}
            locations={[0, 0.45, 0.65, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* RIGHT — cream */}
        <Animated.View
          style={[
            styles.blobBase,
            {
              right: -bleed,
              top: -bleed * 0.3,
              bottom: -bleed * 0.3,
              width: bleed * 2.2,
            },
            rightBlobStyle,
          ]}
        >
          <LinearGradient
            colors={[
              "rgba(255, 220, 170, 0)",
              "rgba(255, 220, 170, 0.4)",
              "rgba(255, 220, 170, 0.7)",
              "rgba(255, 220, 170, 0)",
            ]}
            locations={[0, 0.35, 0.55, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* ACCENT — lavender, roams diagonally, low opacity */}
        <Animated.View
          style={[
            styles.blobBase,
            {
              top: -bleed * 0.6,
              left: -bleed * 0.6,
              right: -bleed * 0.6,
              bottom: -bleed * 0.6,
            },
            accentBlobStyle,
          ]}
        >
          <LinearGradient
            colors={[
              "rgba(180, 150, 220, 0)",
              "rgba(180, 150, 220, 0.3)",
              "rgba(200, 180, 230, 0.28)",
              "rgba(180, 150, 220, 0)",
            ]}
            locations={[0, 0.3, 0.65, 1]}
            start={{ x: 0.1, y: 0.1 }}
            end={{ x: 0.9, y: 0.9 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    overflow: "visible",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    overflow: "visible",
  },
  blobBase: {
    position: "absolute",
    overflow: "visible",
  },
});
