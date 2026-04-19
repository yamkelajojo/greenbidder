import React, { useEffect, useRef, useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useFrameCallback,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { scoreToHex, scoreToColor } from "../../utils/scoreColor";

/**
 * ═══════════════════════════════════════════════════════════════════════
 *   AIBadge v11 — Final Calm Pass
 *
 *   Changes from v10:
 *     • Score text: #4a453c → #8a857c (warm light gray, much softer)
 *     • Ribbon palette alphas × 0.75 (additional 25% reduction)
 *     • Pill alpha 0.77 → 0.74 (3% more glass)
 *     • Star personality variance widened ×1.15 (15% more varied)
 *     • Sparkle glyph + dot both at 75% opacity (visible but not loud)
 *
 *   Everything else (motion, breath choreography, star-only personality,
 *   three ribbon layers, stacked glow shadows) unchanged from v10.
 * ═══════════════════════════════════════════════════════════════════════
 */

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ─── Ribbon palette — additional × 0.75 reduction ────────────────
function buildGradientColors(score) {
  let primaryTransparent, secondaryPeak;
  if (score >= 7.5) {
    primaryTransparent = "rgba(99, 153, 34, 0.0)";
    secondaryPeak = "rgba(99, 153, 34, 0.165)"; // was 0.22
  } else if (score >= 6) {
    primaryTransparent = "rgba(239, 159, 39, 0.0)";
    secondaryPeak = "rgba(239, 159, 39, 0.165)";
  } else {
    primaryTransparent = "rgba(186, 117, 23, 0.0)";
    secondaryPeak = "rgba(186, 117, 23, 0.165)";
  }
  return [
    primaryTransparent,
    "rgba(239, 159, 39, 0.09)", // was 0.12
    "rgba(255, 220, 170, 0.11)", // was 0.15
    secondaryPeak,
    "rgba(255, 200, 160, 0.105)", // was 0.14
    "rgba(168, 195, 170, 0.075)", // was 0.10
    "rgba(205, 195, 215, 0.06)", // was 0.08
    primaryTransparent,
  ];
}

const GRADIENT_POSITIONS = [0, 0.12, 0.28, 0.48, 0.62, 0.76, 0.86, 1.0];

function pillBackgroundForScore(score) {
  const [r, g, b] = scoreToColor(score);
  const mixR = Math.round(r * 0.04 + 255 * 0.96);
  const mixG = Math.round(g * 0.04 + 255 * 0.96);
  const mixB = Math.round(b * 0.04 + 255 * 0.96);
  // 3% more glass — 0.77 → 0.74
  return `rgba(${mixR}, ${mixG}, ${mixB}, 0.74)`;
}

function pillShadowAlpha(score) {
  const [r, g, b] = scoreToColor(score);
  const dR = Math.round(r * 0.1 + 60 * 0.9);
  const dG = Math.round(g * 0.1 + 55 * 0.9);
  const dB = Math.round(b * 0.1 + 50 * 0.9);
  return `rgba(${dR}, ${dG}, ${dB}, 0.05)`;
}

/**
 * Sparkle glyph color — same score-driven hue, but now at 75% opacity
 * per the final dial-down. The textShadow glow layers underneath still
 * render at their own intensity, so the effect is a slightly translucent
 * glyph on top of its colored halos.
 */
function sparkleGlyphMainColor(score) {
  const [r, g, b] = scoreToColor(score);
  const dR = Math.round(r * 0.8);
  const dG = Math.round(g * 0.8);
  const dB = Math.round(b * 0.8);
  return `rgba(${dR}, ${dG}, ${dB}, 0.75)`; // was 0.95
}

/**
 * Dot color — at 75% opacity (via rgba wrapper since scoreToHex returns
 * a solid hex string). We re-derive the RGB here and apply 0.75 alpha.
 */
function dotBackgroundForScore(score) {
  const [r, g, b] = scoreToColor(score);
  return `rgba(${r}, ${g}, ${b}, 0.75)`;
}

// ─── Sizing ───────────────────────────────────────────
const DEFAULT_SIZING = {
  paddingX: 11,
  paddingY: 5,
  gap: 6,
  fontSize: 12,
  dotSize: 8,
  sparkleGlyphSize: 13,
  height: 24,
};

const COMPACT_SIZING = {
  paddingX: 9,
  paddingY: 4,
  gap: 0,
  fontSize: 11,
  dotSize: 0,
  sparkleGlyphSize: 0,
  height: 21,
};

const PHI = 1.618033988749;
const SQRT2 = 1.414213562373;
const SQRT3 = 1.732050807568;
const SPEED_MULT = 1.15;
const DIST_MULT = 1.15;

/**
 * Per-badge star personality, variance widened by 15% over v10.
 * Every range's SPAN is multiplied by 1.15 (bounds pushed outward).
 * The base/center of each range stays the same; only the reach changes.
 */
function makeSparklePersonality() {
  // Helper: center + span random
  const jitter = (base, span) => base + (Math.random() - 0.5) * span * 1.15;

  return {
    breathRotDirection: Math.random() > 0.5 ? 1 : -1,
    // base ranges widened ×1.15 from v10
    breathRotMag: jitter(1.1, 0.8), // v10: 0.7-1.5, now ~0.64-1.56
    tapRotDirection: Math.random() > 0.5 ? 1 : -1,
    tapRotMag: jitter(1.1, 0.8),
    scaleMag: jitter(1.1, 0.5), // v10: 0.85-1.35, now ~0.81-1.39
    glowBoostMag: jitter(1.0, 0.8), // v10: 0.6-1.4, now ~0.54-1.46
    durationMult: jitter(1.0, 0.24), // v10: 0.88-1.12, now ~0.862-1.138
    ambientRotSpeed: jitter(1.05, 0.5), // v10: 0.8-1.3
    ambientRotAmount: jitter(1.05, 0.7), // v10: 0.7-1.4
    ambientGlowSpeed: jitter(1.05, 0.4), // v10: 0.85-1.25
  };
}

export default function AIBadge({
  score = 0,
  onPress,
  style,
  disabled = false,
  compact = false,
}) {
  const sizing = compact ? COMPACT_SIZING : DEFAULT_SIZING;
  const phase = useRef(Math.random() * Math.PI * 2).current;
  const personality = useRef(makeSparklePersonality()).current;

  const pillScale = useSharedValue(1);
  const dotScale = useSharedValue(1);
  const sparkleScale = useSharedValue(1);
  const sparkleRotate = useSharedValue(0);
  const sparkleGlowBoost = useSharedValue(0);
  const boost = useSharedValue(0);
  const motionTime = useSharedValue(0);
  const shineProgress = useSharedValue(0);
  const shineOpacity = useSharedValue(0);

  const viewRef = useRef(null);
  const dotBg = useMemo(() => dotBackgroundForScore(score), [score]);
  const sparkleColor = useMemo(() => sparkleGlyphMainColor(score), [score]);
  const gradientColors = useMemo(() => buildGradientColors(score), [score]);
  const pillBg = useMemo(() => pillBackgroundForScore(score), [score]);
  const pillShadowColor = useMemo(() => pillShadowAlpha(score), [score]);

  useFrameCallback((frameInfo) => {
    const dt = (frameInfo.timeSincePreviousFrame ?? 16) / 1000;
    motionTime.value += dt * SPEED_MULT;
    if (boost.value > 0.001) {
      boost.value = Math.max(0, boost.value - dt * 1.1);
    }
  });

  // ─── Mount breath — pill/dot/ribbon/shine fixed, star personality-driven
  useEffect(() => {
    pillScale.value = withSequence(
      withTiming(1.06, { duration: 360, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 540, easing: Easing.inOut(Easing.quad) }),
    );
    dotScale.value = withSequence(
      withTiming(1.3, { duration: 360, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 540, easing: Easing.inOut(Easing.quad) }),
    );
    boost.value = withSequence(
      withTiming(0.45, { duration: 360 }),
      withTiming(0, { duration: 540 }),
    );
    shineOpacity.value = withDelay(
      80,
      withSequence(
        withTiming(0.12, { duration: 160, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 440, easing: Easing.inOut(Easing.quad) }),
      ),
    );
    shineProgress.value = withDelay(
      80,
      withTiming(1, { duration: 600, easing: Easing.inOut(Easing.quad) }),
    );

    // Star only — personality
    const D = personality.durationMult;
    const breathScale = 1 + 0.35 * personality.scaleMag;
    const breathRot =
      12 * personality.breathRotMag * personality.breathRotDirection;

    sparkleScale.value = withSequence(
      withTiming(breathScale, {
        duration: 360 * D,
        easing: Easing.out(Easing.cubic),
      }),
      withTiming(1, {
        duration: 540 * D,
        easing: Easing.inOut(Easing.quad),
      }),
    );
    sparkleRotate.value = withSequence(
      withTiming(breathRot, {
        duration: 360 * D,
        easing: Easing.out(Easing.cubic),
      }),
      withTiming(0, {
        duration: 540 * D,
        easing: Easing.inOut(Easing.quad),
      }),
    );
    sparkleGlowBoost.value = withSequence(
      withTiming(personality.glowBoostMag, {
        duration: 360 * D,
        easing: Easing.out(Easing.cubic),
      }),
      withTiming(0, {
        duration: 540 * D,
        easing: Easing.inOut(Easing.quad),
      }),
    );
  }, []);

  const handlePress = () => {
    if (disabled) return;

    pillScale.value = withSequence(
      withTiming(1.18, { duration: 90, easing: Easing.out(Easing.quad) }),
      withTiming(1.08, { duration: 160, easing: Easing.inOut(Easing.quad) }),
    );
    dotScale.value = withSequence(
      withTiming(1.6, { duration: 90, easing: Easing.out(Easing.quad) }),
      withTiming(1.2, { duration: 160, easing: Easing.inOut(Easing.quad) }),
    );
    boost.value = 1;
    shineProgress.value = 0;
    shineOpacity.value = withSequence(
      withTiming(0.14, { duration: 100 }),
      withTiming(0, { duration: 320 }),
    );
    shineProgress.value = withTiming(1, {
      duration: 420,
      easing: Easing.out(Easing.quad),
    });

    const D = personality.durationMult;
    const tapScale = 1 + 0.55 * personality.scaleMag;
    const tapRot = 15 * personality.tapRotMag * personality.tapRotDirection;

    sparkleScale.value = withSequence(
      withTiming(tapScale, {
        duration: 90 * D,
        easing: Easing.out(Easing.quad),
      }),
      withTiming(1.15, {
        duration: 160 * D,
        easing: Easing.inOut(Easing.quad),
      }),
    );
    sparkleRotate.value = withSequence(
      withTiming(tapRot, { duration: 90 * D, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 160 * D, easing: Easing.inOut(Easing.quad) }),
    );
    sparkleGlowBoost.value = withSequence(
      withTiming(personality.glowBoostMag * 1.3, { duration: 90 * D }),
      withTiming(0, { duration: 300 * D }),
    );

    if (viewRef.current) {
      viewRef.current.measureInWindow((x, y, width, height) => {
        onPress?.({ x, y, width, height }, score);
      });
    }
  };

  const pillAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pillScale.value }],
  }));

  const dotAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dotScale.value }],
  }));

  const sparkleGlyphAnimStyle = useAnimatedStyle(() => {
    const t = motionTime.value;
    const ambientRot =
      Math.sin((t * personality.ambientRotSpeed) / SQRT3 + phase) *
      2.5 *
      personality.ambientRotAmount *
      personality.breathRotDirection;
    const totalRot = sparkleRotate.value + ambientRot;
    return {
      transform: [{ rotate: `${totalRot}deg` }, { scale: sparkleScale.value }],
    };
  });

  const shineAnimStyle = useAnimatedStyle(() => ({
    opacity: shineOpacity.value,
    transform: [
      { translateX: interpolate(shineProgress.value, [0, 1], [-80, 160]) },
    ],
  }));

  const softRibbonStyle = useAnimatedStyle(() => {
    const t = motionTime.value;
    const driftX = Math.sin(t / PHI + phase) * 10 * DIST_MULT;
    const floatY = Math.sin(t / SQRT2 + phase * 1.7) * 1.5 * DIST_MULT;
    const opacityPhase = Math.sin(t / SQRT3 + phase * 2.3);
    const baseOpacity = interpolate(opacityPhase, [-1, 1], [0.35, 0.58]);
    return {
      opacity: baseOpacity + boost.value * 0.15,
      transform: [
        { translateX: driftX },
        { translateY: floatY },
        { scale: 1.1 + boost.value * 0.05 },
      ],
    };
  });

  const sharpRibbonStyle = useAnimatedStyle(() => {
    const t = motionTime.value;
    const driftX = Math.sin(t / PHI + phase + Math.PI) * 7 * DIST_MULT;
    const floatY =
      Math.sin(t / SQRT2 + phase * 1.7 + Math.PI / 2) * 1 * DIST_MULT;
    const opacityPhase = Math.sin(t / SQRT3 + phase * 2.3 + Math.PI / 3);
    const baseOpacity = interpolate(opacityPhase, [-1, 1], [0.4, 0.62]);
    return {
      opacity: baseOpacity + boost.value * 0.12,
      transform: [
        { translateX: driftX },
        { translateY: floatY },
        { scale: 1 + boost.value * 0.03 },
      ],
    };
  });

  const ultraSoftRibbonStyle = useAnimatedStyle(() => {
    const t = motionTime.value;
    const driftX = Math.sin(t / (PHI * 1.5) + phase + 2.1) * 12 * DIST_MULT;
    const opacityPhase = Math.sin(t / (SQRT3 * 1.3) + phase);
    const baseOpacity = interpolate(opacityPhase, [-1, 1], [0.28, 0.48]);
    return {
      opacity: baseOpacity + boost.value * 0.1,
      transform: [{ translateX: driftX }, { scale: 1.25 + boost.value * 0.04 }],
    };
  });

  const sparkleGlowStyle = useAnimatedStyle(() => {
    const t = motionTime.value;
    const opacityPhase = Math.sin(
      (t * personality.ambientGlowSpeed) / SQRT2 + phase + Math.PI / 4,
    );
    const baseOpacity = interpolate(opacityPhase, [-1, 1], [0.55, 0.85]);
    return {
      opacity: baseOpacity + sparkleGlowBoost.value * 0.3 + boost.value * 0.15,
    };
  });

  return (
    <View ref={viewRef} style={[styles.wrapper, style]} collapsable={false}>
      <AnimatedPressable
        onPress={handlePress}
        disabled={disabled}
        style={[
          styles.pill,
          {
            paddingHorizontal: sizing.paddingX,
            paddingVertical: sizing.paddingY,
            gap: sizing.gap,
            backgroundColor: pillBg,
          },
          pillAnimStyle,
        ]}
        hitSlop={8}
      >
        <Animated.View
          style={[styles.ribbonLayerUltraSoft, ultraSoftRibbonStyle]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={gradientColors}
            locations={GRADIENT_POSITIONS}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.ribbonGradient}
          />
        </Animated.View>

        <Animated.View
          style={[styles.ribbonLayer, softRibbonStyle]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={gradientColors}
            locations={GRADIENT_POSITIONS}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.ribbonGradient}
          />
        </Animated.View>

        <Animated.View
          style={[styles.ribbonLayerSharp, sharpRibbonStyle]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={gradientColors}
            locations={GRADIENT_POSITIONS}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.ribbonGradient}
          />
        </Animated.View>

        <LinearGradient
          colors={[
            "rgba(255, 255, 255, 0.4)",
            "rgba(255, 255, 255, 0.08)",
            "rgba(255, 255, 255, 0)",
          ]}
          locations={[0, 0.4, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <LinearGradient
          colors={["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0)", pillShadowColor]}
          locations={[0, 0.6, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <View style={styles.edgeLight} pointerEvents="none" />

        <Animated.View
          style={[styles.shineContainer, shineAnimStyle]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={[
              "rgba(255, 255, 255, 0)",
              "rgba(255, 255, 255, 1)",
              "rgba(255, 255, 255, 0)",
            ]}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0.4 }}
            end={{ x: 1, y: 0.6 }}
            style={styles.shineBand}
          />
        </Animated.View>

        {!compact && (
          <View style={styles.sparkleSlot}>
            <Animated.Text
              style={[
                styles.sparkleGlyph,
                styles.sparkleGlowLayer,
                {
                  fontSize: sizing.sparkleGlyphSize,
                  color: "transparent",
                  textShadowColor: "rgba(239, 159, 39, 0.75)",
                  textShadowOffset: { width: 0, height: 0 },
                  textShadowRadius: 6,
                },
                sparkleGlyphAnimStyle,
                sparkleGlowStyle,
              ]}
            >
              ✦
            </Animated.Text>
            <Animated.Text
              style={[
                styles.sparkleGlyph,
                styles.sparkleGlowLayer,
                {
                  fontSize: sizing.sparkleGlyphSize,
                  color: "transparent",
                  textShadowColor: "rgba(255, 220, 170, 0.9)",
                  textShadowOffset: { width: 0, height: 0 },
                  textShadowRadius: 4,
                },
                sparkleGlyphAnimStyle,
                sparkleGlowStyle,
              ]}
            >
              ✦
            </Animated.Text>
            <Animated.Text
              style={[
                styles.sparkleGlyph,
                styles.sparkleGlowLayer,
                {
                  fontSize: sizing.sparkleGlyphSize,
                  color: "transparent",
                  textShadowColor: sparkleColor,
                  textShadowOffset: { width: 0, height: 0 },
                  textShadowRadius: 2.5,
                },
                sparkleGlyphAnimStyle,
                sparkleGlowStyle,
              ]}
            >
              ✦
            </Animated.Text>
            <Animated.Text
              style={[
                styles.sparkleGlyph,
                {
                  fontSize: sizing.sparkleGlyphSize,
                  color: sparkleColor,
                  textShadowColor: "rgba(255, 220, 170, 0.5)",
                  textShadowOffset: { width: 0, height: 0 },
                  textShadowRadius: 1.5,
                },
                sparkleGlyphAnimStyle,
              ]}
            >
              ✦
            </Animated.Text>
          </View>
        )}

        <Text style={[styles.scoreText, { fontSize: sizing.fontSize }]}>
          {(score ?? 0).toFixed(1)}
        </Text>

        {!compact && (
          <Animated.View
            style={[
              styles.dot,
              {
                width: sizing.dotSize,
                height: sizing.dotSize,
                borderRadius: sizing.dotSize / 2,
                backgroundColor: dotBg, // now uses 0.75 alpha rgba
              },
              dotAnimStyle,
            ]}
          />
        )}
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
    alignSelf: "flex-start",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 9999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0, 0, 0, 0.07)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.09,
    shadowRadius: 4,
    elevation: 3,
    overflow: "hidden",
  },
  ribbonLayerUltraSoft: {
    ...StyleSheet.absoluteFillObject,
    left: -40,
    right: -40,
    width: undefined,
  },
  ribbonLayer: {
    ...StyleSheet.absoluteFillObject,
    left: -30,
    right: -30,
    width: undefined,
  },
  ribbonLayerSharp: {
    ...StyleSheet.absoluteFillObject,
    left: -20,
    right: -20,
    top: "15%",
    bottom: "15%",
    width: undefined,
  },
  ribbonGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  edgeLight: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.45)",
    borderRadius: 9999,
  },
  shineContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  shineBand: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 85,
    transform: [{ rotate: "15deg" }],
  },
  // Lighter score text: #4a453c → #8a857c (warm light gray)
  scoreText: {
    fontWeight: "500",
    color: "#8a857c",
    fontVariant: ["tabular-nums"],
    zIndex: 3,
  },
  dot: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 1,
    zIndex: 3,
  },
  sparkleSlot: {
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 3,
  },
  sparkleGlowLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    textAlign: "center",
  },
  sparkleGlyph: {
    fontWeight: "600",
    textAlign: "center",
  },
});
