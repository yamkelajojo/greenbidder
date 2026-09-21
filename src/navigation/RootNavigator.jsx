import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { useAuth } from "../hooks/useAuth";
import AuthStack from "./AuthStack";
import MainTabs from "./MainTabs";
import { Spinner, YStack } from "tamagui";

/**
 * When true, skip the auth gate and go straight to MainTabs. Useful while
 * the Supabase project is paused/unreachable so we can still develop and
 * smoke-test features (notably on-device disease detection).
 *
 * Guarded by __DEV__ so a production/release build never accidentally ships
 * with the bypass enabled — a release build always requires auth.
 */
const FORCE_AUTH_BYPASS = __DEV__;

export default function RootNavigator() {
  const { session, isLoading } = useAuth();

  if (isLoading && !FORCE_AUTH_BYPASS) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center">
        <Spinner size="large" color="$primary" />
      </YStack>
    );
  }

  return (
    <NavigationContainer>
      {session || FORCE_AUTH_BYPASS ? <MainTabs /> : <AuthStack />}
    </NavigationContainer>
  );
}
