import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  RefreshControl,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useFocusEffect } from "@react-navigation/native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  interpolate,
  Extrapolate,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  ChevronRight,
  Settings,
  Edit2,
  Star,
  Package,
  Heart,
  MapPin,
  Calendar,
  TrendingUp,
} from "lucide-react-native";

import { useAuth } from "../../hooks/useAuth";
import { logoutUser } from "../../services/authService";
import { supabase } from "../../config/supabase";
import {
  colors,
  spacing,
  fonts,
  radius,
  shadows,
  springs,
  durations,
  stagger,
} from "../../config/theme";

import { Modal, FlatList, ActivityIndicator } from "react-native";
import { timeAgo } from "../../utils/dateUtils";

// -----------------------------------------------------------------------------
// Animations – inspired by ListingDetailScreen
// -----------------------------------------------------------------------------
const EASE_SETTLE = Easing.bezier(0.22, 1, 0.36, 1);
const ANIMATION_DELAY_BASE = 120;
const STAGGER_INTERVAL = stagger.standard; // 70ms

const useFadeSlide = (delay, slideFrom = "bottom") => {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: durations.standard, easing: EASE_SETTLE }),
    );
  }, []);
  const style = useAnimatedStyle(() => {
    const opacity = progress.value;
    const translateY =
      slideFrom === "bottom"
        ? interpolate(progress.value, [0, 1], [20, 0], Extrapolate.CLAMP)
        : 0;
    const translateX =
      slideFrom === "left"
        ? interpolate(progress.value, [0, 1], [-20, 0], Extrapolate.CLAMP)
        : 0;
    return { opacity, transform: [{ translateY }, { translateX }] };
  });
  return style;
};

const useStaggerSpring = (index) => {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(
      ANIMATION_DELAY_BASE + index * STAGGER_INTERVAL,
      withSpring(1, springs.gentle),
    );
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.96, 1]) }],
  }));
  return style;
};

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------
export default function ProfileScreen() {
  const { user, userRole, profileId } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const scrollViewRef = React.useRef(null);

  const [profileData, setProfileData] = useState(null);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [avatarInitial, setAvatarInitial] = useState("?");

  const [showReviewsModal, setShowReviewsModal] = useState(false);
  const [reviewsList, setReviewsList] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

  // Animated values for leaving transition (pop)
  const leaveProgress = useSharedValue(0);

  // Entrance animation per section (using staggered spring)
  const avatarStyle = useStaggerSpring(0);
  const nameStyle = useStaggerSpring(1);
  const roleBadgeStyle = useStaggerSpring(2);
  const statsRowStyle = useStaggerSpring(3);
  const infoCardStyle = useStaggerSpring(4);
  const actionButtonsStyle = useStaggerSpring(5);
  const logoutButtonStyle = useStaggerSpring(6);

  // Header backdrop fade
  const headerStyle = useFadeSlide(0, "top");

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  const fetchProfile = async () => {
    if (!user || !userRole) return;

    try {
      // 1. Fetch base profile (farmer or buyer)
      let profile = null;
      if (userRole === "farmer") {
        const { data, error } = await supabase
          .from("farmer_profiles")
          .select("*")
          .eq("user_id", profileId)
          .single();
        if (!error) profile = data;
      } else {
        const { data, error } = await supabase
          .from("buyer_profiles")
          .select("*")
          .eq("user_id", profileId)
          .single();
        if (!error) profile = data;
      }
      setProfileData(profile);
      setAvatarInitial(
        profile?.farm_name?.[0] ||
          profile?.full_name?.[0] ||
          user.email?.[0] ||
          "?",
      );

      // 2. Fetch statistics
      if (userRole === "farmer") {
        const { count: listingsCount } = await supabase
          .from("listings")
          .select("*", { count: "exact", head: true })
          .eq("farmer_id", profileId);
        const { data: reviews } = await supabase
          .from("farmer_reviews")
          .select("rating")
          .eq("farmer_id", profileId);
        const reviewsCount = reviews?.length || 0;
        const avgRating =
          reviewsCount > 0
            ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviewsCount
            : 0;

        setStats({
          listingsCount: listingsCount || 0,
          avgRating: Number(avgRating.toFixed(1)),
          reviewsCount,
          totalSold: undefined,
        });
      } else {
        const { count: savedCount } = await supabase
          .from("saved_listings")
          .select("*", { count: "exact", head: true })
          .eq("buyer_id", profileId);
        const { count: reviewsGiven } = await supabase
          .from("farmer_reviews")
          .select("*", { count: "exact", head: true })
          .eq("buyer_id", profileId);

        setStats({
          savedListingsCount: savedCount || 0,
          reviewsGivenCount: reviewsGiven || 0,
        });
      }
    } catch (err) {
      console.warn("Profile fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [user, userRole]);

  useEffect(() => {
    if (showReviewsModal) {
      fetchFarmerReviews();
    }
  }, [showReviewsModal]);

  useFocusEffect(
    React.useCallback(() => {
      // Small delay to ensure content is rendered
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      }, 100);
    }, []),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfile();
    setRefreshing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const fetchFarmerReviews = async () => {
    if (!profileData?.id) return;
    setLoadingReviews(true);
    try {
      const { data, error } = await supabase
        .from("farmer_reviews")
        .select(
          `
        id,
        rating,
        comment,
        created_at,
        buyer:buyer_profiles (
          full_name,
          user_id
        )
      `,
        )
        .eq("farmer_id", profileData.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReviewsList(data || []);
    } catch (err) {
      console.warn("Failed to load reviews:", err);
      Alert.alert("Error", "Could not load reviews.");
    } finally {
      setLoadingReviews(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleLogout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          leaveProgress.value = withTiming(1, { duration: durations.fast });
          const { error } = await logoutUser();
          if (error)
            Alert.alert("Error", "Failed to log out. Please try again.");
        },
      },
    ]);
  };

  const handleEditProfile = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert("Edit Profile", "Profile editing will be available soon.");
  };

  const handleViewSavedListings = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      "Saved Listings",
      "Navigate to your saved listings (coming in next sprint).",
    );
  };

  const handleViewMyListings = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("Listings", { screen: "MyListings" });
  };

  const handleSettings = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert("Settings", "App preferences and notifications.");
  };

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------
  const renderStatBox = (icon, label, value) => (
    <View style={styles.statBox}>
      {icon}
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  const renderInfoRow = (Icon, label, value) => {
    if (!value) return null;
    return (
      <View style={styles.infoRow}>
        <Icon size={18} color={colors.textSecondary} />
        <Text style={styles.infoText}>{value}</Text>
      </View>
    );
  };

  // Exit animation for the whole screen
  const animatedContainerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(leaveProgress.value, [0, 1], [1, 0]),
    transform: [{ scale: interpolate(leaveProgress.value, [0, 1], [1, 0.96]) }],
  }));

  if (isLoading && !refreshing) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loader}>
          <Text style={styles.loaderText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <Animated.View style={[styles.container, animatedContainerStyle]}>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + spacing.lg },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {/* Header background accent */}
          <Animated.View style={[styles.headerAccent, headerStyle]} />

          {/* Avatar + Name */}
          <Animated.View style={[styles.avatarWrapper, avatarStyle]}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {avatarInitial.toUpperCase()}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.editIcon}
              onPress={handleEditProfile}
            >
              <Edit2 size={16} color={colors.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={nameStyle}>
            <Text style={styles.displayName}>
              {userRole === "farmer"
                ? profileData?.farm_name || "Farmer"
                : profileData?.full_name || "Buyer"}
            </Text>
          </Animated.View>

          <Animated.View style={roleBadgeStyle}>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>
                {userRole === "farmer" ? "🌱 Farmer" : "🛒 Buyer"}
              </Text>
            </View>
          </Animated.View>

          {/* Stats Row – dynamic based on role */}
          <Animated.View style={[styles.statsRow, statsRowStyle]}>
            {userRole === "farmer" && stats ? (
              <>
                {renderStatBox(
                  <Package size={20} color={colors.primary} />,
                  "Listings",
                  stats.listingsCount,
                )}
                {renderStatBox(
                  <Star size={20} color={colors.warning} />,
                  "Rating",
                  stats.avgRating.toFixed(1),
                )}
                <TouchableOpacity
                  style={styles.statBoxTouchable}
                  onPress={() => setShowReviewsModal(true)}
                  activeOpacity={0.7}
                >
                  {renderStatBox(
                    <Heart size={20} color={colors.danger} />,
                    "Reviews",
                    stats.reviewsCount,
                  )}
                </TouchableOpacity>
              </>
            ) : stats ? (
              <>
                {renderStatBox(
                  <Heart size={20} color={colors.danger} />,
                  "Saved",
                  stats.savedListingsCount,
                )}
                {renderStatBox(
                  <Star size={20} color={colors.warning} />,
                  "Reviews",
                  stats.reviewsGivenCount,
                )}
                {renderStatBox(
                  <Package size={20} color={colors.primary} />,
                  "Orders",
                  "—",
                )}
              </>
            ) : null}
          </Animated.View>

          {/* Info Card */}
          <Animated.View style={[styles.infoCard, infoCardStyle]}>
            {renderInfoRow(
              MapPin,
              "Location",
              profileData?.location_name || "Not set",
            )}
            {renderInfoRow(
              Calendar,
              "Member since",
              profileData?.created_at
                ? new Date(profileData.created_at).toLocaleDateString(
                    undefined,
                    { year: "numeric", month: "long" },
                  )
                : null,
            )}
            {user?.email && (
              <View style={styles.infoRow}>
                <Text style={styles.infoText}>📧 {user.email}</Text>
              </View>
            )}
            {renderInfoRow(
              Text,
              "# Phone",
              profileData?.phone || "📞 Not provided",
            )}
            {userRole === "farmer" && profileData?.bio && (
              <View style={styles.bioContainer}>
                <Text style={styles.bioLabel}>Bio</Text>
                <Text style={styles.bioText}>{profileData.bio}</Text>
              </View>
            )}
          </Animated.View>

          {/* Action Buttons */}
          <Animated.View style={[styles.actionsGrid, actionButtonsStyle]}>
            {userRole === "farmer" ? (
              <>
                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={handleViewMyListings}
                >
                  <Package size={24} color={colors.primary} />
                  <Text style={styles.actionTitle}>My Listings</Text>
                  <ChevronRight
                    size={18}
                    color={colors.textTertiary}
                    style={styles.actionChevron}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={() => Alert.alert("Analytics", "Coming soon")}
                >
                  <TrendingUp size={24} color={colors.info} />
                  <Text style={styles.actionTitle}>Analytics</Text>
                  <ChevronRight
                    size={18}
                    color={colors.textTertiary}
                    style={styles.actionChevron}
                  />
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={handleViewSavedListings}
                >
                  <Heart size={24} color={colors.danger} />
                  <Text style={styles.actionTitle}>Saved</Text>
                  <ChevronRight
                    size={18}
                    color={colors.textTertiary}
                    style={styles.actionChevron}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={() => Alert.alert("Purchase History", "Coming soon")}
                >
                  <Package size={24} color={colors.primary} />
                  <Text style={styles.actionTitle}>Orders</Text>
                  <ChevronRight
                    size={18}
                    color={colors.textTertiary}
                    style={styles.actionChevron}
                  />
                </TouchableOpacity>
              </>
            )}
          </Animated.View>

          {/* Logout Button */}
          <Animated.View style={logoutButtonStyle}>
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
              activeOpacity={0.8}
            >
              <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>
          </Animated.View>

          <Text style={styles.versionText}>
            GreenBidder v2.0 — Farm to fork intelligence
          </Text>
        </ScrollView>
      </SafeAreaView>
      <Modal
        visible={showReviewsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowReviewsModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Reviews for {profileData?.farm_name || "Farmer"}
            </Text>
            <TouchableOpacity
              onPress={() => setShowReviewsModal(false)}
              style={styles.modalClose}
            >
              <Text style={styles.modalCloseText}>Done</Text>
            </TouchableOpacity>
          </View>

          {loadingReviews ? (
            <View style={styles.modalLoader}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : reviewsList.length === 0 ? (
            <View style={styles.emptyReviews}>
              <Text style={styles.emptyReviewsIcon}>⭐</Text>
              <Text style={styles.emptyReviewsText}>No reviews yet</Text>
              <Text style={styles.emptyReviewsSubtext}>
                Be the first to leave a review
              </Text>
            </View>
          ) : (
            <FlatList
              data={reviewsList}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.reviewsList}
              renderItem={({ item }) => (
                <View style={styles.reviewItem}>
                  <View style={styles.reviewHeader}>
                    <Text style={styles.reviewerName}>
                      {item.buyer?.full_name || "Anonymous"}
                    </Text>
                    <View style={styles.reviewRating}>
                      <Text style={styles.reviewRatingStars}>
                        {"★".repeat(item.rating)}
                        {"☆".repeat(5 - item.rating)}
                      </Text>
                    </View>
                  </View>
                  {item.comment ? (
                    <Text style={styles.reviewComment}>{item.comment}</Text>
                  ) : null}
                  <Text style={styles.reviewDate}>
                    {timeAgo(item.created_at)}
                  </Text>
                </View>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>
    </Animated.View>
  );
}

// -----------------------------------------------------------------------------
// Styles (adhering to design tokens)
// -----------------------------------------------------------------------------
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundSecondary },
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  loaderText: { fontSize: fonts.caption, color: colors.textSecondary },

  headerAccent: {
    position: "absolute",
    top: -100,
    left: -50,
    right: -50,
    height: 200,
    backgroundColor: colors.primaryLight,
    opacity: 0.4,
    borderRadius: 200,
    transform: [{ scale: 1.5 }],
  },

  avatarWrapper: {
    alignItems: "center",
    marginBottom: spacing.md,
    position: "relative",
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    ...shadows.raised,
  },
  avatarText: { fontSize: 40, fontWeight: "700", color: colors.white },
  editIcon: {
    position: "absolute",
    bottom: 0,
    right: "30%",
    backgroundColor: colors.background,
    borderRadius: radius.full,
    padding: spacing.xs,
    ...shadows.resting,
  },

  displayName: {
    fontSize: fonts.h1,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  roleBadge: {
    alignSelf: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    marginBottom: spacing.lg,
  },
  roleText: {
    fontSize: fonts.caption,
    fontWeight: "600",
    color: colors.primaryDark,
  },

  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
    ...shadows.resting,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  statValue: {
    fontSize: fonts.h2,
    fontWeight: "700",
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  statLabel: {
    fontSize: fonts.small,
    color: colors.textSecondary,
    marginTop: 2,
  },

  infoCard: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    ...shadows.raised,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  infoText: {
    fontSize: fonts.body,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  bioContainer: {
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.sm,
  },
  bioLabel: {
    fontSize: fonts.small,
    fontWeight: "600",
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  bioText: { fontSize: fonts.body, color: colors.textPrimary, lineHeight: 20 },

  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    flex: 1,
    minWidth: "45%",
    ...shadows.resting,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  actionTitle: {
    fontSize: fonts.body,
    fontWeight: "500",
    color: colors.textPrimary,
    marginLeft: spacing.sm,
    flex: 1,
  },
  actionChevron: { marginLeft: "auto" },

  logoutButton: {
    height: 52,
    borderWidth: 1.5,
    borderColor: colors.danger,
    borderRadius: radius.md,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.dangerLight,
    marginBottom: spacing.lg,
  },
  logoutText: { color: colors.danger, fontSize: fonts.body, fontWeight: "600" },

  versionText: {
    fontSize: fonts.small,
    color: colors.textTertiary,
    textAlign: "center",
    marginTop: spacing.lg,
    fontStyle: "italic",
  },
  // Add to StyleSheet
  statBoxTouchable: {
    flex: 1,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  modalTitle: {
    fontSize: fonts.h3,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  modalClose: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  modalCloseText: {
    fontSize: fonts.body,
    fontWeight: "600",
    color: colors.primary,
  },
  modalLoader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyReviews: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  emptyReviewsIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyReviewsText: {
    fontSize: fonts.body,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  emptyReviewsSubtext: {
    fontSize: fonts.caption,
    color: colors.textSecondary,
  },
  reviewsList: {
    padding: spacing.md,
  },
  reviewItem: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  reviewerName: {
    fontSize: fonts.caption,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  reviewRatingStars: {
    fontSize: fonts.small,
    color: colors.warning,
  },
  reviewComment: {
    fontSize: fonts.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  reviewDate: {
    fontSize: fonts.small,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
});
