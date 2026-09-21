import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { useAuth } from "../hooks/useAuth";
import AuthStack from "./AuthStack";
import MainTabs from "./MainTabs";
import { Spinner, YStack } from "tamagui";

export default function RootNavigator() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center">
        <Spinner size="large" color="$primary" />
      </YStack>
    );
  }

  // TEMP: skip auth for disease-detection testing (Supabase project is paused)
  // TODO: revert this before shipping
  const FORCE_AUTH_BYPASS = true;

  return (
    <NavigationContainer>
      {session || FORCE_AUTH_BYPASS ? <MainTabs /> : <AuthStack />}
    </NavigationContainer>
  );
}
