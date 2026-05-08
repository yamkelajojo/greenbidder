import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import Animated, {
  FadeInDown,
  FadeOutUp,
  LinearTransition,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import {
  fetchWorldBankInflation,
  getReferencePrices,
  getListingAverages,
  mergePriceData,
} from "../../services/marketPriceService";
import { formatZAR } from "../../utils/formatters";
import { colors, spacing, fonts, radius } from "../../config/theme";

/**
 * Market Prices screen — a price intelligence dashboard.
 *
 * Answers the farmer's question: "Am I pricing my produce right?"
 * Answers the buyer's question: "Is this a fair deal?"
 *
 * Data sources:
 *   1. World Bank — SA food inflation (live API, no key)
 *   2. FAO reference — baseline per-crop prices (market_prices table)
 *   3. GreenBidder listings — what farmers are actually charging
 *
 * Criterion 8 — functional screen | Criterion 3 — optimised queries
 */
export default function MarketPricesScreen() {
  const [mergedPrices, setMergedPrices] = useState([]);
  const [inflation, setInflation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [])
  );

  const loadAll = async () => {
    setIsLoading(true);

    // Parallel fetch — all three sources at once
    const [wbResult, refResult, avgResult] = await Promise.all([
      fetchWorldBankInflation(),
      getReferencePrices(),
      getListingAverages(),
    ]);

    if (wbResult.data) setInflation(wbResult.data);

    const refs = refResult.data || [];
    const avgs = avgResult.data || [];
    setMergedPrices(mergePriceData(refs, avgs));

    setIsLoading(false);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadAll();
    setIsRefreshing(false);
  };

  // ── Header: Market Overview ──────────────────────────────────
  const renderHeader = () => {
    const latestRate = inflation?.[0];
    const previousRate = inflation?.[1];
    const rateDirection =
      latestRate && previousRate
        ? parseFloat(latestRate.rate) > parseFloat(previousRate.rate)
          ? "rising"
          : "falling"
        : null;

    return (
      <View>
        {/* Market pulse card */}
        <View style={styles.pulseCard}>
          <Text style={styles.pulseTitle}>Market Pulse</Text>

          {latestRate ? (
            <View>
              <View style={styles.pulseMain}>
                <Text style={styles.pulseRate}>{latestRate.rate}%</Text>
                <View style={styles.pulseContext}>
                  <Text style={styles.pulseLabel}>
                    SA Food Inflation ({latestRate.year})
                  </Text>
                  {rateDirection ? (
                    <Text
                      style={[
                        styles.pulseDirection,
                        rateDirection === "rising"
                          ? styles.trendUp
                          : styles.trendDown,
                      ]}
                    >
                      {rateDirection === "rising" ? "▲" : "▼"}{" "}
                      {rateDirection === "rising"
                        ? "Prices are rising — sellers may get better margins"
                        : "Prices are easing — good time for buyers"}
                    </Text>
                  ) : null}
                </View>
              </View>

              {/* Mini timeline */}
              <View style={styles.timeline}>
                {inflation.slice(0, 4).reverse().map((item, i) => (
                  <View key={i} style={styles.timelineItem}>
                    <View
                      style={[
                        styles.timelineDot,
                        parseFloat(item.rate) > 5
                          ? styles.dotHigh
                          : styles.dotLow,
                      ]}
                    />
                    <Text style={styles.timelineYear}>{item.year}</Text>
                    <Text style={styles.timelineRate}>{item.rate}%</Text>
                  </View>
                ))}
              </View>

              <Text style={styles.pulseSource}>
                Source: World Bank Open Data API
              </Text>
            </View>
          ) : (
            <Text style={styles.pulseUnavailable}>
              Live data loading...
            </Text>
          )}
        </View>

        {/* Section divider */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Price by Produce</Text>
          <Text style={styles.sectionSubtitle}>
            Market reference vs what farmers are charging
          </Text>
        </View>
      </View>
    );
  };

  // ── Category Price Card ──────────────────────────────────────
  const renderPriceCard = ({ item, index }) => {
    const hasListing = item.listing !== null;
    const trendColor =
      item.trend === "up"
        ? colors.priceDown
        : item.trend === "down"
          ? colors.priceUp
          : colors.priceStable;
    const trendArrow =
      item.trend === "up" ? "▲" : item.trend === "down" ? "▼" : "●";

    // Visual price bar — shows where listing avg sits relative to reference
    const barPercent = hasListing
      ? Math.min(Math.max((item.listing.avgPrice / item.referencePrice) * 50, 10), 95)
      : 50;

    return (
      <Animated.View
        entering={FadeInDown.delay(index * 45).duration(340)}
        exiting={FadeOutUp.duration(220)}
        layout={LinearTransition.springify().damping(20).stiffness(220)}
      >
      <View style={styles.card}>
        {/* Card header: emoji + name + trend */}
        <View style={styles.cardHeader}>
          <View style={styles.cardIdentity}>
            <Text style={styles.cardIcon}>{item.icon}</Text>
            <View>
              <Text style={styles.cardName}>{item.name}</Text>
              <Text style={styles.cardSource}>Ref: {item.source}</Text>
            </View>
          </View>
          {hasListing ? (
            <View style={[styles.trendBadge, { backgroundColor: trendColor + "18" }]}>
              <Text style={[styles.trendText, { color: trendColor }]}>
                {trendArrow}{" "}
                {item.diffPercent !== null
                  ? `${item.diffPercent > 0 ? "+" : ""}${item.diffPercent.toFixed(0)}%`
                  : ""}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Price comparison */}
        <View style={styles.priceComparison}>
          <View style={styles.priceColumn}>
            <Text style={styles.priceLabel}>Market Ref</Text>
            <Text style={styles.refPrice}>
              {formatZAR(item.referencePrice)}
            </Text>
            <Text style={styles.perUnit}>per {item.unit}</Text>
          </View>

          {hasListing ? (
            <View style={styles.priceColumn}>
              <Text style={styles.priceLabel}>GreenBidder Avg</Text>
              <Text style={[styles.gbPrice, { color: trendColor }]}>
                {formatZAR(item.listing.avgPrice)}
              </Text>
              <Text style={styles.perUnit}>per {item.unit}</Text>
            </View>
          ) : (
            <View style={styles.priceColumn}>
              <Text style={styles.priceLabel}>GreenBidder</Text>
              <Text style={styles.noListings}>No listings</Text>
            </View>
          )}

          {hasListing ? (
            <View style={styles.priceColumn}>
              <Text style={styles.priceLabel}>Range</Text>
              <Text style={styles.rangeText}>
                {formatZAR(item.listing.minPrice)}
              </Text>
              <Text style={styles.rangeTo}>
                to {formatZAR(item.listing.maxPrice)}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Visual price bar */}
        {hasListing ? (
          <View style={styles.barContainer}>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { width: `${barPercent}%`, backgroundColor: trendColor },
                ]}
              />
              {/* Market reference marker at 50% */}
              <View style={styles.barMarker} />
            </View>
            <View style={styles.barLabels}>
              <Text style={styles.barLabel}>Low</Text>
              <Text style={styles.barLabelCenter}>Market Ref</Text>
              <Text style={styles.barLabel}>High</Text>
            </View>
          </View>
        ) : null}

        {/* Insight line */}
        <View style={styles.insightRow}>
          <Text style={styles.insightText}>{item.insight}</Text>
        </View>

        {/* Supply info */}
        {hasListing ? (
          <View style={styles.supplyRow}>
            <Text style={styles.supplyText}>
              {item.listing.listingCount} listing
              {item.listing.listingCount !== 1 ? "s" : ""} ·{" "}
              {item.listing.totalQuantity.toLocaleString()} {item.unit}s
              available
            </Text>
          </View>
        ) : null}
      </View>
      </Animated.View>
    );
  };

  // ── Empty state ──────────────────────────────────────────────
  const renderEmpty = () => (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>📊</Text>
      <Text style={styles.emptyTitle}>No price data yet</Text>
      <Text style={styles.emptyText}>
        Market prices will appear here as data becomes available
      </Text>
    </View>
  );

  // ── Loading ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loaderText}>Loading market data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Market Prices</Text>
        <Text style={styles.subtitle}>
          Price intelligence for smarter decisions
        </Text>
      </View>

      <FlatList
        data={mergedPrices}
        renderItem={renderPriceCard}
        keyExtractor={(item) => item.categoryId}
        contentContainerStyle={styles.list}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundSecondary },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  loaderText: {
    marginTop: spacing.md,
    fontSize: fonts.caption,
    color: colors.textSecondary,
  },

  // Header
  header: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  title: { fontSize: fonts.h1, fontWeight: "700", color: colors.textPrimary },
  subtitle: {
    fontSize: fonts.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },

  list: { padding: spacing.md, paddingBottom: spacing.xxl },

  // ── Market Pulse Card ──
  pulseCard: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  pulseTitle: {
    fontSize: fonts.small,
    fontWeight: "600",
    color: colors.info,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  pulseMain: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  pulseRate: {
    fontSize: 36,
    fontWeight: "800",
    color: colors.textPrimary,
    marginRight: spacing.md,
  },
  pulseContext: { flex: 1, paddingTop: 4 },
  pulseLabel: {
    fontSize: fonts.caption,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  pulseDirection: { fontSize: fonts.small, fontWeight: "500", lineHeight: 18 },
  pulseUnavailable: { fontSize: fonts.caption, color: colors.textTertiary },

  // Timeline
  timeline: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  timelineItem: { alignItems: "center", flex: 1 },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: 4,
  },
  dotHigh: { backgroundColor: colors.priceDown },
  dotLow: { backgroundColor: colors.priceUp },
  timelineYear: { fontSize: fonts.small, color: colors.textTertiary },
  timelineRate: {
    fontSize: fonts.caption,
    fontWeight: "600",
    color: colors.textPrimary,
    marginTop: 2,
  },
  pulseSource: {
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: spacing.sm,
    textAlign: "right",
    fontStyle: "italic",
  },

  // ── Section Header ──
  sectionHeader: { marginTop: spacing.sm, marginBottom: spacing.sm },
  sectionTitle: {
    fontSize: fonts.h3,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: fonts.small,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // ── Category Card ──
  card: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  cardIdentity: { flexDirection: "row", alignItems: "center" },
  cardIcon: { fontSize: 28, marginRight: spacing.sm },
  cardName: { fontSize: fonts.body, fontWeight: "600", color: colors.textPrimary },
  cardSource: { fontSize: fonts.small, color: colors.textTertiary },
  trendBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  trendText: { fontSize: fonts.caption, fontWeight: "700" },

  // Price comparison columns
  priceComparison: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  priceColumn: { flex: 1, alignItems: "center" },
  priceLabel: {
    fontSize: 10,
    color: colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  refPrice: { fontSize: fonts.body, fontWeight: "600", color: colors.textPrimary },
  gbPrice: { fontSize: fonts.body, fontWeight: "700" },
  perUnit: { fontSize: fonts.small, color: colors.textTertiary, marginTop: 2 },
  noListings: {
    fontSize: fonts.caption,
    color: colors.textTertiary,
    fontStyle: "italic",
  },
  rangeText: { fontSize: fonts.caption, fontWeight: "500", color: colors.textSecondary },
  rangeTo: { fontSize: fonts.small, color: colors.textTertiary, marginTop: 2 },

  // Visual price bar
  barContainer: { marginBottom: spacing.md },
  barTrack: {
    height: 6,
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 3,
    overflow: "hidden",
    position: "relative",
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
  barMarker: {
    position: "absolute",
    left: "50%",
    top: -2,
    width: 2,
    height: 10,
    backgroundColor: colors.textSecondary,
    borderRadius: 1,
  },
  barLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  barLabel: { fontSize: 10, color: colors.textTertiary },
  barLabelCenter: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: "500",
  },

  // Insight
  insightRow: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  insightText: {
    fontSize: fonts.small,
    color: colors.textSecondary,
    textAlign: "center",
    fontStyle: "italic",
  },

  // Supply
  supplyRow: {
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  supplyText: { fontSize: fonts.small, color: colors.textTertiary },

  // Trend colors
  trendUp: { color: colors.priceDown },
  trendDown: { color: colors.priceUp },

  // Empty
  empty: { alignItems: "center", paddingTop: spacing.xxl },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: {
    fontSize: fonts.h2,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  emptyText: {
    fontSize: fonts.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: "center",
  },
});
