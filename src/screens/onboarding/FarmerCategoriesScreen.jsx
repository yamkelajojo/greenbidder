// src/screens/onboarding/FarmerCategoriesScreen.jsx
import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCategorySelection } from "../../hooks/useCategorySelection";
import { useOnboarding } from "../../context/OnboardingContext";
import { saveFarmerSpecializations } from "../../services/categoryService";

export default function FarmerCategoriesScreen({ navigation }) {
  const { categories, selectedCategories, toggleCategory, selectionCount, isLoading } = useCategorySelection();
  const { farmProfile, setFarmProfile, markStepComplete } = useOnboarding();
  const [isSaving, setIsSaving] = useState(false);

  const handleContinue = async () => {
    if (selectionCount === 0) {
      Alert.alert("Selection Required", "Please select at least one category.");
      return;
    }

    setIsSaving(true);
    const categoryIds = Array.from(selectedCategories);

    setFarmProfile({
      ...farmProfile,
      specializations: categoryIds,
    });

    if (farmProfile.id) {
      const { error } = await saveFarmerSpecializations(farmProfile.id, categoryIds);
      if (error) {
        const pendingData = JSON.stringify({ farmerProfileId: farmProfile.id, categoryIds });
        await AsyncStorage.setItem("pending_specializations", pendingData);
      }
    }

    setIsSaving(false);
    markStepComplete('farmerCategories');
    navigation.navigate("FarmerPricingGuide");
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.categoryTile,
        selectedCategories.has(item.id) && styles.selectedTile,
      ]}
      onPress={() => toggleCategory(item.id)}
      activeOpacity={0.7}
    >
      <Text style={styles.emoji}>{item.emoji}</Text>
      <Text style={styles.categoryName}>{item.name}</Text>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>What do you usually sell?</Text>
      <Text style={styles.subtitle}>Select your main produce categories</Text>
      
      <FlatList
        data={categories}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        contentContainerStyle={styles.list}
        initialNumToRender={6}
        windowSize={5}
      />
      
      <TouchableOpacity
        style={[styles.continueButton, (selectionCount === 0 || isSaving) && styles.continueButtonDisabled]}
        onPress={handleContinue}
        activeOpacity={0.8}
        disabled={isSaving}
      >
        {isSaving ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.continueButtonText}>Continue to Pricing Guide</Text>
        )}
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
    fontSize: 24,
    fontWeight: "bold",
    margin: 16,
    color: "#333",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginHorizontal: 16,
    marginBottom: 12,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  categoryTile: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    margin: 8,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 120,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  selectedTile: {
    backgroundColor: "#E8F5E9",
    borderWidth: 2,
    borderColor: "#4CAF50",
  },
  emoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  categoryName: {
    fontSize: 12,
    textAlign: "center",
    color: "#555",
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