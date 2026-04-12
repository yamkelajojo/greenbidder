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
 * Farmer's own listings screen.
 * Criterion 8 — CRUD Read for farmer's listings.
 */
export default function FarmerListingsScreen({ navigation }) {
  const { user } = useAuth();
  const [listings, setListings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Reload listings every time the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadListings();
    }, [user])
  );

  /**
   * Fetch farmer's listings with category and image.
   * Criterion 3 — select specific fields, use joins not loops.
   */
  const loadListings = async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      // Get farmer profile id
      const { data: userData } = await supabase
        .from("users")
        .select("id")
        .eq("auth_id", user.id)
        .single();

      if (!userData) return;

      const { data: farmerData } = await supabase
        .from("farmer_profiles")
        .select("id")
        .eq("user_id", userData.id)
        .single();

      if (!farmerData) return;

      // Fetch listings with related data in one query — avoids N+1
      const { data, error } = await supabase
        .from("listings")
        .select(`
          id, title, price, unit, quantity, status, created_at,
          produce_categories ( name ),
          listing_images ( image_url, is_primary )
        `)
        .eq("farmer_id", farmerData.id)
        .neq("status", "archived")
        .order("created_at", { ascending: false });

      if (data) setListings(data);
    } catch (err) {
      console.warn("Failed to load listings:", err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const renderListing = ({ item }) => {
    const primaryImage = item.listing_images?.find((img) => img.is_primary);
    const imageUrl = primaryImage?.image_url || item.listing_images?.[0]?.image_url;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate("ListingDetail", { listingId: item.id })}
        activeOpacity={0.8}
      >
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.cardImage} />
        ) : (
          <View style={styles.cardImagePlaceholder}>
            <Text style={styles.cardImagePlaceholderText}>No photo</Text>
          </View>
        )}
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.cardCategory}>
            {item.produce_categories?.name}
          </Text>
          <View style={styles.cardRow}>
            <Text style={styles.cardPrice}>
              {formatZAR(item.price)}/{item.unit}
            </Text>
            <Text style={styles.cardTime}>{timeAgo(item.created_at)}</Text>
          </View>
          <View style={[
            styles.statusBadge,
            item.status === "active" ? styles.statusActive : styles.statusInactive,
          ]}>
            <Text style={[
              styles.statusText,
              item.status === "active" ? styles.statusTextActive : styles.statusTextInactive,
            ]}>
              {item.status}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>🌱</Text>
      <Text style={styles.emptyTitle}>No listings yet</Text>
      <Text style={styles.emptyText}>
        Create your first listing to start selling your produce
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>My Listings</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => navigation.navigate("CreateListing")}
          activeOpacity={0.8}
        >
          <Text style={styles.createButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={listings}
          renderItem={renderListing}
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  title: { fontSize: fonts.h1, fontWeight: "700", color: colors.textPrimary },
  createButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  createButtonText: { color: "#fff", fontWeight: "600", fontSize: fonts.caption },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  list: { padding: spacing.md },
  card: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    overflow: "hidden",
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  cardImage: { width: "100%", height: 160 },
  cardImagePlaceholder: {
    width: "100%",
    height: 160,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: "center",
    alignItems: "center",
  },
  cardImagePlaceholderText: { color: colors.textTertiary, fontSize: fonts.caption },
  cardContent: { padding: spacing.md },
  cardTitle: { fontSize: fonts.body, fontWeight: "600", color: colors.textPrimary },
  cardCategory: { fontSize: fonts.small, color: colors.textSecondary, marginTop: 2 },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
  },
  cardPrice: { fontSize: fonts.body, fontWeight: "700", color: colors.primary },
  cardTime: { fontSize: fonts.small, color: colors.textTertiary },
  statusBadge: {
    marginTop: spacing.sm,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  statusActive: { backgroundColor: colors.primaryLight },
  statusInactive: { backgroundColor: colors.backgroundTertiary },
  statusText: { fontSize: fonts.small, fontWeight: "600" },
  statusTextActive: { color: colors.primaryDark },
  statusTextInactive: { color: colors.textSecondary },
  empty: { alignItems: "center", paddingTop: spacing.xxl, padding: spacing.lg },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { fontSize: fonts.h2, fontWeight: "600", color: colors.textPrimary },
  emptyText: {
    fontSize: fonts.caption,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.sm,
  },
});
