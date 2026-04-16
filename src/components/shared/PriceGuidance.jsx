import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { supabase } from "../../config/supabase";
import { formatZAR } from "../../utils/formatters";
import { CATEGORY_ICONS } from "../../services/marketPriceService";
import { colors, spacing, fonts, radius } from "../../config/theme";

/**
 * Approximate conversion factors from per-kg to other units.
 * These are typical South African produce trade weights.
 * A bag of potatoes ≈ 7kg, a crate of tomatoes ≈ 16kg, etc.
 *
 * The farmer sees prices in their chosen unit so they can
 * directly compare without doing math in their head.
 */
const UNIT_MULTIPLIERS = {
  kg: 1,
  bag: 7,
  crate: 16,
  bunch: 0.5,
  each: 0.3,
};

/**
 * PriceGuidance — interactive pricing intelligence for farmers.
 *
 * Appears when a category is selected on the Create Listing screen.
 * Shows market reference, GreenBidder averages, and a visual gauge
 * that responds as the farmer types their price.
 *
 * Features:
 *   - Collapsible toggle (farmer controls visibility)
 *   - Unit-aware prices (converts per-kg references to per-bag, per-crate, etc.)
 *   - Animated gauge with spring physics
 *   - Plain-English feedback that non-tech-savvy farmers understand
 *
 * @param {Object} props
 * @param {string} props.categoryId - Selected category UUID
 * @param {string} props.categoryName - Category display name
 * @param {number|null} props.currentPrice - Farmer's typed price (null if empty)
 * @param {string} props.unit - Selected unit (kg, bag, crate, bunch, each)
 */
export default function PriceGuidance({
  categoryId,
  categoryName,
  currentPrice,
  unit,
}) {
  const [marketRefPerKg, setMarketRefPerKg] = useState(null);
  const [listingAvgPerKg, setListingAvgPerKg] = useState(null);
  const [listingRangePerKg, setListingRangePerKg] = useState(null);
  const [listingCount, setListingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hasAppeared, setHasAppeared] = useState(false);
  const markerAnim = useRef(new Animated.Value(0.5)).current;
  const collapseAnim = useRef(new Animated.Value(1)).current;

  // Convert per-kg prices to the farmer's selected unit
  const multiplier = UNIT_MULTIPLIERS[unit] || 1;
  const marketRef = marketRefPerKg ? marketRefPerKg * multiplier : null;
  const listingAvg = listingAvgPerKg ? listingAvgPerKg * multiplier : null;
  const listingRange = listingRangePerKg
    ? {
        min: listingRangePerKg.min * multiplier,
        max: listingRangePerKg.max * multiplier,
      }
    : null;

  useEffect(() => {
    if (categoryId) {
      loadPriceData();
      setHasAppeared(true);
    }
  }, [categoryId]);

  // Animate marker when price or unit changes
  useEffect(() => {
    if (!marketRef || currentPrice == null || currentPrice <= 0) {
      Animated.spring(markerAnim, {
        toValue: 0.5,
        useNativeDriver: false,
        tension: 40,
        friction: 8,
      }).start();
      return;
    }

    const ratio = currentPrice / marketRef;
    const position = Math.min(Math.max(ratio * 0.5, 0.05), 0.95);

    Animated.spring(markerAnim, {
      toValue: position,
      useNativeDriver: false,
      tension: 50,
      friction: 7,
    }).start();
  }, [currentPrice, marketRef, unit]);

  // Animate collapse/expand
  useEffect(() => {
    Animated.timing(collapseAnim, {
      toValue: isCollapsed ? 0 : 1,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [isCollapsed]);

  const loadPriceData = async () => {
    setIsLoading(true);
    try {
      // Market reference (stored per kg)
      const { data: refData } = await supabase
        .from("market_prices")
        .select("price_per_unit")
        .eq("category_id", categoryId)
        .order("recorded_date", { ascending: false })
        .limit(1)
        .single();

      if (refData) {
        setMarketRefPerKg(Number(refData.price_per_unit));
      }

      // GreenBidder listing prices (stored per unit the farmer chose,
      // but we normalise to per-kg for comparison)
      const { data: listings } = await supabase
        .from("listings")
        .select("price, unit")
        .eq("category_id", categoryId)
        .eq("status", "active");

      if (listings && listings.length > 0) {
        // Normalise all listing prices to per-kg
        const perKgPrices = listings.map((l) => {
          const m = UNIT_MULTIPLIERS[l.unit] || 1;
          return Number(l.price) / m;
        });
        const avg = perKgPrices.reduce((a, b) => a + b, 0) / perKgPrices.length;
        setListingAvgPerKg(avg);
        setListingRangePerKg({
          min: Math.min(...perKgPrices),
          max: Math.max(...perKgPrices),
        });
        setListingCount(listings.length);
      }
    } catch (err) {
      console.warn("Price guidance load failed:", err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getPriceFeedback = () => {
    if (!marketRef || currentPrice == null || currentPrice <= 0) {
      return {
        text: "Type a price to see how it compares",
        color: colors.textTertiary,
        emoji: "💡",
      };
    }

    const ratio = currentPrice / marketRef;

    if (ratio < 0.7) {
      return {
        text: "Very low — you might be undervaluing your produce",
        color: "#D97706",
        emoji: "⚠️",
      };
    }
    if (ratio < 0.9) {
      return {
        text: "Competitive price — will attract buyers quickly",
        color: colors.priceUp,
        emoji: "🔥",
      };
    }
    if (ratio <= 1.1) {
      return {
        text: "Sweet spot — right in line with the market",
        color: colors.primary,
        emoji: "✓",
      };
    }
    if (ratio <= 1.3) {
      return {
        text: "Above average — make sure quality justifies it",
        color: "#D97706",
        emoji: "📈",
      };
    }
    return {
      text: "Premium pricing — may reduce buyer interest",
      color: colors.danger,
      emoji: "⚡",
    };
  };

  const getGaugeColor = () => {
    if (!marketRef || currentPrice == null || currentPrice <= 0) {
      return colors.textTertiary;
    }
    const ratio = currentPrice / marketRef;
    if (ratio < 0.7) return "#D97706";
    if (ratio < 0.9) return colors.priceUp;
    if (ratio <= 1.1) return colors.primary;
    if (ratio <= 1.3) return "#D97706";
    return colors.danger;
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Loading price data...</Text>
        </View>
      </View>
    );
  }

  if (!marketRef && !listingAvg) return null;

  const icon = CATEGORY_ICONS[categoryName] || "🌿";
  const feedback = getPriceFeedback();
  const gaugeColor = getGaugeColor();
  const unitLabel = unit === "each" ? "per item" : `per ${unit}`;

  const markerLeft = markerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const bodyMaxHeight = collapseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 500],
  });

  const bodyOpacity = collapseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <View style={styles.container}>
      {/* Header — always visible, acts as toggle */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => setIsCollapsed(!isCollapsed)}
        activeOpacity={0.7}
      >
        <Text style={styles.headerIcon}>{icon}</Text>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Price Intelligence</Text>
          <Text style={styles.headerSubtitle}>
            {categoryName} · {unitLabel}
          </Text>
        </View>
        <Text style={styles.toggleIcon}>{isCollapsed ? "▼" : "▲"}</Text>
      </TouchableOpacity>

      {/* Collapsible body */}
      <Animated.View
        style={{
          maxHeight: bodyMaxHeight,
          opacity: bodyOpacity,
          overflow: "hidden",
        }}
      >
        {/* Price references */}
        <View style={styles.refRow}>
          {marketRef ? (
            <View style={styles.refBlock}>
              <Text style={styles.refLabel}>Market Ref</Text>
              <Text style={styles.refValue}>{formatZAR(marketRef)}</Text>
              <Text style={styles.refUnit}>{unitLabel}</Text>
            </View>
          ) : null}
          {listingAvg ? (
            <View style={styles.refBlock}>
              <Text style={styles.refLabel}>GreenBidder Avg</Text>
              <Text style={styles.refValue}>{formatZAR(listingAvg)}</Text>
              <Text style={styles.refUnit}>
                {listingCount} listing{listingCount !== 1 ? "s" : ""}
              </Text>
            </View>
          ) : null}
          {listingRange ? (
            <View style={styles.refBlock}>
              <Text style={styles.refLabel}>Range</Text>
              <Text style={styles.refValue}>
                {formatZAR(listingRange.min)} – {formatZAR(listingRange.max)}
              </Text>
              <Text style={styles.refUnit}>{unitLabel}</Text>
            </View>
          ) : null}
        </View>

        {/* Visual gauge */}
        <View style={styles.gaugeContainer}>
          <View style={styles.gaugeTrack}>
            <View style={[styles.gaugeZone, styles.zoneGreen]} />
            <View style={[styles.gaugeZone, styles.zoneYellow]} />
            <View style={[styles.gaugeZone, styles.zoneRed]} />
            <View style={styles.gaugeRefLine} />
            <Animated.View
              style={[
                styles.gaugeMarker,
                {
                  left: markerLeft,
                  backgroundColor: gaugeColor,
                  borderColor: gaugeColor,
                },
              ]}
            >
              {currentPrice > 0 ? (
                <Text style={styles.gaugeMarkerText}>R{currentPrice}</Text>
              ) : null}
            </Animated.View>
          </View>
          <View style={styles.gaugeLabels}>
            <Text style={styles.gaugeLabelText}>Low</Text>
            <Text style={styles.gaugeLabelCenter}>Market</Text>
            <Text style={styles.gaugeLabelText}>High</Text>
          </View>
        </View>

        {/* Feedback line */}
        <View style={[styles.feedbackRow, { borderLeftColor: gaugeColor }]}>
          <Text style={styles.feedbackEmoji}>{feedback.emoji}</Text>
          <Text style={[styles.feedbackText, { color: feedback.color }]}>
            {feedback.text}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary + "30",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.sm,
  },
  loadingText: {
    marginLeft: spacing.sm,
    fontSize: fonts.caption,
    color: colors.textSecondary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerIcon: { fontSize: 24, marginRight: spacing.sm },
  headerText: { flex: 1 },
  headerTitle: {
    fontSize: fonts.caption,
    fontWeight: "700",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  headerSubtitle: {
    fontSize: fonts.small,
    color: colors.textSecondary,
    marginTop: 1,
  },
  toggleIcon: {
    fontSize: 12,
    color: colors.textTertiary,
    paddingLeft: spacing.sm,
  },
  refRow: {
    flexDirection: "row",
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  refBlock: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radius.sm,
    marginRight: spacing.xs,
  },
  refLabel: {
    fontSize: 9,
    color: colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  refValue: {
    fontSize: fonts.caption,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  refUnit: {
    fontSize: 9,
    color: colors.textTertiary,
    marginTop: 1,
  },
  gaugeContainer: {
    marginBottom: spacing.md,
  },
  gaugeTrack: {
    height: 8,
    borderRadius: 4,
    flexDirection: "row",
    overflow: "visible",
    position: "relative",
    backgroundColor: colors.backgroundTertiary,
  },
  gaugeZone: { flex: 1, height: 8 },
  zoneGreen: {
    backgroundColor: colors.priceUp + "40",
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  zoneYellow: { backgroundColor: colors.warning + "30" },
  zoneRed: {
    backgroundColor: colors.danger + "25",
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  gaugeRefLine: {
    position: "absolute",
    left: "50%",
    top: -3,
    width: 2,
    height: 14,
    backgroundColor: colors.textSecondary,
    borderRadius: 1,
    zIndex: 5,
  },
  gaugeMarker: {
    position: "absolute",
    top: -10,
    width: 28,
    height: 28,
    borderRadius: 14,
    marginLeft: -14,
    borderWidth: 2.5,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  gaugeMarkerText: {
    fontSize: 7,
    fontWeight: "800",
    color: "#fff",
  },
  gaugeLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  gaugeLabelText: { fontSize: 9, color: colors.textTertiary },
  gaugeLabelCenter: {
    fontSize: 9,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  feedbackRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: spacing.sm,
    borderLeftWidth: 3,
  },
  feedbackEmoji: { fontSize: 14, marginRight: spacing.sm },
  feedbackText: {
    fontSize: fonts.small,
    fontWeight: "500",
    flex: 1,
    lineHeight: 18,
  },
});
