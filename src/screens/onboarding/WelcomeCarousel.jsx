// src/screens/onboarding/WelcomeCarousel.jsx
import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  StatusBar,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
  Extrapolate,
} from "react-native-reanimated";
import PagerView from "react-native-pager-view";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useOnboarding } from "../../context/OnboardingContext";
import { colors, spacing, fonts, radius } from "../../config/theme";
import TactilePressable from "../../components/shared/TactilePressable";
import FadeSlideIn from "../../components/shared/FadeSlideIn";
import ProgressBar from "../../components/onboarding/ProgressBar";
import { haptic } from "../../utils/haptics";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ── SLIDE DATA ─────────────────────────────────────────────────
const SLIDES = [
  {
    id: "ai-quality",
    title: "Know Exactly\nWhat You're Buying",
    subtitle:
      "Our AI analyzes freshness, ripeness, and quality from every photo — so you never guess.",
    image: require("../../assets/onboarding/ai-scan.png"), // Create this asset
    badge: "10,000+ listings analyzed",
    accentColor: colors.success,
  },
  {
    id: "personalized",
    title: "Your Feed Learns\nYour Taste",
    subtitle:
      "Smart recommendations adapt to what you love — based on what you view, save, and buy.",
    image: require("../../assets/onboarding/personalized-feed.png"),
    badge: "Powered by behavioral AI",
    accentColor: colors.primary,
  },
  {
    id: "market-intel",
    title: "Fair Prices,\nAlways",
    subtitle:
      "Real-time market data + AI suggestions ensure farmers price fairly and buyers get value.",
    image: require("../../assets/onboarding/market-chart.png"),
    badge: "Live price tracking",
    accentColor: colors.warning,
  },
];

export default function WelcomeCarousel() {
  const navigation = useNavigation();
  const { markStepComplete, setHasGrantedLocation } = useOnboarding();

  const pagerRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Animation values
  const scrollOffset = useSharedValue(0);
  const isLastSlide = activeIndex === SLIDES.length - 1;

  // ── HANDLERS ─────────────────────────────────────────────────
  const handlePageSelected = (e) => {
    const index = e.nativeEvent.position;
    setActiveIndex(index);
    haptic.selection(); // Subtle haptic on slide change
  };

  const handleNext = () => {
    if (activeIndex < SLIDES.length - 1) {
      pagerRef.current?.setPage(activeIndex + 1);
    } else {
      // Final slide: proceed to location permission
      markStepComplete("welcome");
      setHasGrantedLocation(false); // Reset for fresh permission request
      navigation.replace("LocationPermission");
    }
  };

  const handleSkip = () => {
    // Allow skipping carousel but still mark as seen
    markStepComplete("welcome");
    navigation.replace("LocationPermission");
  };

  // ── ANIMATED STYLES ──────────────────────────────────────────
  const imageAnimatedStyle = useAnimatedStyle(() => {
    // Parallax effect: image moves slower than slide
    const translateX = interpolate(
      scrollOffset.value,
      [
        (activeIndex - 1) * SCREEN_WIDTH,
        activeIndex * SCREEN_WIDTH,
        (activeIndex + 1) * SCREEN_WIDTH,
      ],
      [-SCREEN_WIDTH * 0.1, 0, SCREEN_WIDTH * 0.1],
      Extrapolate.CLAMP,
    );

    const scale = interpolate(
      scrollOffset.value,
      [
        (activeIndex - 1) * SCREEN_WIDTH,
        activeIndex * SCREEN_WIDTH,
        (activeIndex + 1) * SCREEN_WIDTH,
      ],
      [0.95, 1, 0.95],
      Extrapolate.CLAMP,
    );

    return {
      transform: [{ translateX }, { scale }],
    };
  });

  const titleAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollOffset.value,
      [
        (activeIndex - 0.5) * SCREEN_WIDTH,
        activeIndex * SCREEN_WIDTH,
        (activeIndex + 0.5) * SCREEN_WIDTH,
      ],
      [0.3, 1, 0.3],
      Extrapolate.CLAMP,
    );

    const translateY = interpolate(
      scrollOffset.value,
      [
        (activeIndex - 0.5) * SCREEN_WIDTH,
        activeIndex * SCREEN_WIDTH,
        (activeIndex + 0.5) * SCREEN_WIDTH,
      ],
      [20, 0, 20],
      Extrapolate.CLAMP,
    );

    return { opacity, transform: [{ translateY }] };
  });

  // ── RENDER ───────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      {/* Skip button */}
      <View style={styles.skipContainer}>
        <TactilePressable
          onPress={handleSkip}
          haptic="light"
          style={styles.skipButton}
        >
          <Text style={styles.skipText}>Skip</Text>
        </TactilePressable>
      </View>

      {/* Pager */}
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        onPageSelected={handlePageSelected}
        scrollEnabled
      >
        {SLIDES.map((slide, index) => (
          <View key={slide.id} style={styles.slide} collapsable={false}>
            {/* Image with parallax */}
            <Animated.View style={[styles.imageContainer, imageAnimatedStyle]}>
              <Image
                source={slide.image}
                style={styles.image}
                resizeMode="contain"
              />
            </Animated.View>

            {/* Content */}
            <View style={styles.content}>
              {/* Badge */}
              <FadeSlideIn delay={200 + index * 100}>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: slide.accentColor + "20" },
                  ]}
                >
                  <Text
                    style={[styles.badgeText, { color: slide.accentColor }]}
                  >
                    {slide.badge}
                  </Text>
                </View>
              </FadeSlideIn>

              {/* Title */}
              <Animated.Text style={[styles.title, titleAnimatedStyle]}>
                {slide.title}
              </Animated.Text>

              {/* Subtitle */}
              <FadeSlideIn delay={400 + index * 100} distance={8}>
                <Text style={styles.subtitle}>{slide.subtitle}</Text>
              </FadeSlideIn>
            </View>
          </View>
        ))}
      </PagerView>

      {/* Bottom controls */}
      <View style={styles.controls}>
        <ProgressBar
          current={activeIndex + 1}
          total={SLIDES.length}
          accentColor={SLIDES[activeIndex].accentColor}
        />

        <TactilePressable
          style={[
            styles.nextButton,
            { backgroundColor: SLIDES[activeIndex].accentColor },
          ]}
          onPress={handleNext}
          haptic="commit"
        >
          <Text style={styles.nextButtonText}>
            {isLastSlide ? "Get Started" : "Next"}
          </Text>
        </TactilePressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  skipContainer: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    zIndex: 10,
  },
  skipButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  skipText: {
    fontSize: fonts.caption,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  pager: {
    flex: 1,
  },
  slide: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: "center",
  },
  imageContainer: {
    height: SCREEN_WIDTH * 0.6,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  image: {
    width: SCREEN_WIDTH * 0.8,
    height: SCREEN_WIDTH * 0.6,
  },
  content: {
    alignItems: "center",
  },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginBottom: spacing.lg,
  },
  badgeText: {
    fontSize: fonts.small,
    fontWeight: "600",
  },
  title: {
    fontSize: fonts.h1,
    fontWeight: "800",
    color: colors.textPrimary,
    textAlign: "center",
    lineHeight: fonts.h1 * 1.1,
    marginBottom: spacing.md,
  },
  subtitle: {
    fontSize: fonts.body,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: fonts.body * 1.5,
    paddingHorizontal: spacing.lg,
  },
  controls: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    alignItems: "center",
  },
  nextButton: {
    height: 56,
    borderRadius: radius.lg,
    justifyContent: "center",
    alignItems: "center",
    marginTop: spacing.lg,
    width: "100%",
  },
  nextButtonText: {
    color: "#fff",
    fontSize: fonts.body,
    fontWeight: "700",
  },
});
