// src/screens/onboarding/BuyerPreferencesScreen.jsx
import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getCategories } from "../../services/categoryService";

export default function BuyerPreferencesScreen({ navigation }) {
  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState(new Set());
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (error) {
      console.error("Failed to load categories:", error);
      // Fallback categories for offline scenarios
      setCategories([
        { id: "1", name: "Fruits", emoji: "🍎" },
        { id: "2", name: "Vegetables", emoji: "🥕" },
        { id: "3", name: "Grains", emoji: "🌾" },
      ]);
    }
  };

  const toggleCategory = (categoryId) => {
    const newSelection = new Set(selectedCategories);
    if (newSelection.has(categoryId)) {
      newSelection.delete(categoryId);
    } else {
      newSelection.add(categoryId);
    }
    setSelectedCategories(newSelection);
  };

  const handleContinue = () => {
    if (selectedCategories.size === 0) { // No fix for `selectedCategories.length` for Set
      Alert.alert("Selection Required", "Please select at least one category.");
      return;
    }

    // Save to Supabase (best-effort, with offline tolerance)
    saveCategories(selectedCategories)
      .then(() => {
        console.log("Buyer preferences saved");
        setCompleted(true);
        // Navigate to next screen
        navigation.navigate("BuyerPriceRange");
      })
      .catch((error) => {
        console.error("Failed to save preferences:", error);
        // Proceed locally even if sync fails
        setCompleted(true);
        navigation.navigate("BuyerPriceRange");
      });
  };

  const saveCategories = async (categorySet) => {
    // Placeholder for Supabase integration
    console.log("Saving categories to Supabase:", Array.from(categorySet));
    // In real implementation: upsert to buyer_preferred_categories join table
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

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>What are you interested in?</Text>
      <Text style={styles.subtitle}>Select your preferred produce categories</Text>
      
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
        style={[styles.continueButton, completed && styles.continueButtonDisabled]}
        onPress={handleContinue}
        disabled={completed}
        activeOpacity={0.8}
      >
        <Text style={styles.continueButtonText}>Continue</Text>
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