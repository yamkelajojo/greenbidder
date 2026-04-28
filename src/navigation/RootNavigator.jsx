// src/navigation/RootNavigator.jsx (modify existing)
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { useAuth } from "../hooks/useAuth";
import { useOnboarding } from "../context/OnboardingContext";
import AuthStack from "./AuthStack";
import MainTabs from "./MainTabs";
import OnboardingStack from "./OnboardingStack"; // NEW
import LoadingScreen from "../screens/shared/LoadingScreen"; // Ensure LoadingScreen exists

export default function RootNavigator() {
  const { user, isLoading: authLoading } = useAuth();
  const { isOnboardingComplete } = useOnboarding(); // NEW

  // Show loading while auth initializes
  if (authLoading) {
    return <LoadingScreen />; // You have this component
  }

  // Navigation logic
  if (!user) {
    // Not authenticated: show AuthStack
    return (
      <NavigationContainer>
        <AuthStack />
      </NavigationContainer>
    );
  }

  if (!isOnboardingComplete) {
    // Authenticated but onboarding incomplete: show OnboardingStack
    return (
      <NavigationContainer>
        <OnboardingStack />
      </NavigationContainer>
    );
  }

  // Fully onboarded: show main app
  return (
    <NavigationContainer>
      <MainTabs />
    </NavigationContainer>
  );
}
