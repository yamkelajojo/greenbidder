import React from "react";
import { YStack, H2, Paragraph } from "tamagui";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LoginScreen({ navigation }) {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <YStack flex={1} padding="$4" justifyContent="center" alignItems="center">
        <H2>GreenBidder</H2>
        <Paragraph color="$textSecondary" marginTop="$2">
          Login screen — to be built in feature/auth
        </Paragraph>
      </YStack>
    </SafeAreaView>
  );
}
