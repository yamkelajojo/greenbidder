import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../config/supabase";
import {
  getActiveListings,
  getCategories,
} from "../../services/listingService";
import { trackSearch } from "../../services/trackingService";
import { CATEGORY_ICONS } from "../../services/marketPriceService";
import { formatZAR } from "../../utils/formatters";
import { timeAgo } from "../../utils/dateUtils";
import { colors, spacing, fonts, radius } from "../../config/theme";

/**
 * SearchScreen — intelligent produce discovery.
 *
 * This screen morphs through three states:
 *   1. IDLE     — shows recent searches, interests, trending
 *   2. TYPING   — live results as the buyer types (debounced)
 *   3. RESULTS  — full results after search submission
 *
 * Search queries and result interactions are tracked to feed
 * the recommendation engine — every search makes future
 * recommendations smarter.
 *
 * Criterion 8 — functional search with real data
 * Criterion 3 — debounced queries, specific fields, joins
 */
export default function SearchScreen({ navigation }) {
  const { profileId, isBuyer } = useAuth();
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  // Search state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Discovery state (shown when not searching)
  const [recentSearches, setRecentSearches] = useState([]);
  const [categories, setCategories] = useState([]);
  const [trendingCategories, setTrendingCategories] = useState([]);
  const [isLoadingDiscovery, setIsLoadingDiscovery] = useState(true);

  // Focus the input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300);
    loadDiscoveryData();
  }, []);

  // Debounced live search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length === 0) {
      setResults([]);
      return;
    }

    if (query.trim().length < 2) return;

    debounceRef.current = setTimeout(() => {
      performSearch(query.trim());
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  /**
   * Loads all discovery data in parallel:
   * recent searches, categories, and trending.
   */
  const loadDiscoveryData = async () => {
    setIsLoadingDiscovery(true);

    const [recentResult, catResult, trendResult] = await Promise.all([
      loadRecentSearches(),
      getCategories(),
      loadTrendingCategories(),
    ]);

    if (catResult.data) setCategories(catResult.data);
    setIsLoadingDiscovery(false);
  };

  /**
   * Fetches the buyer's recent search queries.
   * Deduplicates and shows the last 5 unique searches.
   */
  const loadRecentSearches = async () => {
    if (!profileId) return;

    try {
      const { data } = await supabase
        .from("search_history")
        .select("query, searched_at, category_id")
        .eq("buyer_id", profileId)
        .order("searched_at", { ascending: false })
        .limit(20);

      if (data) {
        // Deduplicate by query text, keep most recent
        const seen = new Set();
        const unique = [];
        data.forEach((s) => {
          // Skip category filter entries
          if (
            s.query.startsWith("category:") ||
            s.query.startsWith("price_research:")
          )
            return;
          if (!seen.has(s.query.toLowerCase())) {
            seen.add(s.query.toLowerCase());
            unique.push(s);
          }
        });
        setRecentSearches(unique.slice(0, 5));
      }
    } catch (err) {
      // Silent
    }
  };

  /**
   * Finds trending categories based on recent listing activity.
   * Uses listing count per category as a proxy for demand.
   */
  const loadTrendingCategories = async () => {
    try {
      const { data } = await supabase
        .from("listings")
        .select("category_id, produce_categories ( id, name )")
        .eq("status", "active");

      if (data) {
        const counts = {};
        data.forEach((l) => {
          const id = l.produce_categories?.id;
          const name = l.produce_categories?.name;
          if (!id) return;
          if (!counts[id]) counts[id] = { id, name, count: 0 };
          counts[id].count++;
        });

        const sorted = Object.values(counts)
          .sort((a, b) => b.count - a.count)
          .slice(0, 6);

        setTrendingCategories(sorted);
      }
    } catch (err) {
      // Silent
    }
  };

  /**
   * Performs a text search across listings.
   * Searches title and description with ilike for fuzzy matching.
   * Results include all joined data for rich display.
   */
  const performSearch = async (searchText) => {
    setIsSearching(true);

    try {
      const { data, error } = await supabase
        .from("listings")
        .select(
          `
          id, title, price, unit, quantity, category_id, created_at,
          view_count, save_count,
          farmer_profiles ( id, farm_name, is_verified ),
          produce_categories ( id, name ),
          ai_analysis ( condition_score ),
          listing_images ( image_url, is_primary )
        `,
        )
        .eq("status", "active")
        .or(`title.ilike.%${searchText}%,description.ilike.%${searchText}%`)
        .order("created_at", { ascending: false })
        .limit(20);

      if (data) {
        // Sort by relevance: exact title match first, then AI score
        const sorted = data.sort((a, b) => {
          const aExact = a.title
            .toLowerCase()
            .includes(searchText.toLowerCase())
            ? 1
            : 0;
          const bExact = b.title
            .toLowerCase()
            .includes(searchText.toLowerCase())
            ? 1
            : 0;
          if (aExact !== bExact) return bExact - aExact;

          const aScore = a.ai_analysis?.condition_score || 0;
          const bScore = b.ai_analysis?.condition_score || 0;
          return bScore - aScore;
        });

        setResults(sorted);
      }
    } catch (err) {
      console.warn("Search error:", err.message);
    } finally {
      setIsSearching(false);
    }
  };

  /**
   * Handles search submission — tracks the query and performs search.
   */
  const handleSubmit = () => {
    if (query.trim().length === 0) return;
    Keyboard.dismiss();

    // Track the search
    if (isBuyer && profileId) {
      trackSearch(profileId, query.trim(), null, results.length);
    }

    performSearch(query.trim());
  };

  /**
   * Handles tapping a recent search — re-executes it.
   */
  const handleRecentTap = (searchText) => {
    setQuery(searchText);
    performSearch(searchText);
  };

  /**
   * Handles tapping a category — searches by category name.
   */
  const handleCategoryTap = (categoryName) => {
    setQuery(categoryName);
    performSearch(categoryName);
  };

  /**
   * Clears a recent search from the UI (not from DB).
   */
  const clearRecent = (searchText) => {
    setRecentSearches((prev) => prev.filter((s) => s.query !== searchText));
  };

  const isIdle = query.trim().length === 0 && results.length === 0;

  // ── Result Card ──────────────────────────────────────────────
  const renderResult = ({ item }) => {
    const primaryImage = item.listing_images?.find((img) => img.is_primary);
    const imageUrl =
      primaryImage?.image_url || item.listing_images?.[0]?.image_url;
    const aiScore = item.ai_analysis?.condition_score;
    const icon = CATEGORY_ICONS[item.produce_categories?.name] || "🌿";

    return (
      <TouchableOpacity
        style={styles.resultCard}
        onPress={() =>
          navigation.navigate("ListingDetail", { listingId: item.id })
        }
        activeOpacity={0.8}
      >
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.resultImage} />
        ) : (
          <View style={styles.resultImagePlaceholder}>
            <Text style={styles.resultPlaceholderEmoji}>{icon}</Text>
          </View>
        )}

        <View style={styles.resultContent}>
          <Text style={styles.resultCategory}>
            {item.produce_categories?.name}
          </Text>
          <Text style={styles.resultTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.resultPrice}>
            {formatZAR(item.price)}/{item.unit}
          </Text>
          <View style={styles.resultBottom}>
            <Text style={styles.resultFarm} numberOfLines={1}>
              {item.farmer_profiles?.farm_name}
            </Text>
            <Text style={styles.resultTime}>{timeAgo(item.created_at)}</Text>
          </View>
        </View>

        {aiScore ? (
          <View style={styles.resultAiBadge}>
            <Text style={styles.resultAiText}>{aiScore}</Text>
            <Text style={styles.resultAiLabel}>AI</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  // ── Discovery View (idle state) ──────────────────────────────
  const renderDiscovery = () => (
    <View style={styles.discovery}>
      {/* Recent searches */}
      {recentSearches.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Searches</Text>
          {recentSearches.map((item, i) => (
            <TouchableOpacity
              key={i}
              style={styles.recentItem}
              onPress={() => handleRecentTap(item.query)}
              activeOpacity={0.7}
            >
              <Text style={styles.recentIcon}>🕐</Text>
              <Text style={styles.recentText}>{item.query}</Text>
              <TouchableOpacity
                onPress={() => clearRecent(item.query)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.recentClear}>✕</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {/* Trending categories */}
      {trendingCategories.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trending Now</Text>
          <View style={styles.categoryGrid}>
            {trendingCategories.map((cat) => {
              const icon = CATEGORY_ICONS[cat.name] || "🌿";
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={styles.categoryCard}
                  onPress={() => handleCategoryTap(cat.name)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.categoryCardIcon}>{icon}</Text>
                  <Text style={styles.categoryCardName}>{cat.name}</Text>
                  <Text style={styles.categoryCardCount}>
                    {cat.count} listing{cat.count !== 1 ? "s" : ""}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* Browse all categories */}
      {categories.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Browse Categories</Text>
          <View style={styles.browseGrid}>
            {categories.map((cat) => {
              const icon = CATEGORY_ICONS[cat.name] || "🌿";
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={styles.browseChip}
                  onPress={() => handleCategoryTap(cat.name)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.browseChipText}>
                    {icon} {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      {/* Search header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search produce, farms..."
            placeholderTextColor={colors.textTertiary}
            returnKeyType="search"
            onSubmitEditing={handleSubmit}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 ? (
            <TouchableOpacity
              onPress={() => {
                setQuery("");
                setResults([]);
              }}
              style={styles.clearButton}
            >
              <Text style={styles.clearText}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Searching indicator */}
      {isSearching ? (
        <View style={styles.searchingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.searchingText}>Searching...</Text>
        </View>
      ) : null}

      {/* Results count */}
      {!isIdle && !isSearching && results.length > 0 ? (
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsCount}>
            {results.length} result{results.length !== 1 ? "s" : ""}
          </Text>
        </View>
      ) : null}

      {/* No results */}
      {!isIdle && !isSearching && query.length >= 2 && results.length === 0 ? (
        <View style={styles.noResults}>
          <Text style={styles.noResultsIcon}>🔍</Text>
          <Text style={styles.noResultsTitle}>No results for "{query}"</Text>
          <Text style={styles.noResultsText}>
            Try a different search or browse categories below
          </Text>
        </View>
      ) : null}

      {/* Content: either discovery or results */}
      {isIdle ? (
        <FlatList
          data={[]}
          renderItem={null}
          ListHeaderComponent={renderDiscovery}
          keyboardShouldPersistTaps="handled"
        />
      ) : (
        <FlatList
          data={results}
          renderItem={renderResult}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.resultsList}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  backText: {
    fontSize: 20,
    color: colors.textPrimary,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: { fontSize: 16, marginRight: spacing.sm },
  searchInput: {
    flex: 1,
    fontSize: fonts.body,
    color: colors.textPrimary,
    height: 44,
  },
  clearButton: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  clearText: {
    fontSize: 14,
    color: colors.textTertiary,
    fontWeight: "600",
  },

  // Searching
  searchingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.md,
    gap: spacing.sm,
  },
  searchingText: {
    fontSize: fonts.caption,
    color: colors.textSecondary,
  },

  // Results header
  resultsHeader: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  resultsCount: {
    fontSize: fonts.small,
    color: colors.textTertiary,
  },

  // No results
  noResults: {
    alignItems: "center",
    paddingTop: spacing.xxl,
    padding: spacing.lg,
  },
  noResultsIcon: { fontSize: 40, marginBottom: spacing.md },
  noResultsTitle: {
    fontSize: fonts.body,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  noResultsText: {
    fontSize: fonts.caption,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.xs,
  },

  // ── Discovery (idle state) ──
  discovery: { padding: spacing.md },
  section: { marginBottom: spacing.lg },
  sectionTitle: {
    fontSize: fonts.h3,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },

  // Recent searches
  recentItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  recentIcon: { fontSize: 14, marginRight: spacing.sm },
  recentText: {
    flex: 1,
    fontSize: fonts.body,
    color: colors.textPrimary,
  },
  recentClear: {
    fontSize: 12,
    color: colors.textTertiary,
    padding: spacing.xs,
  },

  // Trending categories
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  categoryCard: {
    width: "31%",
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  categoryCardIcon: { fontSize: 28, marginBottom: spacing.xs },
  categoryCardName: {
    fontSize: fonts.caption,
    fontWeight: "600",
    color: colors.textPrimary,
    textAlign: "center",
  },
  categoryCardCount: {
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: 2,
  },

  // Browse all
  browseGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  browseChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  browseChipText: {
    fontSize: fonts.caption,
    color: colors.textPrimary,
  },

  // ── Result Cards ──
  resultsList: { padding: spacing.md },
  resultCard: {
    flexDirection: "row",
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: "hidden",
  },
  resultImage: { width: 90, height: 90 },
  resultImagePlaceholder: {
    width: 90,
    height: 90,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: "center",
    alignItems: "center",
  },
  resultPlaceholderEmoji: { fontSize: 28 },
  resultContent: {
    flex: 1,
    padding: spacing.sm,
    justifyContent: "center",
  },
  resultCategory: {
    fontSize: 10,
    color: colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  resultTitle: {
    fontSize: fonts.caption,
    fontWeight: "600",
    color: colors.textPrimary,
    marginTop: 2,
  },
  resultPrice: {
    fontSize: fonts.caption,
    fontWeight: "700",
    color: colors.primary,
    marginTop: 4,
  },
  resultBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  resultFarm: {
    fontSize: 10,
    color: colors.textTertiary,
    flex: 1,
  },
  resultTime: {
    fontSize: 10,
    color: colors.textTertiary,
  },
  resultAiBadge: {
    width: 36,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.aiBadge + "10",
  },
  resultAiText: {
    fontSize: fonts.caption,
    fontWeight: "800",
    color: colors.aiBadge,
  },
  resultAiLabel: {
    fontSize: 8,
    color: colors.aiBadge,
    fontWeight: "600",
  },
});
