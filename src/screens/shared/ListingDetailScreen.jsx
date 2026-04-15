import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getListingById } from "../../services/listingService";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../config/supabase";
import { formatZAR } from "../../utils/formatters";
import { timeAgo } from "../../utils/dateUtils";
import { colors, spacing, fonts, radius } from "../../config/theme";
import { trackView, trackContact } from "../../services/trackingService";

/**
 * Listing detail screen — full view of a single listing.
 * Criterion 8 — CRUD Read detail view.
 * Criterion 3 — single query with joins fetches all related data.
 */
export default function ListingDetailScreen({ route, navigation }) {
  const { listingId } = route.params;
  const { user, isBuyer, profileId } = useAuth();

  const [listing, setListing] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    loadListing();
    const viewStart = Date.now();

    // When the buyer leaves this screen, record how long they viewed
    return () => {
      if (isBuyer && profileId) {
        const seconds = (Date.now() - viewStart) / 1000;
        trackView(profileId, listingId, seconds, "feed");
      }
    };
  }, [listingId]);

  /**
   * Check if buyer has saved this listing.
   * Criterion 3 — count query instead of fetching full rows.
   */
  const checkIfSaved = async () => {
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

      const { count } = await supabase
        .from("saved_listings")
        .select("id", { count: "exact", head: true })
        .eq("buyer_id", buyerData.id)
        .eq("listing_id", listingId);

      setIsSaved(count > 0);
    } catch (err) {
      console.warn("Check saved failed:", err.message);
    }
  };

  const handleSave = async () => {
    try {
      const { data: userData } = await supabase
        .from("users")
        .select("id")
        .eq("auth_id", user.id)
        .single();

      const { data: buyerData } = await supabase
        .from("buyer_profiles")
        .select("id")
        .eq("user_id", userData.id)
        .single();

      if (!buyerData) return;

      if (isSaved) {
        await supabase
          .from("saved_listings")
          .delete()
          .eq("buyer_id", buyerData.id)
          .eq("listing_id", listingId);
        setIsSaved(false);
      } else {
        await supabase
          .from("saved_listings")
          .insert({ buyer_id: buyerData.id, listing_id: listingId });
        setIsSaved(true);
      }
    } catch (err) {
      Alert.alert("Error", "Could not save listing. Try again.");
    }
  };

  const handleContact = () => {
    const phone = listing?.farmer_profiles?.phone;
    if (phone) {
      Alert.alert(
        "Contact Farmer",
        `Call ${listing.farmer_profiles.farm_name}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Call",
            onPress: () => {
              if (isBuyer && profileId)
                trackContact(profileId, listingId, "phone");
              Linking.openURL(`tel:${phone}`);
            },
          },
          {
            text: "WhatsApp",
            onPress: () => {
              if (isBuyer && profileId)
                trackContact(profileId, listingId, "whatsapp");
              Linking.openURL(
                `whatsapp://send?phone=${phone}&text=Hi, I'm interested in your ${listing.title} on GreenBidder`,
              );
            },
          },
        ],
      );
    } else {
      Alert.alert("Contact", "This farmer hasn't added a phone number yet.");
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!listing) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loader}>
          <Text style={styles.errorText}>Listing not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const primaryImage = listing.listing_images?.find((img) => img.is_primary);
  const imageUrl =
    primaryImage?.image_url || listing.listing_images?.[0]?.image_url;
  const ai = listing.ai_analysis;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView>
        {/* Back button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        {/* Image */}
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.placeholderText}>No photo</Text>
          </View>
        )}

        <View style={styles.content}>
          {/* Category and status */}
          <View style={styles.topRow}>
            <Text style={styles.category}>
              {listing.produce_categories?.name}
            </Text>
            {listing.is_organic ? (
              <View style={styles.organicBadge}>
                <Text style={styles.organicText}>Organic</Text>
              </View>
            ) : null}
          </View>

          {/* Title */}
          <Text style={styles.title}>{listing.title}</Text>

          {/* Price row */}
          <View style={styles.priceRow}>
            <Text style={styles.price}>
              {formatZAR(listing.price)}/{listing.unit}
            </Text>
            <Text style={styles.quantity}>
              {listing.quantity} {listing.unit}s available
            </Text>
          </View>

          {/* Description */}
          {listing.description ? (
            <Text style={styles.description}>{listing.description}</Text>
          ) : null}

          {/* AI Analysis card */}
          {ai ? (
            <View style={styles.aiCard}>
              <View style={styles.aiHeader}>
                <Text style={styles.aiTitle}>AI Quality Analysis</Text>
                <View style={styles.aiScoreBadge}>
                  <Text style={styles.aiScoreText}>
                    {ai.condition_score}/10
                  </Text>
                </View>
              </View>
              {ai.ripeness_estimate ? (
                <Text style={styles.aiDetail}>
                  Ripeness: {ai.ripeness_estimate}
                </Text>
              ) : null}
              {ai.growth_insight ? (
                <Text style={styles.aiDetail}>{ai.growth_insight}</Text>
              ) : null}
              {ai.price_suggestion_min && ai.price_suggestion_max ? (
                <Text style={styles.aiPrice}>
                  Suggested price: {formatZAR(ai.price_suggestion_min)} –{" "}
                  {formatZAR(ai.price_suggestion_max)}
                </Text>
              ) : null}
            </View>
          ) : null}

          {/* Farmer info card */}
          <View style={styles.farmerCard}>
            <View style={styles.farmerRow}>
              <View style={styles.farmerAvatar}>
                <Text style={styles.farmerAvatarText}>
                  {listing.farmer_profiles?.farm_name?.[0]?.toUpperCase() ||
                    "F"}
                </Text>
              </View>
              <View style={styles.farmerInfo}>
                <Text style={styles.farmerName}>
                  {listing.farmer_profiles?.farm_name}
                  {listing.farmer_profiles?.is_verified ? " ✓" : ""}
                </Text>
                {listing.farmer_profiles?.avg_rating > 0 ? (
                  <Text style={styles.farmerRating}>
                    ★ {listing.farmer_profiles.avg_rating}
                  </Text>
                ) : null}
              </View>
            </View>
            {listing.farmer_profiles?.location_name ? (
              <Text style={styles.farmerLocation}>
                📍 {listing.farmer_profiles.location_name}
              </Text>
            ) : null}
          </View>

          {/* Meta info */}
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              {listing.view_count} views · {listing.save_count} saves
            </Text>
            <Text style={styles.metaText}>{timeAgo(listing.created_at)}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom action bar — only for buyers */}
      {isBuyer ? (
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            activeOpacity={0.8}
          >
            <Text style={styles.saveButtonText}>
              {isSaved ? "♥ Saved" : "♡ Save"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.contactButton}
            onPress={handleContact}
            activeOpacity={0.8}
          >
            <Text style={styles.contactButtonText}>Contact Farmer</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorText: { fontSize: fonts.body, color: colors.textSecondary },
  backButton: {
    position: "absolute",
    top: spacing.md,
    left: spacing.md,
    zIndex: 10,
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  backText: {
    fontSize: fonts.caption,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  image: { width: "100%", height: 280 },
  imagePlaceholder: {
    width: "100%",
    height: 280,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: { color: colors.textTertiary },
  content: { padding: spacing.lg },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  category: {
    fontSize: fonts.small,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  organicBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  organicText: {
    fontSize: fonts.small,
    color: colors.primaryDark,
    fontWeight: "600",
  },
  title: {
    fontSize: fonts.h1,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  price: { fontSize: fonts.h2, fontWeight: "700", color: colors.primary },
  quantity: { fontSize: fonts.caption, color: colors.textSecondary },
  description: {
    fontSize: fonts.body,
    color: colors.textPrimary,
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  aiCard: {
    backgroundColor: colors.aiBadgeLight,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  aiHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  aiTitle: { fontSize: fonts.body, fontWeight: "600", color: colors.aiBadge },
  aiScoreBadge: {
    backgroundColor: colors.aiBadge,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  aiScoreText: { color: "#fff", fontSize: fonts.caption, fontWeight: "700" },
  aiDetail: {
    fontSize: fonts.caption,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  aiPrice: {
    fontSize: fonts.caption,
    color: colors.aiBadge,
    fontWeight: "600",
    marginTop: spacing.xs,
  },
  farmerCard: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  farmerRow: { flexDirection: "row", alignItems: "center" },
  farmerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  farmerAvatarText: {
    fontSize: fonts.h3,
    fontWeight: "700",
    color: colors.primaryDark,
  },
  farmerInfo: { flex: 1 },
  farmerName: {
    fontSize: fonts.body,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  farmerRating: {
    fontSize: fonts.caption,
    color: colors.warning,
    marginTop: 2,
  },
  farmerLocation: {
    fontSize: fonts.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  metaText: { fontSize: fonts.small, color: colors.textTertiary },
  actionBar: {
    flexDirection: "row",
    padding: spacing.md,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.background,
  },
  saveButton: {
    flex: 1,
    height: 48,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  saveButtonText: {
    color: colors.primary,
    fontSize: fonts.body,
    fontWeight: "600",
  },
  contactButton: {
    flex: 2,
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  contactButtonText: {
    color: "#fff",
    fontSize: fonts.body,
    fontWeight: "600",
  },
});
