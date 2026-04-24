import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useIsFocused } from "@react-navigation/native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  FadeOut,
  FadeInDown,
  LinearTransition,
  interpolate,
  Extrapolation,
  cancelAnimation,
} from "react-native-reanimated";

import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { TouchableOpacity } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";

import { supabase } from "../../config/supabase";
import { useAuth } from "../../hooks/useAuth";
import { formatZAR } from "../../utils/formatters";
import { timeAgo } from "../../utils/dateUtils";
import { colors, spacing, fonts, radius } from "../../config/theme";

// ─── Refined Easings (Inspired by your ListingDetailScreen) ───
const EASE_SETTLE = Easing.bezier(0.22, 1, 0.36, 1);
const EASE_TACTILE = Easing.bezier(0.34, 1.35, 0.64, 1);

/*
 * SwipeableCard — wraps one saved listing row.
 * Now features a staggered entrance animation based on its index.
 */
function SwipeableCard({ item, index, navigation, onDelete }) {
  const swipeableRef = useRef(null);

  // Entrance animation value
  const enterVal = useSharedValue(0);

  useEffect(() => {
    // Stagger the entrance by 80ms per index so they cascade in
    enterVal.value = withDelay(
      index * 80 + 100,
      withTiming(1, { duration: 600, easing: EASE_SETTLE }),
    );
  }, []);

  const listing = item.listings;
  if (!listing) return null;

  const primaryImage = listing.listing_images?.find((img) => img.is_primary);
  const imageUrl =
    primaryImage?.image_url || listing.listing_images?.[0]?.image_url;

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    swipeableRef.current?.close();
    onDelete(item);
  };

  const renderRightActions = (progress) => {
    const deleteButtonStyle = useAnimatedStyle(() => {
      const scale = interpolate(
        progress.value,
        [0, 1],
        [0.5, 1], // Start slightly smaller so it "pops" into place
        Extrapolation.CLAMP,
      );

      return {
        transform: [{ scale }],
        opacity: progress.value,
      };
    });

    return (
      <View style={styles.deleteContainer}>
        <Animated.View style={[styles.deleteButton, deleteButtonStyle]}>
          <TouchableOpacity
            style={styles.deleteTouchable}
            onPress={handleDelete}
            activeOpacity={0.7}
          >
            <Text style={styles.deleteIcon}>🗑️</Text>
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  };

  // The style that applies the staggered entrance
  const entranceStyle = useAnimatedStyle(() => ({
    opacity: enterVal.value,
    transform: [
      { translateY: interpolate(enterVal.value, [0, 1], [20, 0]) },
      { scale: interpolate(enterVal.value, [0, 1], [0.96, 1]) },
    ],
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 80)
        .duration(600)
        .easing(EASE_SETTLE)}
      exiting={FadeOut.duration(250)}
      layout={LinearTransition.springify().damping(18).stiffness(200)}
    >
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        overshootRight={false}
        rightThreshold={60}
        friction={2}
      >
        <View>
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
              <Text style={styles.savedTime}>
                Saved {timeAgo(item.saved_at)}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </Swipeable>
    </Animated.View>
  );
}

/**
 * Saved Listings screen — buyer's favourited listings.
 */
export default function SavedListingsScreen({ navigation }) {
  const { user } = useAuth();
  const [savedListings, setSavedListings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Screen entrance animations
  const headerEnter = useSharedValue(0);
  const emptyEnter = useSharedValue(0);

  const isFocused = useIsFocused();

  useEffect(() => {
    if (!isFocused) return;

    cancelAnimation(headerEnter);
    cancelAnimation(emptyEnter);

    headerEnter.value = 0;
    emptyEnter.value = 0;

    headerEnter.value = withTiming(1, {
      duration: 500,
      easing: EASE_TACTILE,
    });
  }, [isFocused]);

  useEffect(() => {
    if (isFocused && !isLoading && savedListings.length === 0) {
      emptyEnter.value = 0;
      emptyEnter.value = withDelay(
        200,
        withTiming(1, { duration: 600, easing: EASE_SETTLE }),
      );
    }
  }, [isFocused, isLoading, savedListings.length]);

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

      if (error) throw error;

      if (data) {
        const active = data.filter(
          (s) => s.listings && s.listings.status === "active",
        );
        setSavedListings(active);

        // If empty, trigger the empty state animation
        if (active.length === 0) {
          emptyEnter.value = 0;
          emptyEnter.value = withDelay(
            200,
            withTiming(1, { duration: 600, easing: EASE_SETTLE }),
          );
        }
      }
    } catch (err) {
      console.warn("Failed to load saved listings:", err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (savedItem) => {
    try {
      const { error } = await supabase
        .from("saved_listings")
        .delete()
        .eq("id", savedItem.id);

      if (error) throw error;

      setSavedListings((prev) => {
        const next = prev.filter((s) => s.id !== savedItem.id);
        // Trigger empty animation if we just deleted the last item
        if (next.length === 0) {
          emptyEnter.value = 0;
          emptyEnter.value = withDelay(
            100,
            withTiming(1, { duration: 600, easing: EASE_SETTLE }),
          );
        }
        return next;
      });
    } catch (err) {
      Alert.alert("Error", "Could not remove listing. Try again.");
    }
  };

  const renderItem = ({ item, index }) => (
    <SwipeableCard
      item={item}
      index={index}
      navigation={navigation}
      onDelete={handleDelete}
    />
  );

  // Animated styles for the Header
  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerEnter.value,
    transform: [
      { translateY: interpolate(headerEnter.value, [0, 1], [-15, 0]) },
    ],
  }));

  // Animated styles for the Empty State
  const emptyStyle = useAnimatedStyle(() => ({
    opacity: emptyEnter.value,
    transform: [
      { translateY: interpolate(emptyEnter.value, [0, 1], [20, 0]) },
      { scale: interpolate(emptyEnter.value, [0, 1], [0.95, 1]) },
    ],
  }));

  const renderEmpty = () => (
    <Animated.View style={[styles.empty, emptyStyle]}>
      <Text style={styles.emptyIcon}>♡</Text>
      <Text style={styles.emptyTitle}>No saved listings</Text>
      <Text style={styles.emptyText}>
        Tap the heart on any listing to save it here for later
      </Text>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.View style={[styles.header, headerStyle]}>
        <Text style={styles.title}>Saved</Text>
        <Text style={styles.subtitle}>Your favourited produce</Text>
      </Animated.View>

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
  empty: {
    alignItems: "center",
    paddingTop: spacing.xxl,
    padding: spacing.lg,
  },
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

  // ── Delete button styles ──
  deleteContainer: {
    justifyContent: "center",
    alignItems: "flex-end",
    paddingLeft: 8,
  },
  deleteButton: {
    backgroundColor: colors.error,
    borderRadius: radius.md,
    marginRight: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  deleteTouchable: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  deleteIcon: {
    fontSize: 18,
  },
  deleteText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: fonts.caption,
  },
});
