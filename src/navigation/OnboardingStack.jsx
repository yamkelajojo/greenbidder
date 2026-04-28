// src/navigation/OnboardingStack.jsx
import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../hooks/useAuth";
import { useOnboarding } from "../context/OnboardingContext";

// Shared screens
import WelcomeCarousel from "../screens/onboarding/WelcomeCarousel";
import LocationPermissionScreen from "../screens/onboarding/LocationPermissionScreen";

// Buyer screens
import BuyerPreferencesScreen from "../screens/onboarding/BuyerPreferencesScreen";
import BuyerPriceRangeScreen from "../screens/onboarding/BuyerPriceRangeScreen";

// Farmer screens
import FarmerProfileScreen from "../screens/onboarding/FarmerProfileScreen";
import FarmerCategoriesScreen from "../screens/onboarding/FarmerCategoriesScreen";
import FarmerPricingGuide from "../screens/onboarding/FarmerPricingGuide";

// Completion screen
import OnboardingComplete from "../screens/onboarding/OnboardingComplete";

const Stack = createNativeStackNavigator();

export default function OnboardingStack() {
  const { userRole } = useAuth();
  const { completedSteps, userOnboardingProgress } = useOnboarding();
  const isFarmer = userRole === "farmer";

  // Determine initial route based on role and completed steps
  const getInitialRoute = () => {
    // Check completed steps to determine resumable position
    if (isFarmer) {
      if (completedSteps.includes("farmerCategories")) {
        return "FarmerPricingGuide";
      }
      if (completedSteps.includes("farmerProfile")) {
        return "FarmerCategories";
      }
      return "FarmerProfile";
    } else {
      if (completedSteps.includes("buyerPreferences")) {
        return "BuyerPriceRange";
      }
      return "BuyerPreferences";
    }
  };

  return (
    <Stack.Navigator
      initialRouteName={getInitialRoute()}
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        animationDuration: 250,
      }}
    >
      {/* Shared entry points — always available */}
      <Stack.Screen name="WelcomeCarousel" component={WelcomeCarousel} />
      <Stack.Screen
        name="LocationPermission"
        component={LocationPermissionScreen}
      />

      {/* Buyer track */}
      <Stack.Screen
        name="BuyerPreferences"
        component={BuyerPreferencesScreen}
        options={{ animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="BuyerPriceRange"
        component={BuyerPriceRangeScreen}
        options={{ animation: "slide_from_bottom" }}
      />

      {/* Farmer track */}
      <Stack.Screen
        name="FarmerProfile"
        component={FarmerProfileScreen}
        options={{ animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="FarmerCategories"
        component={FarmerCategoriesScreen}
        options={{ animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="FarmerPricingGuide"
        component={FarmerPricingGuide}
        options={{ animation: "slide_from_bottom" }}
      />

      {/* Completion screen */}
      <Stack.Screen
        name="OnboardingComplete"
        component={OnboardingComplete}
        options={{ animation: "slide_from_bottom" }}
      />
    </Stack.Navigator>
  );
}
