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

const Stack = createNativeStackNavigator();

export default function OnboardingStack() {
  const { userRole } = useAuth();
  const { isOnboardingComplete } = useOnboarding();

  const isFarmer = userRole === "farmer";

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        animationDuration: 250,
      }}
    >
      {/* Shared entry points */}
      <Stack.Screen name="WelcomeCarousel" component={WelcomeCarousel} />
      <Stack.Screen
        name="LocationPermission"
        component={LocationPermissionScreen}
      />

      {/* Buyer track */}
      {!isFarmer && (
        <>
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
        </>
      )}

      {/* Farmer track */}
      {isFarmer && (
        <>
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
        </>
      )}

      {/* Fallback - should redirect to MainTabs if complete */}
      <Stack.Screen
        name="OnboardingComplete"
        component={isFarmer ? FarmerPricingGuide : BuyerPriceRange}
        options={{ animationEnabled: false }}
      />
    </Stack.Navigator>
  );
}
