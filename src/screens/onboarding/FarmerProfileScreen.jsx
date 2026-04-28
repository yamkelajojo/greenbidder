// src/screens/onboarding/FarmerProfileScreen.jsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function FarmerProfileScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text>Farmer Profile - Coming Next</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
});
