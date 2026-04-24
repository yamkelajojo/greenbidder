import React, { useEffect, useRef, useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useFrameCallback,
  withTiming,
  withDelay,
  Easing,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { scoreToColor, scoreToHex } from "../../utils/scoreColor";
import { colors, spacing, fonts, radius } from "../../config/theme";
import AnalyzingGlow from "./AnalyzingGlow";
import AIPriceScale from "./AIPriceScale";
import VisualDefects from "./VisualDefects";

/**
 * ═══════════════════════════════════════════════════════════════════════
 *   AIDetailCard v3 — Score-driven colors + instrument price scale
 *
 *   ─── v3 changes (April 2026) ───
 *
 *   1) SCORE-DRIVEN COLOR SYSTEM.
 *      Previously, every text/badge/tint in the card read from the static
 *      `colors.aiBadge` constant — which meant a card with a 3.2 score
 *      still rendered the score badge in the same fixed green as a card
 *      with a 9.1. The visual failed to communicate the single most
 *      important piece of information the AI produces.
 *
 *      Now every score-sensitive surface derives from scoreToColor(score):
 *        - aiTitle header text  → darkened score color
 *        - aiScoreBadge bg      → pure score color (amber→green)
 *        - aiVariety text       → darkened score color
 *        - aiStat tint bg       → score color @ alpha 0.08
 *        - aiTip tint bg        → score color @ alpha 0.1
 *        - aiPriceSection border→ score color @ alpha 0.22
 *      Null scores fall back to neutral (colors.aiBadge stays as a
 *      sensible "no data" fallback — not a default).
 *
 *   2) AIPriceScale.
 *      Replaces the plain "AI Price Range" row with a proper horizontal
 *      instrument: endcaps, track, animated fill, glowing tick at the
 *      farmer's asking price, monospaced readouts, verdict pill. Uses
 *      the new price_assessment field from the v2 AI service.
 *
 *   3) VisualDefects chips.
 *      Surfaces the structured `visual_defects` array (new in v2 AI) as
 *      pill chips below growth_insight. Each chip is auto-toned
 *      (positive/negative/neutral) based on a keyword heuristic.
 *
 *   ─── Preserved from v2 ───
 *   All glass treatment, ribbons, entrance orchestration, glow cycle,
 *   and original info structure. The visual language is unchanged —
 *   only the semantic color mapping was broken and is now fixed.
 * ═══════════════════════════════════════════════════════════════════════
 */

const RIBBON_TOP_INSET = 60;
const RIBBON_BOTTOM_INSET = 60;

const PHI = 1.618033988749;
const SQRT2 = 1.414213562373;
const SQRT3 = 1.732050807568;
const SPEED_MULT = 1.3;
const DIST_MULT = 1.4;

const EASE_SETTLE = Easing.bezier(0.22, 1, 0.36, 1);
const EASE_IN_QUICK = Easing.bezier(0.5, 0, 0.9, 0.4);

const LEAVE_OPACITY_END = 0.75;

// ═══════════════════════════════════════════════════════════════════════
// COLOR HELPERS
// ═══════════════════════════════════════════════════════════════════════

// Ribbon gradient peaks — unchanged from v2. These drift behind the card
// and provide the ambient chroma.
function buildGradientColors(score) {
  let primaryTransparent, secondaryPeak;
  if (score >= 7.5) {
    primaryTransparent = "rgba(99, 153, 34, 0.0)";
    secondaryPeak = "rgba(99, 153, 34, 0.32)";
  } else if (score >= 6) {
    primaryTransparent = "rgba(239, 159, 39, 0.0)";
    secondaryPeak = "rgba(239, 159, 39, 0.32)";
  } else {
    primaryTransparent = "rgba(186, 117, 23, 0.0)";
    secondaryPeak = "rgba(186, 117, 23, 0.32)";
  }
  return [
    primaryTransparent,
    "rgba(239, 159, 39, 0.17)",
    "rgba(255, 220, 170, 0.20)",
    secondaryPeak,
    "rgba(255, 200, 160, 0.19)",
    "rgba(168, 195, 170, 0.15)",
    "rgba(205, 195, 215, 0.12)",
    primaryTransparent,
  ];
}
const GRADIENT_POSITIONS = [0, 0.12, 0.28, 0.48, 0.62, 0.76, 0.86, 1.0];

function cardBackgroundForScore(score) {
  if (score == null) return "rgba(252, 251, 248, 0.88)";
  const [r, g, b] = scoreToColor(score);
  const mixR = Math.round(r * 0.1 + 255 * 0.9);
  const mixG = Math.round(g * 0.1 + 255 * 0.9);
  const mixB = Math.round(b * 0.1 + 255 * 0.9);
  return `rgba(${mixR}, ${mixG}, ${mixB}, 0.88)`;
}

function cardShadowForScore(score) {
  if (score == null) return "rgba(60, 55, 50, 0.06)";
  const [r, g, b] = scoreToColor(score);
  const dR = Math.round(r * 0.1 + 60 * 0.9);
  const dG = Math.round(g * 0.1 + 55 * 0.9);
  const dB = Math.round(b * 0.1 + 50 * 0.9);
  return `rgba(${dR}, ${dG}, ${dB}, 0.06)`;
}

// ─── New v3 helpers ───
// Darker score-derived color for text — the pure scoreToColor is too light
// against the tinted card bg. We multiply each channel by 0.58 to get a
// readable, score-correct ink color.
function scoreTextColor(score) {
  if (score == null) return colors.aiBadge;
  const [r, g, b] = scoreToColor(score);
  return `rgb(${Math.round(r * 0.58)}, ${Math.round(g * 0.58)}, ${Math.round(b * 0.58)})`;
}

// Alpha-tinted surface for tiles (stat boxes, tip boxes, borders).
// Score-derived so tints harmonise with the card rather than clashing.
function scoreTintBg(score, alpha = 0.08) {
  if (score == null) return `rgba(74, 124, 89, ${alpha})`; // fallback to a generic
  const [r, g, b] = scoreToColor(score);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ─── Entrance fade helper ───
function useFadeSlide(entryValue, leaveValue, fromY = 8) {
  return useAnimatedStyle(() => {
    const v = entryValue.value;
    const l = leaveValue ? leaveValue.value : 0;
    const leaveOp = interpolate(
      l,
      [0, LEAVE_OPACITY_END],
      [1, 0],
      Extrapolation.CLAMP,
    );
    return {
      opacity: v * leaveOp,
      transform: [{ translateY: interpolate(v, [0, 1], [fromY, 0]) }],
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════

export default function AIDetailCard({
  ai,
  leaving = false,
  askingPrice = null,
  unit = "kg",
}) {
  const score = ai?.condition_score;
  const raw = ai?.raw_feedback || {};

  // Glow state — two phases: mount glow one-shot, then ambient breath
  const [glowOn, setGlowOn] = useState(false);
  const [ambientOn, setAmbientOn] = useState(false);

  // Entry values for each section
  const headerR = useSharedValue(0);
  const confidenceR = useSharedValue(0);
  const keyInfoR = useSharedValue(0);
  const statsR = useSharedValue(0);
  const insightR = useSharedValue(0);
  const defectsR = useSharedValue(0);
  const tipR = useSharedValue(0);
  const seasonalR = useSharedValue(0);
  const priceR = useSharedValue(0);

  // Leave master
  const leave = useSharedValue(0);

  // ─── Score-derived colors (memoized) ───
  const textColor = useMemo(() => scoreTextColor(score), [score]);
  const badgeBg = useMemo(
    () => (score != null ? scoreToHex(score) : colors.aiBadge),
    [score],
  );
  const statTintBg = useMemo(() => scoreTintBg(score, 0.08), [score]);
  const tipTintBg = useMemo(() => scoreTintBg(score, 0.1), [score]);
  const priceBorderColor = useMemo(() => scoreTintBg(score, 0.22), [score]);

  // ─── Entrance orchestration ───
  useEffect(() => {
    setGlowOn(true);
    const initialGlowTimer = setTimeout(() => setGlowOn(false), 1200);

    const T0 = 180;

    headerR.value = withDelay(
      T0,
      withTiming(1, { duration: 420, easing: EASE_SETTLE }),
    );
    confidenceR.value = withDelay(
      T0 + 100,
      withTiming(1, { duration: 380, easing: EASE_SETTLE }),
    );
    keyInfoR.value = withDelay(
      T0 + 180,
      withTiming(1, { duration: 420, easing: EASE_SETTLE }),
    );
    statsR.value = withDelay(
      T0 + 280,
      withTiming(1, { duration: 420, easing: EASE_SETTLE }),
    );
    insightR.value = withDelay(
      T0 + 380,
      withTiming(1, { duration: 440, easing: EASE_SETTLE }),
    );
    defectsR.value = withDelay(
      T0 + 460,
      withTiming(1, { duration: 400, easing: EASE_SETTLE }),
    );
    tipR.value = withDelay(
      T0 + 540,
      withTiming(1, { duration: 420, easing: EASE_SETTLE }),
    );
    seasonalR.value = withDelay(
      T0 + 620,
      withTiming(1, { duration: 380, easing: EASE_SETTLE }),
    );
    priceR.value = withDelay(
      T0 + 700,
      withTiming(1, { duration: 440, easing: EASE_SETTLE }),
    );

    const entranceEnd = T0 + 700 + 440;

    const completionGlowTimer = setTimeout(() => {
      setGlowOn(true);
      setAmbientOn(true);
    }, entranceEnd + 100);

    const completionGlowOffTimer = setTimeout(
      () => {
        setGlowOn(false);
      },
      entranceEnd + 100 + 1200,
    );

    return () => {
      clearTimeout(initialGlowTimer);
      clearTimeout(completionGlowTimer);
      clearTimeout(completionGlowOffTimer);
    };
  }, []);

  // ─── Leave orchestration ───
  useEffect(() => {
    if (leaving) {
      leave.value = withTiming(1, { duration: 260, easing: EASE_IN_QUICK });
      setAmbientOn(false);
    }
  }, [leaving]);

  // Ribbon time for ambient motion
  const ribbonPhase = useRef(Math.random() * Math.PI * 2).current;
  const ribbonTime = useSharedValue(0);
  useFrameCallback((frameInfo) => {
    const dt = (frameInfo.timeSincePreviousFrame ?? 16) / 1000;
    ribbonTime.value += dt * SPEED_MULT;
  });

  const gradientColors = useMemo(
    () => buildGradientColors(score ?? 7),
    [score],
  );
  const cardBg = useMemo(() => cardBackgroundForScore(score), [score]);
  const cardShadow = useMemo(() => cardShadowForScore(score), [score]);

  // ─── Ribbon layer styles ───
  const softRibbonStyle = useAnimatedStyle(() => {
    const t = ribbonTime.value;
    const driftX = Math.sin(t / PHI + ribbonPhase) * 24 * DIST_MULT;
    const floatY = Math.sin(t / SQRT2 + ribbonPhase * 1.7) * 7 * DIST_MULT;
    const opacityPhase = Math.sin(t / SQRT3 + ribbonPhase * 2.3);
    return {
      opacity: interpolate(opacityPhase, [-1, 1], [0.48, 0.75]),
      transform: [
        { translateX: driftX },
        { translateY: floatY },
        { scale: 1.1 },
      ],
    };
  });

  const sharpRibbonStyle = useAnimatedStyle(() => {
    const t = ribbonTime.value;
    const driftX = Math.sin(t / PHI + ribbonPhase + Math.PI) * 18 * DIST_MULT;
    const floatY =
      Math.sin(t / SQRT2 + ribbonPhase * 1.7 + Math.PI / 2) * 5 * DIST_MULT;
    const opacityPhase = Math.sin(t / SQRT3 + ribbonPhase * 2.3 + Math.PI / 3);
    return {
      opacity: interpolate(opacityPhase, [-1, 1], [0.52, 0.8]),
      transform: [{ translateX: driftX }, { translateY: floatY }],
    };
  });

  const ultraSoftRibbonStyle = useAnimatedStyle(() => {
    const t = ribbonTime.value;
    const driftX =
      Math.sin(t / (PHI * 1.5) + ribbonPhase + 2.1) * 30 * DIST_MULT;
    const opacityPhase = Math.sin(t / (SQRT3 * 1.3) + ribbonPhase);
    return {
      opacity: interpolate(opacityPhase, [-1, 1], [0.4, 0.62]),
      transform: [{ translateX: driftX }, { scale: 1.25 }],
    };
  });

  const ambientRibbonStyle = useAnimatedStyle(() => {
    const t = ribbonTime.value;
    const driftX =
      Math.sin(t / (PHI * 1.8) + ribbonPhase + 1.3) * 18 * DIST_MULT;
    const floatY = Math.sin(t / (SQRT2 * 1.4) + ribbonPhase) * 4 * DIST_MULT;
    const opacityPhase = Math.sin(
      t / (SQRT3 * 1.5) + ribbonPhase + Math.PI / 5,
    );
    return {
      opacity: interpolate(opacityPhase, [-1, 1], [0.22, 0.38]),
      transform: [
        { translateX: driftX },
        { translateY: floatY },
        { scale: 1.15 },
      ],
    };
  });

  // ─── Element fade-slide styles ───
  const headerStyle = useFadeSlide(headerR, leave, 6);
  const confidenceStyle = useFadeSlide(confidenceR, leave, 6);
  const keyInfoStyle = useFadeSlide(keyInfoR, leave, 8);
  const statsStyle = useFadeSlide(statsR, leave, 8);
  const insightStyle = useFadeSlide(insightR, leave, 8);
  const defectsStyle = useFadeSlide(defectsR, leave, 6);
  const tipStyle = useFadeSlide(tipR, leave, 8);
  const seasonalStyle = useFadeSlide(seasonalR, leave, 6);
  const priceStyle = useFadeSlide(priceR, leave, 10);

  if (!ai) return null;

  // Resolve asking price — prefer explicit prop, fall back to raw_feedback
  // if the AI was told about it (which is possible now in v2+)
  const resolvedAskingPrice =
    typeof askingPrice === "number" && askingPrice > 0 ? askingPrice : null;

  return (
    <AnalyzingGlow active={glowOn} ambient={ambientOn} bleed={32}>
      <View style={styles.cardOuter}>
        {/* Glass background */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]} />

        {/* Ambient full-card ribbon */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.ambientRibbonLayer,
            ambientRibbonStyle,
          ]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={gradientColors}
            locations={GRADIENT_POSITIONS}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* Ribbon band — mid-section */}
        <View
          style={[
            styles.ribbonBand,
            { top: RIBBON_TOP_INSET, bottom: RIBBON_BOTTOM_INSET },
          ]}
          pointerEvents="none"
        >
          <Animated.View
            style={[styles.ribbonLayerUltraSoft, ultraSoftRibbonStyle]}
          >
            <LinearGradient
              colors={gradientColors}
              locations={GRADIENT_POSITIONS}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          <Animated.View style={[styles.ribbonLayer, softRibbonStyle]}>
            <LinearGradient
              colors={gradientColors}
              locations={GRADIENT_POSITIONS}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          <Animated.View style={[styles.ribbonLayerSharp, sharpRibbonStyle]}>
            <LinearGradient
              colors={gradientColors}
              locations={GRADIENT_POSITIONS}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>

        {/* Top highlight */}
        <LinearGradient
          colors={[
            "rgba(255, 255, 255, 0.55)",
            "rgba(255, 255, 255, 0.08)",
            "rgba(255, 255, 255, 0)",
          ]}
          locations={[0, 0.25, 0.55]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Bottom shadow */}
        <LinearGradient
          colors={["rgba(0,0,0,0)", "rgba(0,0,0,0)", cardShadow]}
          locations={[0, 0.6, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Edge light */}
        <View style={styles.edgeLight} pointerEvents="none" />

        {/* ─── Content ─── */}
        <View style={styles.content}>
          {/* Header: title + score badge — BOTH score-driven now */}
          <Animated.View style={[styles.aiHeader, headerStyle]}>
            <Text style={[styles.aiTitle, { color: textColor }]}>
              AI Quality Analysis
            </Text>
            <View style={[styles.aiScoreBadge, { backgroundColor: badgeBg }]}>
              <Text style={styles.aiScoreText}>
                {score != null ? Number(score).toFixed(1) : "—"}/10
              </Text>
            </View>
          </Animated.View>

          {/* Confidence indicator — unchanged */}
          {raw.confidence_level && raw.confidence_level !== "high" ? (
            <Animated.View style={[styles.aiConfidence, confidenceStyle]}>
              <Text style={styles.aiConfidenceText}>
                ⚠{" "}
                {raw.confidence_level === "low"
                  ? "Limited image quality — estimates are approximate"
                  : "Some uncertainty in this assessment"}
              </Text>
            </Animated.View>
          ) : null}

          {/* Variety + Harvest readiness */}
          <Animated.View style={[styles.aiKeyInfo, keyInfoStyle]}>
            {raw.variety_identified ? (
              <Text style={[styles.aiVariety, { color: textColor }]}>
                {raw.variety_identified}
              </Text>
            ) : null}
            {raw.harvest_readiness ? (
              <View
                style={[
                  styles.aiHarvestBadge,
                  raw.harvest_readiness === "ready" && styles.harvestReady,
                  raw.harvest_readiness === "soon" && styles.harvestSoon,
                  raw.harvest_readiness === "not yet" && styles.harvestNotYet,
                  raw.harvest_readiness === "overdue" && styles.harvestOverdue,
                ]}
              >
                <Text style={styles.aiHarvestText}>
                  {raw.harvest_readiness === "ready"
                    ? "✓ Ready to sell"
                    : raw.harvest_readiness === "soon"
                      ? "◐ Almost ready"
                      : raw.harvest_readiness === "not yet"
                        ? "○ Not yet"
                        : "⚠ Overdue — sell now"}
                </Text>
              </View>
            ) : null}
          </Animated.View>

          {/* Ripeness + Shelf life + Uniformity row. Uniformity is a new v2
              field so we render a third stat only when it's present. */}
          <Animated.View style={[styles.aiStatsRow, statsStyle]}>
            {ai.ripeness_estimate ? (
              <View style={[styles.aiStat, { backgroundColor: statTintBg }]}>
                <Text style={styles.aiStatLabel}>Ripeness</Text>
                <Text style={styles.aiStatValue}>{ai.ripeness_estimate}</Text>
              </View>
            ) : null}
            {raw.shelf_life_days != null ? (
              <View style={[styles.aiStat, { backgroundColor: statTintBg }]}>
                <Text style={styles.aiStatLabel}>Shelf Life</Text>
                <Text style={styles.aiStatValue}>
                  ~{raw.shelf_life_days} days
                </Text>
              </View>
            ) : null}
            {typeof raw.uniformity_score === "number" ? (
              <View
                style={[
                  styles.aiStat,
                  styles.aiStatLast,
                  { backgroundColor: statTintBg },
                ]}
              >
                <Text style={styles.aiStatLabel}>Uniformity</Text>
                <Text style={styles.aiStatValue}>
                  {Math.round(raw.uniformity_score * 100)}%
                </Text>
              </View>
            ) : null}
          </Animated.View>

          {/* Growth insight */}
          {ai.growth_insight ? (
            <Animated.Text style={[styles.aiInsight, insightStyle]}>
              {ai.growth_insight}
            </Animated.Text>
          ) : null}

          {/* Visual defects / observations — new v3 */}
          {Array.isArray(raw.visual_defects) &&
          raw.visual_defects.length > 0 ? (
            <Animated.View style={defectsStyle}>
              <VisualDefects items={raw.visual_defects} />
            </Animated.View>
          ) : null}

          {/* Storage tip */}
          {raw.storage_advice ? (
            <Animated.View
              style={[styles.aiTip, tipStyle, { backgroundColor: tipTintBg }]}
            >
              <Text style={styles.aiTipText}>💡 {raw.storage_advice}</Text>
            </Animated.View>
          ) : null}

          {/* Seasonal note */}
          {raw.seasonal_note ? (
            <Animated.Text style={[styles.aiSeasonal, seasonalStyle]}>
              📅 {raw.seasonal_note}
            </Animated.Text>
          ) : null}

          {/* ─── AI Price Scale (instrument) — replaces plain price row ─── */}
          {ai.price_suggestion_min != null &&
          ai.price_suggestion_max != null ? (
            <Animated.View
              style={[
                styles.aiPriceSection,
                { borderTopColor: priceBorderColor },
                priceStyle,
              ]}
            >
              <AIPriceScale
                minPrice={ai.price_suggestion_min}
                maxPrice={ai.price_suggestion_max}
                askingPrice={resolvedAskingPrice}
                unit={unit}
                priceAssessment={raw.price_assessment}
                conditionScore={score}
              />

              {/* Legacy market_insight — still useful context below the scale */}
              {raw.market_insight ? (
                <Text style={styles.aiMarket}>{raw.market_insight}</Text>
              ) : null}
            </Animated.View>
          ) : null}
        </View>
      </View>
    </AnalyzingGlow>
  );
}

const styles = StyleSheet.create({
  cardOuter: {
    borderRadius: radius.lg,
    overflow: "hidden",
    marginBottom: spacing.lg,
  },
  ambientRibbonLayer: {
    left: -40,
    right: -40,
    width: undefined,
  },
  ribbonBand: {
    position: "absolute",
    left: 0,
    right: 0,
    overflow: "hidden",
  },
  ribbonLayerUltraSoft: {
    ...StyleSheet.absoluteFillObject,
    left: -50,
    right: -50,
    width: undefined,
  },
  ribbonLayer: {
    ...StyleSheet.absoluteFillObject,
    left: -38,
    right: -38,
    width: undefined,
  },
  ribbonLayerSharp: {
    ...StyleSheet.absoluteFillObject,
    left: -25,
    right: -25,
    top: "20%",
    bottom: "20%",
    width: undefined,
  },
  edgeLight: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.5)",
    borderRadius: radius.lg,
  },
  content: {
    padding: spacing.md,
    zIndex: 2,
  },

  // ─── Header (score-driven colors) ───
  aiHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  aiTitle: {
    fontSize: fonts.body,
    fontWeight: "600",
    // color is inlined per-instance from scoreTextColor(score)
  },
  aiScoreBadge: {
    // backgroundColor is inlined per-instance from scoreToHex(score)
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  aiScoreText: {
    color: "#fff",
    fontSize: fonts.caption,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },

  aiConfidence: {
    backgroundColor: "#FFF8E1",
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  aiConfidenceText: {
    fontSize: fonts.small,
    color: "#B8860B",
  },

  aiKeyInfo: {
    marginBottom: spacing.md,
  },
  aiVariety: {
    // color is inlined per-instance from scoreTextColor(score)
    fontSize: fonts.body,
    fontWeight: "600",
    marginBottom: spacing.xs,
  },
  aiHarvestBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginTop: spacing.xs,
  },
  harvestReady: { backgroundColor: colors.primaryLight },
  harvestSoon: { backgroundColor: "#FFF3CD" },
  harvestNotYet: { backgroundColor: colors.backgroundTertiary },
  harvestOverdue: { backgroundColor: "#FEE2E2" },
  aiHarvestText: {
    fontSize: fonts.caption,
    fontWeight: "600",
    color: colors.textPrimary,
  },

  aiStatsRow: {
    flexDirection: "row",
    marginBottom: spacing.md,
  },
  aiStat: {
    flex: 1,
    // backgroundColor is inlined per-instance from scoreTintBg(score)
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginRight: spacing.sm,
  },
  aiStatLast: {
    marginRight: 0,
  },
  aiStatLabel: {
    fontSize: 10,
    color: colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  aiStatValue: {
    fontSize: fonts.caption,
    fontWeight: "600",
    color: colors.textPrimary,
  },

  aiInsight: {
    fontSize: fonts.caption,
    color: colors.textPrimary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },

  aiTip: {
    // backgroundColor is inlined per-instance from scoreTintBg(score)
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  aiTipText: {
    fontSize: fonts.small,
    color: colors.textPrimary,
    lineHeight: 18,
  },

  aiSeasonal: {
    fontSize: fonts.small,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },

  aiPriceSection: {
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    // borderTopColor is inlined per-instance from scoreTintBg(score)
  },
  aiMarket: {
    fontSize: fonts.small,
    color: colors.textSecondary,
    fontStyle: "italic",
    marginTop: spacing.sm,
  },
});
