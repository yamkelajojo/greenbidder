import React from "react";
import { YStack, H2, Paragraph } from "tamagui";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ListingDetailScreen({ route, navigation }) {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <YStack flex={1} padding="$4">
        <H2>Listing Detail</H2>
        <Paragraph color="$textSecondary" marginTop="$2">
          Detail view — coming soon
        </Paragraph>
      </YStack>
    </SafeAreaView>
  );
}
