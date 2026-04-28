// src/navigation/RootNavigator.jsx
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { useAuth } from "../hooks/useAuth";
import { useOnboarding } from "../context/OnboardingContext";
import AuthStack from "./AuthStack";
import MainTabs from "./MainTabs";
import OnboardingStack from "./OnboardingStack";
import LoadingScreen from "../screens/shared/LoadingScreen";

export default function RootNavigator() {
  const { user, isLoading: authLoading } = useAuth();
  const { isOnboardingComplete } = useOnboarding();

  // Show loading while auth initializes
  if (authLoading) {
    return <LoadingScreen />;
  }

  // Determine which navigator to show
  const isOnboarded = user && isOnboardingComplete;

  return (
    <NavigationContainer>
      {!user ? (
        <AuthStack />
      ) : !isOnboarded ? (
        <OnboardingStack />
      ) : (
        <MainTabs />
      )}
    </NavigationContainer>
  );
}
