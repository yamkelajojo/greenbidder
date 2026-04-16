import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { getFarmerTrustProfile } from "../../services/reviewService";
import { timeAgo } from "../../utils/dateUtils";
import { colors, spacing, fonts, radius } from "../../config/theme";

export default function FarmerTrustCard({ farmerProfileId, compact = false }) {
  const [trust, setTrust] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTrust();
  }, [farmerProfileId]);

  const loadTrust = async () => {
    if (!farmerProfileId) return;
    setIsLoading(true);
    const { trustProfile } = await getFarmerTrustProfile(farmerProfileId);
    setTrust(trustProfile);
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <View style={[styles.container, compact && styles.containerCompact]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (!trust) {
    return (
      <View style={[styles.container, compact && styles.containerCompact]}>
        <Text style={styles.noReviews}>No reviews yet</Text>
        <Text style={styles.noReviewsSub}>
          Be the first to rate this farmer
        </Text>
      </View>
    );
  }

  // Badge logic
  const isTrusted = trust.totalReviews >= 5 && trust.rebuyPercent >= 70;
  const isTopFarmer = trust.totalReviews >= 10 && trust.rebuyPercent >= 85;

  if (compact) {
    return (
      <View style={[styles.container, styles.containerCompact]}>
        <View style={styles.compactRow}>
          <View style={styles.compactStat}>
            <Text style={styles.compactValue}>⭐ {trust.avgRating}</Text>
          </View>
          <View style={styles.compactDivider} />
          <View style={styles.compactStat}>
            <Text style={styles.compactValue}>
              {trust.totalReviews} review{trust.totalReviews !== 1 ? "s" : ""}
            </Text>
          </View>
          {isTopFarmer ? (
            <>
              <View style={styles.compactDivider} />
              <View style={styles.compactStat}>
                <Text style={styles.compactBadge}>⭐ Top Farmer</Text>
              </View>
            </>
          ) : isTrusted ? (
            <>
              <View style={styles.compactDivider} />
              <View style={styles.compactStat}>
                <Text style={styles.compactBadge}>✓ Trusted</Text>
              </View>
            </>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, isTopFarmer && styles.containerGold]}>
      {/* Header + badge */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Farmer Reviews</Text>
          {isTopFarmer ? (
            <View style={styles.badgeGold}>
              <Text style={styles.badgeGoldText}>⭐ Top Farmer</Text>
            </View>
          ) : isTrusted ? (
            <View style={styles.badgeGreen}>
              <Text style={styles.badgeGreenText}>✓ Trusted</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.ratingBadge}>
          <Text style={styles.ratingText}>⭐ {trust.avgRating}</Text>
        </View>
      </View>

      {/* Tags — only meaningful with 3+ reviews */}
      {trust.totalReviews >= 3 && trust.topTags.length > 0 ? (
        <View style={styles.tagsSection}>
          <View style={styles.tagsRow}>
            {trust.topTags.map((tag) => (
              <View
                key={tag.id}
                style={[
                  styles.tag,
                  tag.isPositive ? styles.tagPositive : styles.tagNegative,
                ]}
              >
                <Text style={styles.tagText}>
                  {tag.emoji} {tag.label}
                </Text>
                <Text style={styles.tagCount}>×{tag.count}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Individual reviews — always visible */}
      {trust.recentReviews.length > 0 ? (
        <View style={styles.reviewsSection}>
          {trust.recentReviews.slice(0, 3).map((review, i) => (
            <View key={i} style={styles.reviewItem}>
              <View style={styles.reviewHeader}>
                <Text style={styles.reviewerName}>{review.buyerName}</Text>
                <Text style={styles.reviewTime}>
                  {timeAgo(review.createdAt)}
                </Text>
              </View>
              {review.quality ? (
                <View style={styles.reviewPills}>
                  <View
                    style={[
                      styles.pill,
                      review.quality === "above"
                        ? styles.pillGood
                        : review.quality === "expected"
                          ? styles.pillOk
                          : styles.pillBad,
                    ]}
                  >
                    <Text style={styles.pillText}>
                      {review.quality === "above"
                        ? "🤩 Great quality"
                        : review.quality === "expected"
                          ? "😊 Good quality"
                          : "😕 Below expected"}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.pill,
                      review.accuracy === "exact"
                        ? styles.pillGood
                        : review.accuracy === "close"
                          ? styles.pillOk
                          : styles.pillBad,
                    ]}
                  >
                    <Text style={styles.pillText}>
                      {review.accuracy === "exact"
                        ? "✓ As pictured"
                        : review.accuracy === "close"
                          ? "~ Close enough"
                          : "✗ Different"}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.pill,
                      review.wouldBuyAgain === "yes"
                        ? styles.pillGood
                        : styles.pillBad,
                    ]}
                  >
                    <Text style={styles.pillText}>
                      {review.wouldBuyAgain === "yes"
                        ? "👍 Would rebuy"
                        : "👎 Wouldn't rebuy"}
                    </Text>
                  </View>
                </View>
              ) : null}
              {review.tags && review.tags.length > 0 ? (
                <View style={styles.reviewTagsRow}>
                  {review.tags.map((tagId) => {
                    const SHORT = {
                      fresh: "🌿Fresh",
                      well_packed: "📦Packed",
                      good_value: "💰Value",
                      fast_response: "⚡Fast",
                      generous: "🤲Generous",
                      as_described: "✅Accurate",
                      overripe: "🟤Overripe",
                      smaller: "📏Small",
                      late_response: "⏰Slow",
                      not_fresh: "🥀Stale",
                      damaged: "💔Damaged",
                      different_variety: "❓Diff",
                    };
                    const label = SHORT[tagId];
                    if (!label) return null;
                    const isPositive = [
                      "fresh",
                      "well_packed",
                      "good_value",
                      "fast_response",
                      "generous",
                      "as_described",
                    ].includes(tagId);
                    return (
                      <Text
                        key={tagId}
                        style={[
                          styles.microTag,
                          isPositive ? styles.microTagGood : styles.microTagBad,
                        ]}
                      >
                        {label}
                      </Text>
                    );
                  })}
                </View>
              ) : null}
              {review.text ? (
                <Text style={styles.reviewText} numberOfLines={2}>
                  "{review.text}"
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      <Text style={styles.footer}>
        Based on {trust.totalReviews} review
        {trust.totalReviews !== 1 ? "s" : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  containerCompact: { padding: spacing.sm },
  containerGold: {
    borderWidth: 1.5,
    borderColor: "#F59E0B",
  },
  noReviews: {
    fontSize: fonts.caption,
    color: colors.textSecondary,
    textAlign: "center",
  },
  noReviewsSub: {
    fontSize: fonts.small,
    color: colors.textTertiary,
    textAlign: "center",
    marginTop: 2,
  },
  compactRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  compactStat: { paddingHorizontal: spacing.sm },
  compactValue: {
    fontSize: fonts.caption,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  compactDivider: { width: 1, height: 16, backgroundColor: colors.border },
  compactBadge: {
    fontSize: fonts.small,
    fontWeight: "700",
    color: colors.primary,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontSize: fonts.body,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  badgeGreen: {
    marginTop: spacing.xs,
    alignSelf: "flex-start",
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  badgeGreenText: {
    fontSize: fonts.small,
    fontWeight: "700",
    color: colors.primaryDark,
  },
  badgeGold: {
    marginTop: spacing.xs,
    alignSelf: "flex-start",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  badgeGoldText: { fontSize: fonts.small, fontWeight: "700", color: "#92400E" },
  ratingBadge: {
    backgroundColor: colors.warning + "20",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  ratingText: {
    fontSize: fonts.caption,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  metricsRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  metric: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  metricValue: {
    fontSize: fonts.h2,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  metricLabel: {
    fontSize: fonts.small,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  metricBar: { height: 4, borderRadius: 2, maxWidth: "100%" },
  barGreen: { backgroundColor: colors.priceUp },
  barYellow: { backgroundColor: colors.warning },
  barRed: { backgroundColor: colors.danger },
  tagsSection: { marginBottom: spacing.md },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    gap: 4,
  },
  tagPositive: { backgroundColor: colors.primaryLight },
  tagNegative: { backgroundColor: "#FEE2E2" },
  tagText: { fontSize: fonts.small, color: colors.textPrimary },
  tagCount: { fontSize: 10, color: colors.textTertiary, fontWeight: "600" },
  reviewsSection: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  reviewItem: { marginBottom: spacing.sm },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  reviewerName: {
    fontSize: fonts.small,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  reviewTime: { fontSize: fonts.small, color: colors.textTertiary },
  reviewDimensions: { fontSize: 16, marginBottom: 4 },
  reviewText: {
    fontSize: fonts.small,
    color: colors.textSecondary,
    fontStyle: "italic",
    lineHeight: 18,
  },
  footer: {
    fontSize: fonts.small,
    color: colors.textTertiary,
    textAlign: "center",
  },
  reviewTagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 3,
    marginBottom: 3,
  },
  microTag: {
    fontSize: 9,
    fontWeight: "600",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: "hidden",
  },
  microTagGood: {
    backgroundColor: colors.primaryLight,
    color: colors.primaryDark,
  },
  microTagBad: {
    backgroundColor: "#FEE2E2",
    color: colors.danger,
  },
  reviewPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 4,
  },
  pill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  pillGood: { backgroundColor: colors.primaryLight },
  pillOk: { backgroundColor: "#FEF3C7" },
  pillBad: { backgroundColor: "#FEE2E2" },
  pillText: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.textPrimary,
  },
});
