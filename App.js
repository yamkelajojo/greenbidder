// src/App.js (modify existing)
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { TamaguiProvider, Theme } from "tamagui";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet"; // NEW
import config from "./src/config/tamagui.config";
import { AuthProvider } from "./src/hooks/useAuth";
import { OnboardingProvider } from "./src/context/OnboardingContext"; // NEW
import { FeedbackProvider } from "./src/components/feedback/FeedbackProvider";
import RootNavigator from "./src/navigation/RootNavigator";
import { AIModalProvider } from "./src/components/ai/AIModalContext";
import AIModal from "./src/components/ai/AIModal";

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <TamaguiProvider config={config}>
        <SafeAreaProvider>
          <BottomSheetModalProvider>
            {" "}
            {/* NEW: for bottom sheets */}
            <AuthProvider>
              <OnboardingProvider>
                {" "}
                {/* NEW: onboarding state */}
                <FeedbackProvider>
                  <AIModalProvider>
                    <RootNavigator />
                    <AIModal />
                  </AIModalProvider>
                </FeedbackProvider>
              </OnboardingProvider>
            </AuthProvider>
          </BottomSheetModalProvider>
        </SafeAreaProvider>
      </TamaguiProvider>
    </GestureHandlerRootView>
  );
}
