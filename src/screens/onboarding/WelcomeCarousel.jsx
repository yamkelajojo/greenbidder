import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Dimensions, StatusBar, Image } from "react-native";
import Animated from "react-native-reanimated";
import PagerView from "react-native-pager-view";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useOnboarding } from "../../context/OnboardingContext";
import { colors, spacing, fonts, radius } from "../../config/theme";
import TactilePressable from "../../components/shared/TactilePressable";
import ProgressBar from "../../components/onboarding/ProgressBar";
import { haptic } from "../../utils/haptics";
import useOnboardingSlideMotion from "../../hooks/useOnboardingSlideMotion";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const SLIDES = [
  {
    id: "ai-quality",
    title: "Know Exactly\nWhat You're Buying",
    subtitle:
      "Our AI analyzes freshness, ripeness, and quality from every photo, so you never guess.",
    image: require("../../../assets/onboarding/ai-scan.png"),
    badge: "10,000+ listings analyzed",
    accentColor: colors.success,
  },
  {
    id: "personalized",
    title: "Your Feed Learns\nYour Taste",
    subtitle:
      "Smart recommendations adapt to what you love, based on what you view, save, and buy.",
    image: require("../../../assets/onboarding/personalized-feed.png"),
    badge: "Powered by behavioral AI",
    accentColor: colors.primary,
  },
  {
    id: "market-intel",
    title: "Fair Prices,\nAlways",
    subtitle:
      "Real-time market data plus AI suggestions ensure farmers price fairly and buyers get value.",
    image: require("../../../assets/onboarding/market-chart.png"),
    badge: "Live price tracking",
    accentColor: colors.warning,
  },
];

export default function WelcomeCarousel() {
  const navigation = useNavigation();
  const { markStepComplete, setHasGrantedLocation } = useOnboarding();
  const pagerRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const motion = useOnboardingSlideMotion({
    slideCount: SLIDES.length,
    screenWidth: SCREEN_WIDTH,
  });

  useEffect(() => {
    motion.activateSlide(0);
  }, []);

  const isLastSlide = activeIndex === SLIDES.length - 1;

  const handlePageSelected = (e) => {
    const index = e.nativeEvent.position;
    setActiveIndex(index);
    motion.activateSlide(index);
    haptic.selection();
  };

  const handlePageScroll = (e) => {
    motion.bindPagerScroll(e);
  };

  const handleNext = () => {
    if (activeIndex < SLIDES.length - 1) {
      pagerRef.current?.setPage(activeIndex + 1);
      return;
    }
    markStepComplete("welcome");
    setHasGrantedLocation(false);
    navigation.replace("LocationPermission");
  };

  const handleSkip = () => {
    markStepComplete("welcome");
    navigation.replace("LocationPermission");
  };

  const currentSlide = SLIDES[activeIndex];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.backgroundSecondary} />

      <View style={styles.skipContainer}>
        <TactilePressable onPress={handleSkip} haptic="light" style={styles.skipButton}>
          <Text style={styles.skipText}>Skip</Text>
        </TactilePressable>
      </View>

      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        onPageSelected={handlePageSelected}
        onPageScroll={handlePageScroll}
        scrollEnabled
      >
        {SLIDES.map((slide, index) => {
          const { imageStyle, badgeStyle, titleStyle, subtitleStyle } =
            motion.getSlideStyles(index);
          return (
            <View key={slide.id} style={styles.slide} collapsable={false}>
              <View style={styles.imageContainer}>
                <Animated.View style={[styles.imageFrame, imageStyle]}>
                  <Image source={slide.image} style={styles.slideImage} />
                </Animated.View>
              </View>

              <View style={styles.content}>
                <Animated.View style={badgeStyle}>
                  <View style={[styles.badge, { backgroundColor: slide.accentColor + "20" }]}>
                    <Text style={[styles.badgeText, { color: slide.accentColor }]}>{slide.badge}</Text>
                  </View>
                </Animated.View>

                <Animated.Text style={[styles.title, titleStyle]}>{slide.title}</Animated.Text>
                <Animated.Text style={[styles.subtitle, subtitleStyle]}>{slide.subtitle}</Animated.Text>
              </View>
            </View>
          );
        })}
      </PagerView>

      <View style={styles.controls}>
        <ProgressBar
          current={activeIndex + 1}
          total={SLIDES.length}
          accentColor={currentSlide.accentColor}
          motionState={motion.getProgressStyles()}
        />
        <TactilePressable
          style={[styles.nextButton, { backgroundColor: currentSlide.accentColor }]}
          onPress={handleNext}
          haptic="commit"
        >
          <Text style={styles.nextButtonText}>{isLastSlide ? "Get Started" : "Next"}</Text>
        </TactilePressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  skipContainer: { position: "absolute", top: spacing.md, right: spacing.md, zIndex: 10 },
  skipButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  skipText: { fontSize: fonts.caption, color: colors.textSecondary, fontWeight: "500" },
  pager: { flex: 1 },
  slide: { flex: 1, paddingHorizontal: spacing.xl, justifyContent: "center" },
  imageContainer: {
    height: SCREEN_WIDTH * 0.6,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  imageFrame: {
    width: SCREEN_WIDTH * 0.84,
    height: SCREEN_WIDTH * 0.58,
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  slideImage: { width: "100%", height: "100%", resizeMode: "cover" },
  content: { alignItems: "center" },
  badge: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full, marginBottom: spacing.lg },
  badgeText: { fontSize: fonts.small, fontWeight: "600" },
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
  controls: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, alignItems: "center", backgroundColor: colors.background },
  nextButton: {
    height: 56,
    borderRadius: radius.lg,
    justifyContent: "center",
    alignItems: "center",
    marginTop: spacing.lg,
    width: "100%",
  },
  nextButtonText: { color: "#fff", fontSize: fonts.body, fontWeight: "700" },
});
