import React, { useState, useCallback, useRef, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  interpolate,
  Easing,
} from "react-native-reanimated";
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
import TactilePressable from "../../components/shared/TactilePressable";
import FadeSlideIn from "../../components/shared/FadeSlideIn";
import SkeletonCard from "../../components/shared/SkeletonCard";
import FadeEdgeScroll from "../../components/shared/FadeEdgeScroll";
import ScrollAwareCard from "../../components/shared/ScrollAwareCard";
import { haptic } from "../../utils/haptics";

// Session-scoped cascade flag
let cascadeHasPlayed = false;
const PLACEHOLDER_BLURHASH = "L6PZfSi_.AyE_3t7t7R**0o#DgR4";

/**
 * ═══════════════════════════════════════════════════════════════════════
 *   PulsingSparkle — gentle ambient pulse on the ✨ emoji
 *
 *   Opacity 0.7 ↔ 1.0 + scale 0.96 ↔ 1.02. 2.4s cycle.
 *   Quiet enough to feel ambient, visible enough to read as "alive".
 *   Only used on the "Picked for You" header — it's an AI moment.
 * ═══════════════════════════════════════════════════════════════════════
 */
function PulsingSparkle({ style }) {
  const breath = useSharedValue(0);

  useEffect(() => {
    breath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breath.value, [0, 1], [0.7, 1.0]),
    transform: [{ scale: interpolate(breath.value, [0, 1], [0.96, 1.02]) }],
  }));

  return <Animated.Text style={[style, pulseStyle]}>✨</Animated.Text>;
}

export default function BuyerFeedScreen({ navigation }) {
  const { profileId, isBuyer } = useAuth();

  const [listings, setListings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [profileSummary, setProfileSummary] = useState(null);
  const [isPersonalised, setIsPersonalised] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const isFirstMount = useRef(!cascadeHasPlayed);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [profileId]),
  );

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
    setHasLoadedOnce(true);

    if (isFirstMount.current) {
      cascadeHasPlayed = true;
    }
  };

  const loadFilteredListings = async (categoryId) => {
    setIsLoading(true);
    const filters = {};
    if (categoryId) filters.categoryId = categoryId;
    const { data } = await getActiveListings(filters);
    if (data) setListings(data);
    setIsLoading(false);
  };

  const handleCategoryPress = (catId) => {
    const newCategory = selectedCategory === catId ? null : catId;
    if (newCategory !== selectedCategory) {
      haptic.selection();
    }
    setSelectedCategory(newCategory);

    if (newCategory) {
      if (isBuyer && profileId) {
        const cat = categories.find((c) => c.id === newCategory);
        if (cat) trackCategoryFilter(profileId, newCategory, cat.name, 0);
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

  const EntranceWrapper = ({ delay = 0, children, ...rest }) => {
    if (isFirstMount.current && hasLoadedOnce) {
      return (
        <FadeSlideIn delay={delay} {...rest}>
          {children}
        </FadeSlideIn>
      );
    }
    return <View {...rest}>{children}</View>;
  };

  // ── Header ──
  const renderHeader = () => (
    <EntranceWrapper delay={0}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerTitles}>
            <Text style={styles.title}>Fresh Produce</Text>
            <Text style={styles.subtitle}>Direct from local farmers</Text>
          </View>
          <TactilePressable
            style={styles.searchButton}
            variant="compact"
            onPress={() => navigation.navigate("Search")}
          >
            <Text style={styles.searchButtonIcon}>🔍</Text>
          </TactilePressable>
        </View>
      </View>
    </EntranceWrapper>
  );

  // ── Recommendation card ──
  const renderRecommendationCard = (item) => {
    const primaryImage = item.listing_images?.find((img) => img.is_primary);
    const imageUrl =
      primaryImage?.image_url || item.listing_images?.[0]?.image_url;
    const aiScore = item.ai_analysis?.condition_score;
    const icon = CATEGORY_ICONS[item.produce_categories?.name] || "🌿";

    return (
      <TactilePressable
        key={item.id}
        style={styles.recCard}
        variant="compact"
        onPress={() =>
          navigation.navigate("ListingDetail", { listingId: item.id })
        }
      >
        {imageUrl ? (
          <Image
            source={imageUrl}
            style={styles.recImage}
            contentFit="cover"
            transition={200}
            placeholder={PLACEHOLDER_BLURHASH}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={styles.recImagePlaceholder}>
            <Text style={styles.recPlaceholderEmoji}>{icon}</Text>
          </View>
        )}

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
      </TactilePressable>
    );
  };

  const renderRecommendationSection = () => {
    if (selectedCategory || recommendations.length === 0) return null;

    return (
      <EntranceWrapper delay={160}>
        <View style={styles.recSection}>
          <View style={styles.recHeader}>
            <View style={styles.recTitleRow}>
              {isPersonalised ? (
                <>
                  <PulsingSparkle style={styles.recSparkle} />
                  <Text style={styles.recSectionTitle}>Picked for You</Text>
                </>
              ) : (
                <>
                  <Text style={styles.recFireEmoji}>🔥</Text>
                  <Text style={styles.recSectionTitle}>Popular Right Now</Text>
                </>
              )}
            </View>
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

          <FadeEdgeScroll
            snapInterval={172}
            fadeWidth={24}
            contentPaddingLeft={spacing.md - 4}
            contentPaddingRight={spacing.md}
            backgroundColor={colors.backgroundSecondary}
          >
            {(scrollX, viewportWidth) =>
              recommendations.map((item, i) => (
                <ScrollAwareCard
                  key={item.id}
                  index={i}
                  scrollX={scrollX}
                  viewportWidth={viewportWidth}
                  cardWidth={160}
                  snapInterval={172}
                  contentOffset={spacing.md - 4}
                >
                  {renderRecommendationCard(item)}
                </ScrollAwareCard>
              ))
            }
          </FadeEdgeScroll>
        </View>
      </EntranceWrapper>
    );
  };

  // ── Listing card ──
  const renderListing = ({ item, index }) => {
    const primaryImage = item.listing_images?.find((img) => img.is_primary);
    const imageUrl =
      primaryImage?.image_url || item.listing_images?.[0]?.image_url;
    const aiScore = item.ai_analysis?.condition_score;

    const shouldAnimate = isFirstMount.current && index < 3;
    const cardDelay = 260 + index * 80;

    const CardWrapper = shouldAnimate ? FadeSlideIn : View;
    const wrapperProps = shouldAnimate ? { delay: cardDelay } : {};

    return (
      <CardWrapper {...wrapperProps}>
        <TactilePressable
          style={styles.card}
          variant="card"
          onPress={() =>
            navigation.navigate("ListingDetail", { listingId: item.id })
          }
        >
          {imageUrl ? (
            <Image
              source={imageUrl}
              style={styles.cardImage}
              contentFit="cover"
              transition={200}
              placeholder={PLACEHOLDER_BLURHASH}
              cachePolicy="memory-disk"
            />
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
        </TactilePressable>
      </CardWrapper>
    );
  };

  // ── "Latest Listings" divider ──
  const renderFeedHeader = () => (
    <View>
      {renderRecommendationSection()}
      <EntranceWrapper delay={240}>
        <View style={styles.sectionDivider}>
          <Text style={styles.sectionLabel}>
            {selectedCategory
              ? categories.find((c) => c.id === selectedCategory)?.name ||
                "Filtered"
              : "Latest Listings"}
          </Text>
          <View style={styles.sectionCountPill}>
            <Text style={styles.sectionCountText}>{listings.length}</Text>
          </View>
        </View>
      </EntranceWrapper>
    </View>
  );

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

  // ── Loading ──
  if (isLoading && listings.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        {renderHeader()}
        <View style={styles.categoryRowContainer}>
          <View style={[styles.chipPlaceholder, { width: 60 }]} />
          <View style={[styles.chipPlaceholder, { width: 80 }]} />
          <View style={[styles.chipPlaceholder, { width: 90 }]} />
          <View style={[styles.chipPlaceholder, { width: 70 }]} />
        </View>
        <View style={styles.skeletonList}>
          <SkeletonCard delay={0} />
          <SkeletonCard delay={120} />
          <SkeletonCard delay={240} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    // edges={["top"]} only — the tab navigator handles bottom inset itself.
    // Without this restriction we get double safe-area padding = visible gap.
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {renderHeader()}

      <EntranceWrapper delay={80}>
        <View style={styles.categoryRowWrapper}>
          <FlatList
            horizontal
            data={[{ id: null, name: "All" }, ...categories]}
            keyExtractor={(item) => item.id || "all"}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryList}
            style={{ maxHeight: 52 }}
            renderItem={({ item }) => {
              const isSelected =
                item.id === null
                  ? selectedCategory === null
                  : selectedCategory === item.id;
              return (
                <TactilePressable
                  style={[
                    styles.categoryChip,
                    isSelected && styles.categoryChipSelected,
                  ]}
                  variant="compact"
                  onPress={() => handleCategoryPress(item.id)}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      isSelected && styles.categoryChipTextSelected,
                    ]}
                  >
                    {item.name}
                  </Text>
                </TactilePressable>
              );
            }}
          />
          <LinearGradient
            colors={[colors.background + "00", colors.background]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.chipEdgeFade}
            pointerEvents="none"
          />
        </View>
      </EntranceWrapper>

      <FlatList
        data={listings}
        renderItem={renderListing}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={renderFeedHeader}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Background matches the feed list background — no visible colour band
  // between the scroll area and the tab bar.
  safe: { flex: 1, backgroundColor: colors.backgroundSecondary },

  // ── Header ──
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitles: { flex: 1 },
  title: {
    fontSize: fonts.h1,
    fontWeight: "700",
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: fonts.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  searchButtonIcon: { fontSize: 18 },

  // ── Category row ──
  categoryRowWrapper: {
    position: "relative",
    backgroundColor: colors.background,
  },
  categoryList: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  categoryRowContainer: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    gap: spacing.sm,
  },
  chipPlaceholder: {
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.backgroundTertiary,
    opacity: 0.6,
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
  chipEdgeFade: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 32,
  },

  // ── Recommendations ──
  recSection: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  // Align section text to the same left edge as listing cards (spacing.md
  // in the list padding). Previously had md horizontal padding which looked
  // unanchored next to the lg-padded header.
  recHeader: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  recTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2, // small deliberate gap between emoji + text
  },
  recSparkle: {
    fontSize: fonts.h3,
  },
  recFireEmoji: {
    fontSize: fonts.h3,
  },
  recSectionTitle: {
    fontSize: fonts.h3,
    fontWeight: "700",
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  recSectionHint: {
    fontSize: fonts.small,
    color: colors.textSecondary,
    marginTop: 4,
    marginLeft: 2,
  },
  recScroll: {
    // Nudged 4px left of spacing.md so the rec card's visual edge (border +
    // shadow optical spacing) lines up precisely with the listing card
    // below it. Header above stays at spacing.md — it's text, no border.
    paddingLeft: spacing.md - 4,
    paddingRight: spacing.md,
    paddingVertical: spacing.xs,
  },
  recCard: {
    width: 160,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginRight: 12, // snap math: 160 + 12 = 172
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  recImage: { width: 160, height: 100 },
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
  recAiBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  recContent: { padding: spacing.sm },
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
  recFarm: { fontSize: 10, color: colors.textTertiary, marginTop: 2 },

  // ── Section divider ──
  sectionDivider: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  sectionLabel: {
    fontSize: fonts.h3,
    fontWeight: "700",
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  sectionCountPill: {
    backgroundColor: colors.backgroundTertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    minWidth: 28,
    alignItems: "center",
  },
  sectionCountText: {
    fontSize: fonts.small,
    fontWeight: "600",
    color: colors.textSecondary,
  },

  // ── Main list ──
  // No explicit paddingBottom — React Navigation's tab bar automatically
  // inserts its height as contentInset. Adding our own padding on top
  // of that creates a visible gap.
  list: {
    paddingHorizontal: spacing.md,
  },
  skeletonList: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
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
  aiBadgeText: { color: "#fff", fontSize: fonts.small, fontWeight: "700" },
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
    letterSpacing: -0.2,
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
  cardQuantity: { fontSize: fonts.caption, color: colors.textSecondary },
  cardBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  farmName: { fontSize: fonts.caption, color: colors.textSecondary },
  timeText: { fontSize: fonts.small, color: colors.textTertiary },

  // ── Empty ──
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
