// src/screens/onboarding/BuyerPreferencesScreen.jsx
import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCategorySelection } from "../../hooks/useCategorySelection";
import { useOnboarding } from "../../context/OnboardingContext";
import { saveBuyerPreferences } from "../../services/categoryService";
import { useAuth } from "../../hooks/useAuth";

export default function BuyerPreferencesScreen({ navigation }) {
  const { profileId } = useAuth();
  const {
    categories,
    selectedCategories,
    toggleCategory,
    selectionCount,
    isLoading,
  } = useCategorySelection();

  const { selectedCategories: contextCategories, setSelectedCategories, markStepComplete } = useOnboarding();

  const [completed, setCompleted] = React.useState(false);

  useEffect(() => {
    if (contextCategories && contextCategories.length > 0) {
      contextCategories.forEach((cat) => {
        toggleCategory(cat.id);
      });
    }
  }, []);

  const handleContinue = async () => {
    if (selectionCount === 0) {
      Alert.alert("Selection Required", "Please select at least one category.");
      return;
    }

    const categoryIds = Array.from(selectedCategories);
    setSelectedCategories(categoryIds);

    if (profileId) {
      await saveBuyerPreferences(profileId, categoryIds);
    }

    markStepComplete("buyerPreferences");
    setCompleted(true);
    navigation.navigate("BuyerPriceRange");
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
      <Text style={styles.subtitle}>
        Select your preferred produce categories
      </Text>

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
        style={[
          styles.continueButton,
          completed && styles.continueButtonDisabled,
        ]}
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
