// src/screens/onboarding/BuyerPriceRangeScreen.jsx
import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useOnboarding } from "../../context/OnboardingContext";
import { saveBudgetTier } from "../../services/buyerPreferenceStore";

export default function BuyerPriceRangeScreen({ navigation }) {
  const { priceRange, setPriceRange, completeBuyerOnboardingMock } =
    useOnboarding();
  const [selectedTier, setSelectedTier] = useState(null);
  const [completed, setCompleted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const tiers = [
    {
      id: "budget",
      title: "Budget",
      description: "Starter prices, great for testing",
      range: { min: 0, max: 40 },
      color: "#FFB74D",
    },
    {
      id: "balanced",
      title: "Balanced",
      description: "Good value for quality",
      range: { min: 10, max: 80 },
      color: "#64B5F6",
    },
    {
      id: "premium",
      title: "Premium",
      description: "High-end quality assurance",
      range: { min: 20, max: 150 },
      color: "#AB47BC",
    },
  ];

  const handleTierSelect = (tier) => {
    setSelectedTier(tier.id);
    setPriceRange(tier.range);
  };

  const savePriceRange = async (range) => {
    setPriceRange(range);
    const tierId = selectedTier || "custom";
    await saveBudgetTier({ tierId, min: range.min, max: range.max });
  };

  const handleContinue = async () => {
    if (!selectedTier || completed || isSaving) {
      if (!selectedTier) {
        Alert.alert("Selection Required", "Please select a budget tier.");
      }
      return;
    }

    setIsSaving(true);
    try {
      await savePriceRange(priceRange);
      await completeBuyerOnboardingMock();
      setCompleted(true);
      // RootNavigator will automatically switch to MainTabs when isOnboardingComplete becomes true.
    } catch (error) {
      console.error("Failed to save price range:", error);
      Alert.alert(
        "Unable to Save",
        "We could not save your budget tier locally. Please try again.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Select Your Budget Tier</Text>
      <Text style={styles.subtitle}>Choose the plan that fits your needs</Text>

      {tiers.map((tier) => (
        <TouchableOpacity
          key={tier.id}
          style={[
            styles.tierCard,
            selectedTier === tier.id && styles.selectedTier,
            { backgroundColor: tier.color },
          ]}
          onPress={() => handleTierSelect(tier)}
          activeOpacity={0.8}
        >
          <Text style={styles.tierTitle}>{tier.title}</Text>
          <Text style={styles.tierDescription}>{tier.description}</Text>
          <Text style={styles.tierRange}>
            Range: ${tier.range.min} - ${tier.range.max}/kg
          </Text>
          {selectedTier === tier.id && (
            <Text style={styles.selectedIndicator}>✓ Selected</Text>
          )}
        </TouchableOpacity>
      ))}

      <TouchableOpacity
        style={[
          styles.continueButton,
          (completed || isSaving) && styles.continueButtonDisabled,
        ]}
        onPress={handleContinue}
        disabled={!selectedTier || completed || isSaving}
        activeOpacity={0.8}
      >
        <Text style={styles.continueButtonText}>
          {isSaving ? "Saving..." : "Continue to Main App"}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    margin: 16,
    color: "#333",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginHorizontal: 16,
    marginBottom: 16,
  },
  tierCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    margin: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  selectedTier: {
    borderWidth: 2,
    borderColor: "#000",
  },
  tierTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
  },
  tierDescription: {
    fontSize: 12,
    color: "#666",
    marginBottom: 8,
  },
  tierRange: {
    fontSize: 12,
    color: "#555",
  },
  selectedIndicator: {
    marginTop: 8,
    color: "#4CAF50",
    fontWeight: "bold",
  },
  continueButton: {
    backgroundColor: "#4CAF50",
    padding: 16,
    alignItems: "center",
    margin: 16,
    borderRadius: 8,
  },
  continueButtonDisabled: {
    backgroundColor: "#CCCCCC",
  },
  continueButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
});
