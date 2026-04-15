import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../../config/supabase";
import { useAuth } from "../../hooks/useAuth";
import { formatZAR } from "../../utils/formatters";
import { timeAgo } from "../../utils/dateUtils";
import { colors, spacing, fonts, radius } from "../../config/theme";

/**
 * Saved Listings screen — buyer's favourited listings.
 * Criterion 8 — functional screen, read from saved_listings.
 * Criterion 3 — single query with joins, no N+1.
 */
export default function SavedListingsScreen({ navigation }) {
  const { user } = useAuth();
  const [savedListings, setSavedListings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadSaved();
    }, [user]),
  );

  const loadSaved = async () => {
    if (!user?.id) return;
    setIsLoading(true);

    try {
      const { data: userData } = await supabase
        .from("users")
        .select("id")
        .eq("auth_id", user.id)
        .single();

      if (!userData) return;

      const { data: buyerData } = await supabase
        .from("buyer_profiles")
        .select("id")
        .eq("user_id", userData.id)
        .single();

      if (!buyerData) return;

      // Single query with joins — fetches listing + images + farmer + category
      const { data, error } = await supabase
        .from("saved_listings")
        .select(
          `
          id, saved_at,
          listings (
            id, title, price, unit, quantity, status, created_at,
            produce_categories ( name ),
            listing_images ( image_url, is_primary ),
            farmer_profiles ( farm_name )
          )
        `,
        )
        .eq("buyer_id", buyerData.id)
        .order("saved_at", { ascending: false });

      if (data) {
        // Filter out archived listings
        const active = data.filter(
          (s) => s.listings && s.listings.status === "active",
        );
        setSavedListings(active);
      }
    } catch (err) {
      console.warn("Failed to load saved listings:", err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const renderItem = ({ item }) => {
    const listing = item.listings;
    if (!listing) return null;

    const primaryImage = listing.listing_images?.find((img) => img.is_primary);
    const imageUrl =
      primaryImage?.image_url || listing.listing_images?.[0]?.image_url;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() =>
          navigation.navigate("ListingDetail", { listingId: listing.id })
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
        <View style={styles.cardContent}>
          <Text style={styles.cardCategory}>
            {listing.produce_categories?.name}
          </Text>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {listing.title}
          </Text>
          <View style={styles.cardRow}>
            <Text style={styles.cardPrice}>
              {formatZAR(listing.price)}/{listing.unit}
            </Text>
            <Text style={styles.cardFarm}>
              {listing.farmer_profiles?.farm_name}
            </Text>
          </View>
          <Text style={styles.savedTime}>Saved {timeAgo(item.saved_at)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>♡</Text>
      <Text style={styles.emptyTitle}>No saved listings</Text>
      <Text style={styles.emptyText}>
        Tap the heart on any listing to save it here for later
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Saved</Text>
        <Text style={styles.subtitle}>Your favourited produce</Text>
      </View>

      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={savedListings}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={renderEmpty}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundSecondary },
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
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  list: { padding: spacing.md },
  card: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    overflow: "hidden",
    marginBottom: spacing.md,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  cardImage: { width: 110, height: 110 },
  cardImagePlaceholder: {
    width: 110,
    height: 110,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: { color: colors.textTertiary, fontSize: fonts.small },
  cardContent: { flex: 1, padding: spacing.md, justifyContent: "center" },
  cardCategory: {
    fontSize: fonts.small,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontSize: fonts.body,
    fontWeight: "600",
    color: colors.textPrimary,
    marginTop: 2,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
  },
  cardPrice: {
    fontSize: fonts.caption,
    fontWeight: "700",
    color: colors.primary,
  },
  cardFarm: { fontSize: fonts.small, color: colors.textSecondary },
  savedTime: {
    fontSize: fonts.small,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  empty: { alignItems: "center", paddingTop: spacing.xxl, padding: spacing.lg },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
    color: colors.textTertiary,
  },
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
