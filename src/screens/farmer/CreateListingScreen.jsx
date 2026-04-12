import React from "react";
import { YStack, H2, Paragraph } from "tamagui";
import { SafeAreaView } from "react-native-safe-area-context";

export default function CreateListingScreen({ navigation }) {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <YStack flex={1} padding="$4">
        <H2>Create Listing</H2>
        <Paragraph color="$textSecondary" marginTop="$2">
          Create listing — coming soon
        </Paragraph>
      </YStack>
    </SafeAreaView>
  );
}
