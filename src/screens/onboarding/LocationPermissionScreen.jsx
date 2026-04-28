// src/screens/onboarding/LocationPermissionScreen.jsx
import React, { useState } from "react";
import { View, Text, StyleSheet, Image, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import * as Location from "expo-location";
import { useOnboarding } from "../../context/OnboardingContext";
import { colors, spacing, fonts, radius } from "../../config/theme";
import TactilePressable from "../../components/shared/TactilePressable";
import FadeSlideIn from "../../components/shared/FadeSlideIn";
import { haptic } from "../../utils/haptics";

export default function LocationPermissionScreen() {
  const navigation = useNavigation();
  const { setLocation, setHasGrantedLocation, markStepComplete, userRole } =
    useOnboarding();
  const [isLoading, setIsLoading] = useState(false);

  const requestLocationPermission = async () => {
    setIsLoading(true);
    haptic.selection();

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status === "granted") {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        setLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        setHasGrantedLocation(true);
        markStepComplete("location");

        // Navigate to role-specific next step
        setTimeout(() => {
          navigation.replace(
            userRole === "farmer" ? "FarmerProfile" : "BuyerPreferences",
          );
        }, 300);
      } else {
        // Permission denied - use default
        handleSkip();
      }
    } catch (error) {
      console.warn("Location permission error:", error);
      handleSkip();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    haptic.light();
    markStepComplete("location");
    setHasGrantedLocation(false);

    // Set a default location (could be major city center)
    setLocation({
      latitude: -26.2041, // Johannesburg as default
      longitude: 28.0473,
    });

    setTimeout(() => {
      navigation.replace(
        userRole === "farmer" ? "FarmerProfile" : "BuyerPreferences",
      );
    }, 300);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Back button */}
      <View style={styles.backContainer}>
        <TactilePressable
          onPress={() => navigation.goBack()}
          haptic="light"
          style={styles.backButton}
        >
          <Text style={styles.backText}>← Back</Text>
        </TactilePressable>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Illustration placeholder */}
        <FadeSlideIn delay={100}>
          <View style={styles.illustration}>
            <View style={styles.mapPlaceholder}>
              <Text style={styles.mapIcon}>🗺️</Text>
            </View>
          </View>
        </FadeSlideIn>

        {/* Title */}
        <FadeSlideIn delay={250} distance={8}>
          <Text style={styles.title}>Find Fresh Produce Near You</Text>
        </FadeSlideIn>

        {/* Description */}
        <FadeSlideIn delay={350} distance={6}>
          <Text style={styles.description}>We'll use your location to:</Text>
        </FadeSlideIn>

        <FadeSlideIn delay={420} distance={6}>
          <View style={styles.benefits}>
            <View style={styles.benefitItem}>
              <Text style={styles.benefitBullet}>•</Text>
              <Text style={styles.benefitText}>
                Show farms within your preferred radius
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <Text style={styles.benefitBullet}>•</Text>
              <Text style={styles.benefitText}>
                Calculate delivery distance accurately
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <Text style={styles.benefitBullet}>•</Text>
              <Text style={styles.benefitText}>
                Personalize recommendations for your area
              </Text>
            </View>
          </View>
        </FadeSlideIn>

        {/* Buttons */}
        <View style={styles.buttons}>
          <FadeSlideIn delay={600}>
            <TactilePressable
              style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
              onPress={requestLocationPermission}
              disabled={isLoading}
              haptic="commit"
            >
              <Text style={styles.primaryButtonText}>
                {isLoading ? "Getting location..." : "Enable Location"}
              </Text>
            </TactilePressable>
          </FadeSlideIn>

          <FadeSlideIn delay={680}>
            <TactilePressable
              style={styles.secondaryButton}
              onPress={handleSkip}
              haptic="light"
            >
              <Text style={styles.secondaryButtonText}>Skip for Now</Text>
            </TactilePressable>
          </FadeSlideIn>
        </View>

        {/* Privacy note */}
        <FadeSlideIn delay={760}>
          <Text style={styles.privacyNote}>
            We never share your exact location with other users
          </Text>
        </FadeSlideIn>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  backContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  backButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  backText: {
    fontSize: fonts.caption,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: "center",
    alignItems: "center",
  },
  illustration: {
    width: 200,
    height: 200,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.xxl,
  },
  mapPlaceholder: {
    width: 180,
    height: 180,
    borderRadius: radius.xl,
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: "dashed",
  },
  mapIcon: {
    fontSize: 80,
  },
  title: {
    fontSize: fonts.h1,
    fontWeight: "800",
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: spacing.lg,
    lineHeight: fonts.h1 * 1.1,
  },
  description: {
    fontSize: fonts.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  benefits: {
    alignItems: "flex-start",
    marginBottom: spacing.xl,
  },
  benefitItem: {
    flexDirection: "row",
    marginBottom: spacing.sm,
    alignItems: "flex-start",
  },
  benefitBullet: {
    fontSize: fonts.body,
    color: colors.primary,
    marginRight: spacing.sm,
    fontWeight: "700",
  },
  benefitText: {
    fontSize: fonts.body,
    color: colors.textBody,
    flex: 1,
    lineHeight: fonts.body * 1.4,
  },
  buttons: {
    width: "100%",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  primaryButton: {
    height: 56,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: colors.onPrimary,
    fontSize: fonts.body,
    fontWeight: "700",
  },
  secondaryButton: {
    height: 56,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.textSecondary,
    fontSize: fonts.body,
    fontWeight: "600",
  },
  privacyNote: {
    fontSize: fonts.small,
    color: colors.textTertiary,
    textAlign: "center",
    paddingHorizontal: spacing.lg,
  },
});
