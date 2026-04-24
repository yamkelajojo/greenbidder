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
  withSpring,
  withDelay,
  interpolate,
  Extrapolation,
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
import AIBadge from "../../components/ai/AIBadge";
import AnalyzingGlow from "../../components/ai/AnalyzingGlow";
import { haptic } from "../../utils/haptics";

// Session-scoped cascade flag
let cascadeHasPlayed = false;
const PLACEHOLDER_BLURHASH = "L6PZfSi_.AyE_3t7t7R**0o#DgR4";

/**
 * ═══════════════════════════════════════════════════════════════════════
 *   PulsingSparkle — gentle ambient pulse on the ✨ emoji
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

// ═══════════════════════════════════════════════════════════════════════
//   ListingCard — single feed card with local glow state
//
//   Lifted out of BuyerFeedScreen so each card owns its own
//   analyzing-glow animation. When the AI badge is tapped:
//     1. Glow activates around the card image (~500ms ramp)
//     2. After 420ms, modal morph begins (via openModal from intercept)
//     3. Glow continues playing, fades out naturally after ~1140ms total
//
//   Glow state lives per-card so tapping one listing doesn't light up
//   all visible listings.
// ═══════════════════════════════════════════════════════════════════════
function ListingCard({ item, index, isFirstMount, onPress }) {
  const [glowActive, setGlowActive] = useState(false);
  const timeoutRef = useRef(null);

  const primaryImage = item.listing_images?.find((img) => img.is_primary);
  const imageUrl =
    primaryImage?.image_url || item.listing_images?.[0]?.image_url;
  const aiScore = item.ai_analysis?.condition_score;

  const shouldAnimate = isFirstMount.current && index < 3;
  const cardDelay = 260 + index * 80;

  const CardWrapper = shouldAnimate ? FadeSlideIn : View;
  const wrapperProps = shouldAnimate ? { delay: cardDelay } : {};

  // Clean up any pending timeouts if component unmounts mid-sequence
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleBadgeIntercept = ({ openModal }) => {
    // Light up the card first
    setGlowActive(true);

    // After 420ms (glow is mostly built up but not at peak yet), trigger
    // the modal morph. This timing means the glow is still playing during
    // the morph — giving the user a sense that the AI is "presenting"
    // its analysis from within the card itself.
    timeoutRef.current = setTimeout(() => {
      openModal();
    }, 420);

    // Let glow fade out naturally after the full sequence
    timeoutRef.current = setTimeout(() => {
      setGlowActive(false);
    }, 1140);
  };

  return (
    <CardWrapper {...wrapperProps}>
      <AnalyzingGlow active={glowActive} radius={radius.lg} bleed={30}>
        <TactilePressable style={styles.card} variant="card" onPress={onPress}>
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

          {aiScore != null ? (
            <View style={styles.listingAiBadgeSlot}>
              <AIBadge
                score={Number(aiScore)}
                aiData={item.ai_analysis}
                onPressIntercept={handleBadgeIntercept}
              />
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
      </AnalyzingGlow>
    </CardWrapper>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//   RecommendationCard — compact horizontal-scroll card
//
//   Entrance: "crash cascade" — cards fly in from the right with bouncy
//   spring physics, overshoot their target, squash-on-impact, then settle.
//   Each card has an index-based delay for the staggered cascade effect.
//
//   Motion stretch (scaleX elongation during slide) mimics motion blur,
//   making the arrival feel like it has real velocity behind it.
// ═══════════════════════════════════════════════════════════════════════

// Spring: bouncy enough to overshoot and oscillate before settling
const CRASH_SPRING = {
  damping: 9,
  stiffness: 210,
  mass: 0.75,
  overshootClamping: false,
};

// Per-card delay within the cascade
const CARD_STAGGER_MS = 85;
const CARD_CASCADE_BASE_DELAY = 100;

function RecommendationCard({ item, index, shouldEnter, onPress }) {
  const [glowActive, setGlowActive] = useState(false);
  const timeoutRef = useRef(null);

  // Entrance animation values
  // entry goes 0 → 1, driving slide + squash + opacity
  const entry = useSharedValue(shouldEnter ? 0 : 1); // if section already expanded on mount, skip entrance
  const impact = useSharedValue(0); // 0→1→0 briefly at arrival moment, for the "squash"

  const primaryImage = item.listing_images?.find((img) => img.is_primary);
  const imageUrl =
    primaryImage?.image_url || item.listing_images?.[0]?.image_url;
  const aiScore = item.ai_analysis?.condition_score;
  const icon = CATEGORY_ICONS[item.produce_categories?.name] || "🌿";

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Trigger entrance when shouldEnter becomes true
  useEffect(() => {
    if (!shouldEnter) return;
    const delay = CARD_CASCADE_BASE_DELAY + index * CARD_STAGGER_MS;

    // Main slide + scale spring (overshoots by nature of low damping)
    entry.value = 0;
    entry.value = withDelay(delay, withSpring(1, CRASH_SPRING));

    // Impact squash — fires ~just after the card arrives at ~80% of spring
    // Rough timing: spring takes ~450ms to reach 80%, so impact at delay+320
    impact.value = 0;
    impact.value = withDelay(
      delay + 280,
      withSequence(
        withTiming(1, {
          duration: 80,
          easing: Easing.bezier(0.34, 1.35, 0.64, 1),
        }),
        withTiming(0, {
          duration: 240,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
        }),
      ),
    );
  }, [shouldEnter]);

  const handleBadgeIntercept = ({ openModal }) => {
    setGlowActive(true);
    timeoutRef.current = setTimeout(() => {
      openModal();
    }, 420);
    timeoutRef.current = setTimeout(() => {
      setGlowActive(false);
    }, 1140);
  };

  // Animated entrance style: slide from right, opacity, motion-stretch scaleX,
  // impact-squash scaleX compression at arrival moment.
  const entranceStyle = useAnimatedStyle(() => {
    const e = entry.value;
    const imp = impact.value;

    // Slide: 180px right offset at e=0 → 0px at e=1. Since spring is
    // bouncy, e will briefly overshoot 1.0 (into territory like 1.08)
    // which makes translateX go slightly negative — the "past-target"
    // overshoot that reads as a crash.
    const translateX = interpolate(e, [0, 1], [180, 0], Extrapolation.EXTEND);

    // Motion stretch: scaleX stretches during the slide. Peaks at
    // e=0.5 (middle of entrance), resolves to 1.0 at rest.
    const motionStretch = interpolate(
      e,
      [0, 0.5, 1],
      [1, 1.18, 1],
      Extrapolation.CLAMP,
    );

    // Impact squash: briefly compress scaleX at arrival (impact 0→1 = compress,
    // impact 1→0 = unsquash back)
    const squashX = 1 - 0.09 * imp;
    const squashY = 1 + 0.06 * imp; // slight vertical puff on impact

    // Opacity ramps in during first half of entrance
    const opacity = interpolate(e, [0, 0.4], [0, 1], Extrapolation.CLAMP);

    return {
      opacity,
      transform: [
        { translateX },
        { scaleX: motionStretch * squashX },
        { scaleY: squashY },
      ],
    };
  });

  return (
    <Animated.View style={entranceStyle}>
      <AnalyzingGlow active={glowActive} bleed={22}>
        <TactilePressable
          style={styles.recCard}
          variant="compact"
          onPress={onPress}
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

          {aiScore != null ? (
            <View style={styles.aiBadgeSlot}>
              <AIBadge
                score={Number(aiScore)}
                aiData={item.ai_analysis}
                compact
                onPressIntercept={handleBadgeIntercept}
              />
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
      </AnalyzingGlow>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//   RecommendationSectionUnfold — the carousel "unfolds" into view
//
//   Instead of just fading in, the whole rec section expands from a
//   collapsed state: scaleY animates from 0.2 → 1 with origin at top,
//   opacity fades 0→1. Gives a "container growing open" feel so the
//   horizontal scroll doesn't just snap into place.
//
//   Once the container is ~80% expanded, it emits `cascadeReady=true`
//   to its child so cards can begin their crash-cascade entrance.
// ═══════════════════════════════════════════════════════════════════════
function RecommendationSectionUnfold({ children, delay = 0 }) {
  const [cascadeReady, setCascadeReady] = useState(false);
  const unfold = useSharedValue(0);

  useEffect(() => {
    unfold.value = withDelay(
      delay,
      withTiming(1, {
        duration: 460,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
      }),
    );

    // Tell children to start cascading when container is mostly open
    const t = setTimeout(() => setCascadeReady(true), delay + 220);
    return () => clearTimeout(t);
  }, []);

  const unfoldStyle = useAnimatedStyle(() => {
    const v = unfold.value;
    // scaleY from top: simulates "unfolding" from collapsed to full height
    const scaleY = interpolate(v, [0, 1], [0.25, 1]);
    // Opacity fades in slightly earlier than the expansion completes
    const opacity = interpolate(v, [0, 0.4, 1], [0, 1, 1], Extrapolation.CLAMP);
    return {
      opacity,
      transform: [{ scaleY }],
    };
  });

  return (
    <Animated.View style={[{ transformOrigin: "top" }, unfoldStyle]}>
      {typeof children === "function" ? children(cascadeReady) : children}
    </Animated.View>
  );
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

  // ── Recommendation card (delegated to RecommendationCard component) ──
  const renderRecommendationCard = (item, index, cascadeReady) => (
    <RecommendationCard
      key={item.id}
      item={item}
      index={index}
      shouldEnter={cascadeReady}
      onPress={() =>
        navigation.navigate("ListingDetail", { listingId: item.id })
      }
    />
  );

  const renderRecommendationSection = () => {
    if (selectedCategory || recommendations.length === 0) return null;

    // Use crash-cascade unfold only on first mount — subsequent renders
    // (filter changes etc.) don't need the full entrance spectacle.
    const isFirstReveal = isFirstMount.current && hasLoadedOnce;

    const inner = (cascadeReady) => (
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
                {/* On first reveal: cards wait for cascadeReady from the
                    unfold wrapper, then each plays its crash entrance
                    indexed by position. On subsequent visits: cascadeReady
                    is passed as true immediately so cards just render. */}
                {renderRecommendationCard(
                  item,
                  i,
                  isFirstReveal ? cascadeReady : true,
                )}
              </ScrollAwareCard>
            ))
          }
        </FadeEdgeScroll>
      </View>
    );

    if (isFirstReveal) {
      return (
        <RecommendationSectionUnfold delay={160}>
          {inner}
        </RecommendationSectionUnfold>
      );
    }
    return inner(true);
  };

  // ── Listing card (delegated to ListingCard component) ──
  const renderListing = ({ item, index }) => (
    <ListingCard
      item={item}
      index={index}
      isFirstMount={isFirstMount}
      onPress={() =>
        navigation.navigate("ListingDetail", { listingId: item.id })
      }
    />
  );

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
  recHeader: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  recTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
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
    paddingLeft: spacing.md - 4,
    paddingRight: spacing.md,
    paddingVertical: spacing.xs,
  },
  recCard: {
    width: 160,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginRight: 12,
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

  // ── AI badge slots — positioned containers for the new AIBadge ──
  //
  // AIBadge is an inline pill component that measures itself for the
  // morph source rect, so we give it an absolute-positioned wrapper
  // rather than styling the badge itself. This keeps AIBadge reusable.
  aiBadgeSlot: {
    position: "absolute",
    top: 6,
    right: 6,
    zIndex: 2,
  },
  listingAiBadgeSlot: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 2,
  },

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
