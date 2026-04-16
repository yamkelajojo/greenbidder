import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../../hooks/useAuth";
import {
  getActiveListings,
  getCategories,
} from "../../services/listingService";
import { getRecommendations } from "../../services/recommendationEngine";
import { trackCategoryFilter } from "../../services/trackingService";
import { formatZAR } from "../../utils/formatters";
import { timeAgo } from "../../utils/dateUtils";
import { CATEGORY_ICONS } from "../../services/marketPriceService";
import { colors, spacing, fonts, radius } from "../../config/theme";

/**
 * Buyer Feed — the heart of GreenBidder's buyer experience.
 *
 * This screen answers: "What should I buy today?"
 *
 * Layout when no filter is active:
 *   ┌─────────────────────────────┐
 *   │  Fresh Produce              │
 *   │  Direct from local farmers  │
 *   ├─────────────────────────────┤
 *   │  [All] [Tomatoes] [Onions]  │  ← category filters (tracked)
 *   ├─────────────────────────────┤
 *   │  ✨ Picked for You          │  ← horizontal recommendation row
 *   │  [card] [card] [card] →     │     (personalised or popular)
 *   ├─────────────────────────────┤
 *   │  Latest Listings            │  ← chronological feed
 *   │  ┌───────────────────────┐  │
 *   │  │  Full listing card    │  │
 *   │  └───────────────────────┘  │
 *   └─────────────────────────────┘
 *
 * Layout when a category filter is active:
 *   Recommendations hidden, only filtered results shown.
 *
 * Criterion 8 — CRUD Read, end-to-end
 * Criterion 3 — Parallel queries, joins, no N+1
 */
export default function BuyerFeedScreen({ navigation }) {
  const { profileId, isBuyer } = useAuth();

  // Data
  const [listings, setListings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [profileSummary, setProfileSummary] = useState(null);
  const [isPersonalised, setIsPersonalised] = useState(false);

  // UI
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [profileId]),
  );

  /**
   * Loads everything in parallel — categories, recommendations, and listings.
   * Parallel fetch keeps the feed feeling instant.
   */
  const loadAll = async () => {
    setIsLoading(true);

    const [catResult, recResult, listResult] = await Promise.all([
      getCategories(),
      isBuyer
        ? getRecommendations(profileId, 10)
        : Promise.resolve({
            recommendations: [],
            isPersonalised: false,
            profileSummary: null,
          }),
      getActiveListings({ limit: 30 }),
    ]);

    if (catResult.data) setCategories(catResult.data);

    setRecommendations(recResult.recommendations || []);
    setIsPersonalised(recResult.isPersonalised || false);
    setProfileSummary(recResult.profileSummary || null);

    if (listResult.data) setListings(listResult.data);

    setIsLoading(false);
  };

  const loadFilteredListings = async (categoryId) => {
    setIsLoading(true);
    const filters = {};
    if (categoryId) filters.categoryId = categoryId;
    const { data } = await getActiveListings(filters);
    if (data) setListings(data);
    setIsLoading(false);
  };

  /**
   * Handles category filter tap — loads filtered results AND
   * tracks the interaction for the recommendation engine.
   */
  const handleCategoryPress = (catId) => {
    const newCategory = selectedCategory === catId ? null : catId;
    setSelectedCategory(newCategory);

    if (newCategory) {
      // Track this filter tap — it's an explicit interest signal
      if (isBuyer && profileId) {
        const cat = categories.find((c) => c.id === newCategory);
        if (cat) {
          trackCategoryFilter(profileId, newCategory, cat.name, 0);
        }
      }
      loadFilteredListings(newCategory);
    } else {
      loadAll();
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (selectedCategory) {
      await loadFilteredListings(selectedCategory);
    } else {
      await loadAll();
    }
    setIsRefreshing(false);
  };

  // ── Recommendation Card (horizontal scroll) ──────────────────
  const renderRecommendationCard = (item) => {
    const primaryImage = item.listing_images?.find((img) => img.is_primary);
    const imageUrl =
      primaryImage?.image_url || item.listing_images?.[0]?.image_url;
    const aiScore = item.ai_analysis?.condition_score;
    const icon = CATEGORY_ICONS[item.produce_categories?.name] || "🌿";

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.recCard}
        onPress={() =>
          navigation.navigate("ListingDetail", { listingId: item.id })
        }
        activeOpacity={0.85}
      >
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.recImage} />
        ) : (
          <View style={styles.recImagePlaceholder}>
            <Text style={styles.recPlaceholderEmoji}>{icon}</Text>
          </View>
        )}

        {/* AI score badge */}
        {aiScore ? (
          <View style={styles.recAiBadge}>
            <Text style={styles.recAiBadgeText}>{aiScore}</Text>
          </View>
        ) : null}

        <View style={styles.recContent}>
          <Text style={styles.recCategory}>
            {item.produce_categories?.name}
          </Text>
          <Text style={styles.recTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.recPrice}>
            {formatZAR(item.price)}/{item.unit}
          </Text>
          <Text style={styles.recFarm} numberOfLines={1}>
            {item.farmer_profiles?.farm_name}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // ── Recommendation Section ───────────────────────────────────
  const renderRecommendationSection = () => {
    if (selectedCategory || recommendations.length === 0) return null;

    return (
      <View style={styles.recSection}>
        {/* Section header */}
        <View style={styles.recHeader}>
          <View>
            <Text style={styles.recSectionTitle}>
              {isPersonalised ? "✨ Picked for You" : "🔥 Popular Right Now"}
            </Text>
            {isPersonalised && profileSummary?.topCategories?.length > 0 ? (
              <Text style={styles.recSectionHint}>
                Based on your interest in{" "}
                {profileSummary.topCategories
                  .slice(0, 2)
                  .map((c) => c.categoryName)
                  .join(" & ")}
              </Text>
            ) : !isPersonalised && profileSummary?.warmUpRemaining > 0 ? (
              <Text style={styles.recSectionHint}>
                Browse {profileSummary.warmUpRemaining} more listing
                {profileSummary.warmUpRemaining !== 1 ? "s" : ""} to unlock
                personalised picks
              </Text>
            ) : null}
          </View>
        </View>

        {/* Horizontal scrollable recommendation cards */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.recScroll}
        >
          {recommendations.map(renderRecommendationCard)}
        </ScrollView>
      </View>
    );
  };

  // ── Full Listing Card (vertical feed) ────────────────────────
  const renderListing = ({ item }) => {
    const primaryImage = item.listing_images?.find((img) => img.is_primary);
    const imageUrl =
      primaryImage?.image_url || item.listing_images?.[0]?.image_url;
    const aiScore = item.ai_analysis?.condition_score;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() =>
          navigation.navigate("ListingDetail", { listingId: item.id })
        }
        activeOpacity={0.8}
      >
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.cardImage} />
        ) : (
          <View style={styles.cardImagePlaceholder}>
            <Text style={styles.placeholderText}>No photo</Text>
          </View>
        )}

        {aiScore ? (
          <View style={styles.aiBadge}>
            <Text style={styles.aiBadgeText}>AI {aiScore}/10</Text>
          </View>
        ) : null}

        <View style={styles.cardContent}>
          <View style={styles.cardTopRow}>
            <Text style={styles.categoryLabel}>
              {item.produce_categories?.name}
            </Text>
            {item.farmer_profiles?.is_verified ? (
              <Text style={styles.verifiedBadge}>✓ Verified</Text>
            ) : null}
          </View>

          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.title}
          </Text>

          <View style={styles.cardPriceRow}>
            <Text style={styles.cardPrice}>
              {formatZAR(item.price)}/{item.unit}
            </Text>
            <Text style={styles.cardQuantity}>
              {item.quantity} {item.unit}s
            </Text>
          </View>

          <View style={styles.cardBottomRow}>
            <Text style={styles.farmName}>
              {item.farmer_profiles?.farm_name}
            </Text>
            <Text style={styles.timeText}>{timeAgo(item.created_at)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ── Feed Header (recommendations + section title) ────────────
  const renderFeedHeader = () => (
    <View>
      {renderRecommendationSection()}

      {/* "Latest" section divider */}
      <View style={styles.sectionDivider}>
        <Text style={styles.sectionLabel}>
          {selectedCategory
            ? categories.find((c) => c.id === selectedCategory)?.name ||
              "Filtered"
            : "Latest Listings"}
        </Text>
        <Text style={styles.sectionCount}>
          {listings.length} listing{listings.length !== 1 ? "s" : ""}
        </Text>
      </View>
    </View>
  );

  // ── Empty State ──────────────────────────────────────────────
  const renderEmpty = () => (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>🔍</Text>
      <Text style={styles.emptyTitle}>No listings found</Text>
      <Text style={styles.emptyText}>
        {selectedCategory
          ? "Try selecting a different category"
          : "Check back soon — farmers are adding produce daily"}
      </Text>
    </View>
  );

  // ── Loading ──────────────────────────────────────────────────
  if (isLoading && listings.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.title}>Fresh Produce</Text>
          <Text style={styles.subtitle}>Direct from local farmers</Text>
        </View>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Fresh Produce</Text>
        <Text style={styles.subtitle}>Direct from local farmers</Text>
      </View>

      {/* Category filter chips */}
      <FlatList
        horizontal
        data={[{ id: null, name: "All" }, ...categories]}
        keyExtractor={(item) => item.id || "all"}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryList}
        style={{ maxHeight: 52 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.categoryChip,
              (item.id === null
                ? selectedCategory === null
                : selectedCategory === item.id) && styles.categoryChipSelected,
            ]}
            onPress={() => handleCategoryPress(item.id)}
          >
            <Text
              style={[
                styles.categoryChipText,
                (item.id === null
                  ? selectedCategory === null
                  : selectedCategory === item.id) &&
                  styles.categoryChipTextSelected,
              ]}
            >
              {item.name}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Main feed — recommendations header + listing cards */}
      <FlatList
        data={listings}
        renderItem={renderListing}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={renderFeedHeader}
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

// ═══════════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundSecondary },

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

  // Category chips
  categoryList: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
  },
  categoryChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
    alignSelf: "center",
    height: 36,
    justifyContent: "center",
  },
  categoryChipSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  categoryChipText: { fontSize: fonts.caption, color: colors.textSecondary },
  categoryChipTextSelected: { color: colors.primaryDark, fontWeight: "600" },

  // Loader
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },

  // ── Recommendation Section ──
  recSection: {
    marginBottom: spacing.md,
  },
  recHeader: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  recSectionTitle: {
    fontSize: fonts.h3,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  recSectionHint: {
    fontSize: fonts.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
  recScroll: {
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
  },

  // ── Recommendation Card ──
  recCard: {
    width: 160,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: "hidden",
    // Subtle shadow for depth
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  recImage: {
    width: 160,
    height: 100,
  },
  recImagePlaceholder: {
    width: 160,
    height: 100,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: "center",
    alignItems: "center",
  },
  recPlaceholderEmoji: { fontSize: 32 },
  recAiBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.aiBadge,
    justifyContent: "center",
    alignItems: "center",
  },
  recAiBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
  },
  recContent: {
    padding: spacing.sm,
  },
  recCategory: {
    fontSize: 10,
    color: colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  recTitle: {
    fontSize: fonts.caption,
    fontWeight: "600",
    color: colors.textPrimary,
    marginTop: 2,
  },
  recPrice: {
    fontSize: fonts.caption,
    fontWeight: "700",
    color: colors.primary,
    marginTop: 4,
  },
  recFarm: {
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: 2,
  },

  // ── Section Divider ──
  sectionDivider: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sectionLabel: {
    fontSize: fonts.h3,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  sectionCount: {
    fontSize: fonts.small,
    color: colors.textTertiary,
  },

  // ── Main Feed Card ──
  list: { padding: spacing.md, paddingTop: 0 },
  card: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    overflow: "hidden",
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  cardImage: { width: "100%", height: 180 },
  cardImagePlaceholder: {
    width: "100%",
    height: 180,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: { color: colors.textTertiary, fontSize: fonts.caption },
  aiBadge: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.aiBadge,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  aiBadgeText: {
    color: "#fff",
    fontSize: fonts.small,
    fontWeight: "700",
  },
  cardContent: { padding: spacing.md },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  categoryLabel: {
    fontSize: fonts.small,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  verifiedBadge: {
    fontSize: fonts.small,
    color: colors.success,
    fontWeight: "600",
  },
  cardTitle: {
    fontSize: fonts.h3,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  cardPriceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  cardPrice: {
    fontSize: fonts.body,
    fontWeight: "700",
    color: colors.primary,
  },
  cardQuantity: {
    fontSize: fonts.caption,
    color: colors.textSecondary,
  },
  cardBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  farmName: {
    fontSize: fonts.caption,
    color: colors.textSecondary,
  },
  timeText: {
    fontSize: fonts.small,
    color: colors.textTertiary,
  },

  // Empty state
  empty: {
    alignItems: "center",
    paddingTop: spacing.xxl,
    padding: spacing.lg,
  },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: {
    fontSize: fonts.h2,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  emptyText: {
    fontSize: fonts.caption,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.sm,
  },
});
