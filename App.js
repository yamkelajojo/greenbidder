import React from "react";
import { TamaguiProvider, Theme } from "tamagui";
import { SafeAreaProvider } from "react-native-safe-area-context";
import config from "./src/config/tamagui.config";
import { AuthProvider } from "./src/hooks/useAuth";
import RootNavigator from "./src/navigation/RootNavigator";

/**
 * App entry point.
 * Provider hierarchy (outermost to innermost):
 *   SafeAreaProvider → TamaguiProvider → AuthProvider → RootNavigator
 */
export default function App() {
  return (
    <SafeAreaProvider>
      <TamaguiProvider config={config}>
        <Theme name="light">
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </Theme>
      </TamaguiProvider>
    </SafeAreaProvider>
  );
}
