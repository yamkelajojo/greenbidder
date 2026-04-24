import React, { useMemo, useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { scoreToColor } from "../../utils/scoreColor";
import { colors, spacing, fonts, radius } from "../../config/theme";
import { formatZAR } from "../../utils/formatters";

/**
 * ═══════════════════════════════════════════════════════════════════════
 *   AIPriceScale — horizontal price-range instrument
 *
 *   Inspired by the TUNE/FADE arc indicators on Teenage Engineering
 *   hardware: a clean track, end-cap nodes, a glowing tick where the
 *   current value sits. We've laid it horizontal for text-reading flow
 *   and baked it into the glass aesthetic of the rest of the AI card.
 *
 *   It shows the farmer's asking price against the AI's estimated
 *   min–max range, colored by the AI's explicit price_assessment verdict:
 *     - fair         → score-tinted green (harmonises with condition_score)
 *     - underpriced  → cool teal/blue (signals "buyer's bargain")
 *     - overpriced   → warm amber (attention, but not alarm)
 *
 *   When the asking price sits OUTSIDE the estimated range, we clamp the
 *   tick to 0% or 100% and show the verdict pill with its margin_percent
 *   — the number tells the real story.
 *
 *   Typography: prices use tabular-nums (monospaced digits) for that
 *   precision-instrument readout feel, without needing a custom font.
 *
 *   Props:
 *     - minPrice, maxPrice     (AI's suggested range, required)
 *     - askingPrice            (farmer's actual price — optional)
 *     - unit                   (e.g., "kg")
 *     - priceAssessment        ({verdict, margin_percent, reasoning} or null)
 *     - conditionScore         (for harmonising "fair" fill with card tint)
 * ═══════════════════════════════════════════════════════════════════════
 */

// ─── Verdict color mapping ───
// fair: derived from score so it visually belongs to the rest of the card
// under/over: deliberate non-score tones so the assessment reads distinctly
function verdictColors(verdict, conditionScore) {
  if (verdict === "underpriced") {
    return {
      fill: "rgba(54, 138, 170, 0.48)",
      fillPeak: "rgba(54, 138, 170, 0.65)",
      tick: "rgb(42, 112, 140)",
      tickGlow: "rgba(54, 138, 170, 0.45)",
      pill: "rgba(54, 138, 170, 0.12)",
      pillText: "rgb(32, 88, 112)",
      pillBorder: "rgba(54, 138, 170, 0.35)",
    };
  }
  if (verdict === "overpriced") {
    return {
      fill: "rgba(212, 130, 42, 0.45)",
      fillPeak: "rgba(212, 130, 42, 0.62)",
      tick: "rgb(176, 102, 24)",
      tickGlow: "rgba(212, 130, 42, 0.48)",
      pill: "rgba(212, 130, 42, 0.13)",
      pillText: "rgb(140, 82, 16)",
      pillBorder: "rgba(212, 130, 42, 0.38)",
    };
  }
  // fair (or null/unknown) — harmonise with the card's score tint
  const [r, g, b] = scoreToColor(conditionScore ?? 7.5);
  return {
    fill: `rgba(${r}, ${g}, ${b}, 0.42)`,
    fillPeak: `rgba(${r}, ${g}, ${b}, 0.6)`,
    tick: `rgb(${Math.round(r * 0.72)}, ${Math.round(g * 0.72)}, ${Math.round(b * 0.72)})`,
    tickGlow: `rgba(${r}, ${g}, ${b}, 0.5)`,
    pill: `rgba(${r}, ${g}, ${b}, 0.13)`,
    pillText: `rgb(${Math.round(r * 0.55)}, ${Math.round(g * 0.55)}, ${Math.round(b * 0.55)})`,
    pillBorder: `rgba(${r}, ${g}, ${b}, 0.38)`,
  };
}

/**
 * Verdict → pill label. Uses the signed margin_percent when available
 * to give the number directly: "+12% above" / "-8% below" / "in range".
 */
function verdictLabel(verdict, margin) {
  if (verdict === "overpriced") {
    return margin != null
      ? `+${Math.round(Math.abs(margin))}% ABOVE`
      : "ABOVE RANGE";
  }
  if (verdict === "underpriced") {
    return margin != null
      ? `−${Math.round(Math.abs(margin))}% BELOW`
      : "BELOW RANGE";
  }
  return "IN RANGE";
}

export default function AIPriceScale({
  minPrice,
  maxPrice,
  askingPrice,
  unit = "kg",
  priceAssessment = null,
  conditionScore = null,
}) {
  // Guard — don't render if we don't even have a range
  if (minPrice == null || maxPrice == null) return null;

  const verdict = priceAssessment?.verdict || null;
  const margin = priceAssessment?.margin_percent ?? null;
  const hasAsking = typeof askingPrice === "number" && askingPrice > 0;

  const palette = useMemo(
    () => verdictColors(verdict, conditionScore),
    [verdict, conditionScore],
  );

  // Tick position 0..1 along the track. Clamp to [0, 1] so out-of-range
  // asking prices still render the tick at the correct extreme.
  const tickPosition = useMemo(() => {
    if (!hasAsking) return 0.5;
    const range = maxPrice - minPrice;
    if (range <= 0) return 0.5;
    return Math.max(0, Math.min(1, (askingPrice - minPrice) / range));
  }, [askingPrice, minPrice, maxPrice, hasAsking]);

  // ─── Animations ───
  // Fill grows in on mount, tick slides in a beat after, glow breathes.
  const fillProgress = useSharedValue(0);
  const tickAppear = useSharedValue(0);
  const glowBreath = useSharedValue(0);

  useEffect(() => {
    fillProgress.value = withDelay(
      120,
      withTiming(tickPosition, {
        duration: 720,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
      }),
    );
    tickAppear.value = withDelay(
      260,
      withTiming(1, {
        duration: 360,
        easing: Easing.bezier(0.34, 1.35, 0.64, 1),
      }),
    );
    glowBreath.value = withDelay(
      900,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );
  }, [tickPosition]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fillProgress.value * 100}%`,
  }));

  const tickWrapStyle = useAnimatedStyle(() => ({
    left: `${fillProgress.value * 100}%`,
    opacity: tickAppear.value,
    transform: [
      {
        scale: interpolate(
          tickAppear.value,
          [0, 1],
          [0.3, 1],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glowBreath.value, [0, 1], [0.35, 0.7]),
    transform: [{ scale: interpolate(glowBreath.value, [0, 1], [1, 1.25]) }],
  }));

  // ─── Render ───
  const midPrice = (minPrice + maxPrice) / 2;

  return (
    <View style={styles.container}>
      {/* Header row: label + verdict pill */}
      <View style={styles.headerRow}>
        <Text style={styles.label}>AI SUGGESTED RANGE</Text>

        {hasAsking && verdict ? (
          <View
            style={[
              styles.verdictPill,
              {
                backgroundColor: palette.pill,
                borderColor: palette.pillBorder,
              },
            ]}
          >
            <Text style={[styles.verdictText, { color: palette.pillText }]}>
              {verdictLabel(verdict, margin)}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Price readout row — min, midpoint / farmer price, max */}
      <View style={styles.priceRow}>
        <View style={styles.priceSide}>
          <Text style={styles.priceTinyLabel}>MIN</Text>
          <Text style={styles.priceValue}>{formatZAR(minPrice)}</Text>
        </View>

        <View style={styles.priceCenter}>
          {hasAsking ? (
            <>
              <Text style={styles.priceTinyLabel}>YOUR PRICE</Text>
              <Text
                style={[styles.priceValueStrong, { color: palette.pillText }]}
              >
                {formatZAR(askingPrice)}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.priceTinyLabel}>MIDPOINT</Text>
              <Text style={styles.priceValue}>{formatZAR(midPrice)}</Text>
            </>
          )}
        </View>

        <View style={styles.priceSideRight}>
          <Text style={styles.priceTinyLabel}>MAX</Text>
          <Text style={styles.priceValue}>{formatZAR(maxPrice)}</Text>
        </View>
      </View>

      {/* The instrument track itself */}

      {/* Assessment reasoning — quiet, italic, single line */}
      {priceAssessment?.reasoning ? (
        <Text style={styles.reasoning}>{priceAssessment.reasoning}</Text>
      ) : null}
    </View>
  );
}

// ─── Styles ───
const TRACK_HEIGHT = 6;
const TICK_SIZE = 14;
const GLOW_SIZE = 30;
const END_CAP_SIZE = 8;

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },

  // ─── Header row ───
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textSecondary,
    letterSpacing: 1.2,
  },
  verdictPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  verdictText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    fontVariant: ["tabular-nums"],
  },

  // ─── Price readout ───
  priceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: spacing.sm,
  },
  priceSide: {
    flex: 1,
    alignItems: "flex-start",
  },
  priceCenter: {
    flex: 1.2,
    alignItems: "center",
  },
  priceSideRight: {
    flex: 1,
    alignItems: "flex-end",
  },
  priceTinyLabel: {
    fontSize: 9,
    fontWeight: "600",
    color: colors.textTertiary,
    letterSpacing: 0.7,
    marginBottom: 2,
  },
  priceValue: {
    fontSize: fonts.caption,
    fontWeight: "600",
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  priceValueStrong: {
    fontSize: fonts.body,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },

  // ─── Track + instrument ───
  trackWrap: {
    height: TICK_SIZE + 6,
    justifyContent: "center",
    marginHorizontal: END_CAP_SIZE / 2,
    position: "relative",
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: "rgba(60, 55, 50, 0.08)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(60, 55, 50, 0.12)",
    overflow: "visible",
  },
  fillWrap: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderTopLeftRadius: TRACK_HEIGHT / 2,
    borderBottomLeftRadius: TRACK_HEIGHT / 2,
    overflow: "hidden",
  },
  endCap: {
    position: "absolute",
    top: (TRACK_HEIGHT - END_CAP_SIZE) / 2,
    width: END_CAP_SIZE,
    height: END_CAP_SIZE,
    borderRadius: END_CAP_SIZE / 2,
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(60, 55, 50, 0.35)",
  },
  endCapLeft: {
    left: -END_CAP_SIZE / 2,
  },
  endCapRight: {
    right: -END_CAP_SIZE / 2,
  },
  midMarker: {
    position: "absolute",
    left: "50%",
    top: -2,
    marginLeft: -0.5,
    width: 1,
    height: TRACK_HEIGHT + 4,
    backgroundColor: "rgba(60, 55, 50, 0.22)",
  },

  // ─── Tick marker ───
  tickWrap: {
    position: "absolute",
    top: "50%",
    marginTop: -TICK_SIZE / 2,
    marginLeft: -TICK_SIZE / 2,
    width: TICK_SIZE,
    height: TICK_SIZE,
    justifyContent: "center",
    alignItems: "center",
  },
  tickGlow: {
    position: "absolute",
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    borderRadius: GLOW_SIZE / 2,
  },
  tick: {
    width: TICK_SIZE,
    height: TICK_SIZE,
    borderRadius: TICK_SIZE / 2,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },

  // ─── Reasoning ───
  reasoning: {
    fontSize: fonts.small,
    color: colors.textSecondary,
    fontStyle: "italic",
    marginTop: spacing.sm,
    lineHeight: 18,
  },
});
