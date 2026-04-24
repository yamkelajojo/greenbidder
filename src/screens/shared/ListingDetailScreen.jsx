import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  BackHandler,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Heart, MessageCircle } from "lucide-react-native";

import { getListingById } from "../../services/listingService";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../config/supabase";
import { formatZAR } from "../../utils/formatters";
import { timeAgo } from "../../utils/dateUtils";
import { colors, spacing, fonts, radius } from "../../config/theme";
import { trackView, trackContact } from "../../services/trackingService";
import ReviewSheet from "../../components/shared/ReviewSheet";
import FarmerTrustCard from "../../components/shared/FarmerTrustCard";
import { hasReviewed } from "../../services/reviewService";
import AIDetailCard from "../../components/ai/AIDetailCard";
import LocationChip from "../../components/shared/LocationChip";

/**
 * ═══════════════════════════════════════════════════════════════════════
 *   ListingDetailScreen — v3 polish
 *
 *   v3 changes (April 2026):
 *
 *   • HEADER RHYTHM tightened. The previous content top padding + title
 *     margin stack meant ~32px of breathing room between the image and
 *     the first line of text. Reduced content.paddingTop from lg → md
 *     and title.marginBottom from sm → xs. The intro block now reads as
 *     a single connected unit with the image rather than floating
 *     away from it.
 *
 *   • LocationChip added to the metadata row. Surfaces WHERE the produce
 *     is from at first-class prominence (not just buried in the farmer
 *     card below), and makes the AI's regional analysis feel honest —
 *     the AI uses the same location data as its input.
 *
 *   • askingPrice + unit passed down to AIDetailCard so the AI's new
 *     price_assessment renders as an instrument scale with the farmer's
 *     actual price as a glowing tick.
 *
 *   ─── Preserved from v2 ───
 *   • Back button respects top safe-area inset (no status-bar clash).
 *   • Action bar uses symmetric padding (doesn't stack with tab-bar
 *     home-indicator inset).
 * ═══════════════════════════════════════════════════════════════════════
 */

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const EASE_SETTLE = Easing.bezier(0.22, 1, 0.36, 1);
const EASE_TACTILE = Easing.bezier(0.34, 1.35, 0.64, 1);
const EASE_PLAYFUL = Easing.bezier(0.34, 1.7, 0.6, 1);
const EASE_READING = Easing.bezier(0.25, 0.1, 0.3, 1);
const EASE_IN_QUICK = Easing.bezier(0.5, 0, 0.9, 0.4);

const LEAVE_OPACITY_END = 0.75;
const LEAVE_SCALE_END = 0.65;

// ─── Page element animation helper ───
function useEntranceStyle(entryValue, leaveValue, config = {}) {
  const {
    translateX = [0, 0],
    translateY = [0, 0],
    scaleFrom = 1,
    motionStretchX = 1,
    motionStretchY = 1,
    rotateFrom = 0,
    leaveDir = "down",
  } = config;

  return useAnimatedStyle(() => {
    const v = entryValue.value;
    const l = leaveValue.value;
    const leaveOp = interpolate(
      l,
      [0, LEAVE_OPACITY_END],
      [1, 0],
      Extrapolation.CLAMP,
    );
    const leaveScale = interpolate(
      l,
      [0, LEAVE_SCALE_END],
      [1, 0.92],
      Extrapolation.CLAMP,
    );
    const leaveTY =
      leaveDir === "down" ? l * 12 : leaveDir === "up" ? l * -12 : 0;
    const leaveTX =
      leaveDir === "left" ? l * -12 : leaveDir === "right" ? l * 12 : 0;

    const stretchX = interpolate(v, [0, 0.5, 1], [1, motionStretchX, 1]);
    const stretchY = interpolate(v, [0, 0.5, 1], [1, motionStretchY, 1]);
    const rotation = interpolate(v, [0, 1], [rotateFrom, 0]);

    return {
      opacity: v * leaveOp,
      transform: [
        { translateX: interpolate(v, [0, 1], translateX) + leaveTX },
        { translateY: interpolate(v, [0, 1], translateY) + leaveTY },
        { rotate: `${rotation}deg` },
        { scale: interpolate(v, [0, 1], [scaleFrom, 1]) * leaveScale },
        { scaleX: stretchX },
        { scaleY: stretchY },
      ],
    };
  });
}

// ─── SaveHeart (unchanged from v2) ───
function SaveHeart({ isSaved, onPress }) {
  const scale = useSharedValue(1);
  const burst = useSharedValue(0);
  const fillProgress = useSharedValue(isSaved ? 1 : 0);

  useEffect(() => {
    fillProgress.value = withTiming(isSaved ? 1 : 0, { duration: 220 });
  }, [isSaved]);

  const handlePress = () => {
    if (!isSaved) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    scale.value = withSequence(
      withTiming(1.45, { duration: 140, easing: EASE_PLAYFUL }),
      withSpring(1, { damping: 10, stiffness: 240, mass: 0.6 }),
    );
    if (!isSaved) {
      burst.value = 0;
      burst.value = withTiming(1, {
        duration: 520,
        easing: Easing.out(Easing.cubic),
      });
    }
    onPress();
  };

  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const heartFillStyle = useAnimatedStyle(() => ({
    opacity: fillProgress.value,
  }));
  const burstStyle = useAnimatedStyle(() => {
    const b = burst.value;
    return {
      opacity: interpolate(b, [0, 0.2, 1], [0, 0.6, 0], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(b, [0, 1], [0.4, 2.2]) }],
    };
  });

  return (
    <AnimatedPressable
      onPress={handlePress}
      style={[styles.heartButton, heartStyle]}
      hitSlop={10}
    >
      <Animated.View
        style={[styles.heartBurst, burstStyle]}
        pointerEvents="none"
      />
      <Heart size={22} color={colors.textSecondary} strokeWidth={2} />
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.heartFillWrap, heartFillStyle]}
      >
        <Heart size={22} color="#E53E3E" fill="#E53E3E" strokeWidth={2} />
      </Animated.View>
    </AnimatedPressable>
  );
}

// ─── Main screen ───
export default function ListingDetailScreen({ route, navigation }) {
  const { listingId } = route.params;
  const { user, isBuyer, profileId } = useAuth();
  const insets = useSafeAreaInsets();

  const [listing, setListing] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const leave = useSharedValue(0);

  const imageR = useSharedValue(0);
  const topRowR = useSharedValue(0);
  const locationR = useSharedValue(0); // NEW — LocationChip gets its own entry
  const titleR = useSharedValue(0);
  const priceR = useSharedValue(0);
  const priceQtyR = useSharedValue(0);
  const descR = useSharedValue(0);
  const aiWrapR = useSharedValue(0);
  const farmerR = useSharedValue(0);
  const trustR = useSharedValue(0);
  const metaR = useSharedValue(0);
  const actionBarR = useSharedValue(0);
  const heartBtnR = useSharedValue(0);
  const waBtnR = useSharedValue(0);
  const msgBtnR = useSharedValue(0);

  const jitterSeed = useRef(Math.floor((Math.random() - 0.5) * 60)).current;
  const J = (base) => base + jitterSeed;

  useEffect(() => {
    loadListing();
    const viewStart = Date.now();
    return () => {
      if (isBuyer && profileId) {
        const seconds = (Date.now() - viewStart) / 1000;
        trackView(profileId, listingId, seconds, "feed");
      }
    };
  }, [listingId]);

  const hasAnimatedRef = useRef(false);
  useEffect(() => {
    if (!listing || hasAnimatedRef.current) return;
    hasAnimatedRef.current = true;

    imageR.value = withDelay(
      J(40),
      withTiming(1, { duration: 640, easing: EASE_SETTLE }),
    );

    topRowR.value = withDelay(
      J(180),
      withTiming(1, { duration: 420, easing: EASE_PLAYFUL }),
    );

    // Location chip arrives a beat after the category — small detail, small offset
    locationR.value = withDelay(
      J(240),
      withTiming(1, { duration: 440, easing: EASE_SETTLE }),
    );

    titleR.value = withDelay(
      J(300),
      withTiming(1, { duration: 560, easing: EASE_TACTILE }),
    );

    priceR.value = withDelay(
      J(420),
      withTiming(1, { duration: 480, easing: EASE_TACTILE }),
    );
    priceQtyR.value = withDelay(
      J(500),
      withTiming(1, { duration: 420, easing: EASE_SETTLE }),
    );

    descR.value = withDelay(
      J(580),
      withTiming(1, { duration: 640, easing: EASE_READING }),
    );

    aiWrapR.value = withDelay(
      J(720),
      withSpring(1, { damping: 12, stiffness: 160, mass: 0.9 }),
    );

    farmerR.value = withDelay(
      J(940),
      withTiming(1, { duration: 500, easing: EASE_SETTLE }),
    );

    trustR.value = withDelay(
      J(1060),
      withTiming(1, { duration: 440, easing: EASE_SETTLE }),
    );

    metaR.value = withDelay(
      J(1180),
      withTiming(1, { duration: 400, easing: EASE_SETTLE }),
    );

    actionBarR.value = withDelay(
      J(340),
      withTiming(1, { duration: 480, easing: EASE_SETTLE }),
    );
    heartBtnR.value = withDelay(
      J(380),
      withSpring(1, { damping: 11, stiffness: 220, mass: 0.7 }),
    );
    waBtnR.value = withDelay(
      J(460),
      withSpring(1, { damping: 11, stiffness: 220, mass: 0.7 }),
    );
    msgBtnR.value = withDelay(
      J(540),
      withSpring(1, { damping: 11, stiffness: 220, mass: 0.7 }),
    );
  }, [listing]);

  const handleBack = useCallback(() => {
    if (isLeaving) return;
    setIsLeaving(true);
    leave.value = withTiming(1, { duration: 260, easing: EASE_IN_QUICK });
    setTimeout(() => {
      navigation.goBack();
    }, 240);
  }, [isLeaving, navigation]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        handleBack();
        return true;
      });
      return () => sub.remove();
    }, [handleBack]),
  );

  const loadListing = async () => {
    setIsLoading(true);
    const { data } = await getListingById(listingId);
    if (data) {
      setListing(data);
      if (isBuyer) checkIfSaved();
      if (isBuyer && profileId && data.farmer_profiles?.id) {
        hasReviewed(profileId, data.farmer_profiles.id).then(
          setAlreadyReviewed,
        );
      }
    }
    setIsLoading(false);
  };

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

  const handleWhatsApp = () => {
    const phone = listing?.farmer_profiles?.phone;
    if (!phone) {
      Alert.alert(
        "No WhatsApp",
        "This farmer hasn't added a phone number yet.",
      );
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (isBuyer && profileId) trackContact(profileId, listingId, "whatsapp");
    Linking.openURL(
      `whatsapp://send?phone=${phone}&text=${encodeURIComponent(
        `Hi, I'm interested in your ${listing.title} on GreenBidder`,
      )}`,
    ).catch(() => {
      Alert.alert(
        "WhatsApp not installed",
        "Please install WhatsApp to message this farmer.",
      );
    });
  };

  const handleMessage = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Alert.alert(
      "Messaging — Coming Soon",
      "In-app messaging is being built. For now, use WhatsApp to contact the farmer.",
    );
  };

  // ─── Entry styles ───
  const imageStyle = useEntranceStyle(imageR, leave, {
    translateY: [24, 0],
    leaveDir: "up",
  });

  const topRowStyle = useEntranceStyle(topRowR, leave, {
    translateX: [-20, 0],
    motionStretchX: 1.12,
    rotateFrom: -1,
    leaveDir: "left",
  });

  // Location chip — slides from the right (opposite side vs category row)
  // so the two pieces feel like they meet in the middle
  const locationStyle = useEntranceStyle(locationR, leave, {
    translateX: [14, 0],
    scaleFrom: 0.88,
    leaveDir: "right",
  });

  const titleStyle = useEntranceStyle(titleR, leave, {
    translateY: [18, 0],
    scaleFrom: 0.96,
    motionStretchY: 1.1,
    rotateFrom: 0.6,
    leaveDir: "down",
  });

  const priceStyle = useEntranceStyle(priceR, leave, {
    translateY: [16, 0],
    scaleFrom: 0.92,
    motionStretchY: 1.08,
    leaveDir: "down",
  });

  const priceQtyStyle = useEntranceStyle(priceQtyR, leave, {
    translateX: [14, 0],
    motionStretchX: 1.1,
    leaveDir: "right",
  });

  const descStyle = useEntranceStyle(descR, leave, {
    translateY: [14, 0],
    leaveDir: "down",
  });

  const aiWrapStyle = useEntranceStyle(aiWrapR, leave, {
    translateY: [28, 0],
    scaleFrom: 0.95,
    motionStretchY: 1.08,
    rotateFrom: -0.8,
    leaveDir: "down",
  });

  const farmerStyle = useEntranceStyle(farmerR, leave, {
    translateX: [-18, 0],
    motionStretchX: 1.06,
    rotateFrom: 0.6,
    leaveDir: "left",
  });

  const trustStyle = useEntranceStyle(trustR, leave, {
    translateY: [10, 0],
    leaveDir: "down",
  });

  const metaStyle = useEntranceStyle(metaR, leave, {});

  const actionBarStyle = useEntranceStyle(actionBarR, leave, {
    translateY: [40, 0],
    leaveDir: "down",
  });

  const heartBtnStyle = useEntranceStyle(heartBtnR, leave, {
    translateY: [20, 0],
    scaleFrom: 0.6,
    motionStretchY: 1.1,
  });
  const waBtnStyle = useEntranceStyle(waBtnR, leave, {
    translateY: [20, 0],
    scaleFrom: 0.7,
    motionStretchY: 1.12,
  });
  const msgBtnStyle = useEntranceStyle(msgBtnR, leave, {
    translateY: [20, 0],
    scaleFrom: 0.7,
    motionStretchY: 1.12,
  });

  if (isLoading) {
    return (
      <View style={styles.safe}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!listing) {
    return (
      <View style={styles.safe}>
        <View style={styles.loader}>
          <Text style={styles.errorText}>Listing not found</Text>
        </View>
      </View>
    );
  }

  const primaryImage = listing.listing_images?.find((img) => img.is_primary);
  const imageUrl =
    primaryImage?.image_url || listing.listing_images?.[0]?.image_url;
  const ai = listing.ai_analysis;

  // Resolve the most human-readable location for the LocationChip.
  // Prefer farmer profile location (usually a proper city/region name)
  // over the listing's own location_name (which CreateListing currently
  // fills with raw coords as a fallback).
  const chipLocation =
    listing.farmer_profiles?.location_name || listing.location_name || null;

  return (
    <View style={styles.safe}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: spacing.md,
          paddingTop: spacing.xxxl,
        }}
      >
        <Pressable
          style={[styles.backButton, { top: insets.top + spacing.md }]}
          onPress={handleBack}
        >
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        <Animated.View style={imageStyle}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.image} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.placeholderText}>No photo</Text>
            </View>
          )}
        </Animated.View>

        <View style={styles.content}>
          {/* ─── Metadata row 1: category + organic ─── */}
          <Animated.View style={[styles.topRow, topRowStyle]}>
            <Text style={styles.category}>
              {listing.produce_categories?.name}
            </Text>
            {listing.is_organic ? (
              <View style={styles.organicBadge}>
                <Text style={styles.organicText}>Organic</Text>
              </View>
            ) : null}
          </Animated.View>

          {/* ─── Metadata row 2: LocationChip ─── */}
          {chipLocation ? (
            <Animated.View style={[styles.locationRow, locationStyle]}>
              <LocationChip location={chipLocation} size="sm" />
            </Animated.View>
          ) : null}

          <Animated.Text style={[styles.title, titleStyle]}>
            {listing.title}
          </Animated.Text>

          <View style={styles.priceRow}>
            <Animated.Text style={[styles.price, priceStyle]}>
              {formatZAR(listing.price)}/{listing.unit}
            </Animated.Text>
            <Animated.Text style={[styles.quantity, priceQtyStyle]}>
              {listing.quantity} {listing.unit}s available
            </Animated.Text>
          </View>

          {listing.description ? (
            <Animated.Text style={[styles.description, descStyle]}>
              {listing.description}
            </Animated.Text>
          ) : null}

          {ai ? (
            <Animated.View style={aiWrapStyle}>
              {/* v3: pass askingPrice + unit so AIDetailCard can render the
                  new AIPriceScale with the farmer's actual price as a tick */}
              <AIDetailCard
                ai={ai}
                leaving={isLeaving}
                askingPrice={listing.price}
                unit={listing.unit}
              />
            </Animated.View>
          ) : null}

          <Animated.View style={[styles.farmerCard, farmerStyle]}>
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
                {listing.farmer_profiles?.location_name ? (
                  <Text style={styles.farmerLocation}>
                    📍 {listing.farmer_profiles.location_name}
                  </Text>
                ) : null}
              </View>
            </View>

            {isBuyer && listing.farmer_profiles?.id && !alreadyReviewed ? (
              <Pressable
                onPress={() => setShowReview(true)}
                style={styles.reviewLink}
                hitSlop={8}
              >
                <Text style={styles.reviewLinkText}>⭐ Rate this farmer</Text>
              </Pressable>
            ) : null}
          </Animated.View>

          {listing.farmer_profiles?.id ? (
            <Animated.View style={trustStyle}>
              <FarmerTrustCard farmerProfileId={listing.farmer_profiles.id} />
            </Animated.View>
          ) : null}

          <Animated.View style={[styles.metaRow, metaStyle]}>
            <Text style={styles.metaText}>
              {listing.view_count} views · {listing.save_count} saves
            </Text>
            <Text style={styles.metaText}>{timeAgo(listing.created_at)}</Text>
          </Animated.View>
        </View>
      </ScrollView>

      {isBuyer ? (
        <Animated.View
          style={[
            styles.actionBar,
            { paddingBottom: spacing.sm },
            actionBarStyle,
          ]}
        >
          <Animated.View style={heartBtnStyle}>
            <SaveHeart isSaved={isSaved} onPress={handleSave} />
          </Animated.View>

          <Animated.View style={[{ flex: 1 }, waBtnStyle]}>
            <Pressable
              style={({ pressed }) => [
                styles.whatsappButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleWhatsApp}
            >
              <Text style={styles.whatsappIcon}>💬</Text>
              <Text style={styles.whatsappText}>WhatsApp</Text>
            </Pressable>
          </Animated.View>

          <Animated.View style={[{ flex: 1 }, msgBtnStyle]}>
            <Pressable
              style={({ pressed }) => [
                styles.messageButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleMessage}
            >
              <MessageCircle size={18} color="#fff" strokeWidth={2.2} />
              <Text style={styles.messageText}>Message</Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      ) : null}

      <Modal
        visible={showReview}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <ReviewSheet
          buyerProfileId={profileId}
          farmerProfileId={listing?.farmer_profiles?.id}
          farmerName={listing?.farmer_profiles?.farm_name || "This farmer"}
          listingId={listingId}
          listingTitle={listing?.title}
          onComplete={() => {
            setShowReview(false);
            setAlreadyReviewed(true);
            Alert.alert(
              "Thank you!",
              "Your review helps other buyers make better decisions.",
            );
          }}
          onCancel={() => setShowReview(false)}
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorText: { fontSize: fonts.body, color: colors.textSecondary },

  backButton: {
    position: "absolute",
    left: spacing.md,
    zIndex: 10,
    backgroundColor: "rgba(255,255,255,0.92)",
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

  // ─── v3 SPACING FIX ───
  // Previous: padding: spacing.lg (uniform). That put ~24px between the
  // image bottom and the category label, which the user (correctly)
  // flagged as too much. Now: tighter top, preserved horizontal, slightly
  // tighter bottom. The intro block reads as attached to the image.
  content: {
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },

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

  // ─── NEW v3: location row ───
  locationRow: {
    marginBottom: spacing.sm,
  },

  // Title — tightened from spacing.sm → spacing.xs so it feels connected
  // to the price row below it, not floating.
  title: {
    fontSize: fonts.h1,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.xs,
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
  farmerLocation: {
    fontSize: fonts.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  reviewLink: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
  },
  reviewLinkText: {
    fontSize: fonts.caption,
    color: colors.textPrimary,
    fontWeight: "600",
  },

  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  metaText: { fontSize: fonts.small, color: colors.textTertiary },

  // ─── Action bar ───
  actionBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.background,
  },
  heartButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: "visible",
  },
  heartBurst: {
    position: "absolute",
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(229, 62, 62, 0.35)",
  },
  heartFillWrap: { justifyContent: "center", alignItems: "center" },

  whatsappButton: {
    width: "100%",
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#25D366",
    borderRadius: radius.md,
  },
  whatsappIcon: { fontSize: 16 },
  whatsappText: {
    color: "#fff",
    fontSize: fonts.caption,
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  messageButton: {
    width: "100%",
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
  },
  messageText: {
    color: "#fff",
    fontSize: fonts.caption,
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
