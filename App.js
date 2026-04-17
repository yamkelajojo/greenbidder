import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { TamaguiProvider, Theme } from "tamagui";
import { SafeAreaProvider } from "react-native-safe-area-context";
import config from "./src/config/tamagui.config";
import { AuthProvider } from "./src/hooks/useAuth";
import { FeedbackProvider } from "./src/components/feedback/FeedbackProvider";
import RootNavigator from "./src/navigation/RootNavigator";

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <TamaguiProvider config={config}>
          <Theme name="light">
            <FeedbackProvider>
              <AuthProvider>
                <RootNavigator />
              </AuthProvider>
            </FeedbackProvider>
          </Theme>
        </TamaguiProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
