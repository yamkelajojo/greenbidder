import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCategorySelection } from "../../hooks/useCategorySelection";
import { useOnboarding } from "../../context/OnboardingContext";
import { saveBuyerPreferences } from "../../services/categoryService";
import { useAuth } from "../../hooks/useAuth";
import { colors, spacing, fonts, radius } from "../../config/theme";
import TactilePressable from "../../components/shared/TactilePressable";
import FadeSlideIn from "../../components/shared/FadeSlideIn";

export default function BuyerPreferencesScreen({ navigation }) {
  const { profileId } = useAuth();
  const { categories, selectedCategories, toggleCategory, selectionCount } =
    useCategorySelection();
  const { selectedCategories: contextCategories, setSelectedCategories, markStepComplete } =
    useOnboarding();

  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (contextCategories && contextCategories.length > 0) {
      contextCategories.forEach((catId) => toggleCategory(catId));
    }
  }, []);

  const handleContinue = async () => {
    if (selectionCount === 0 || completed) {
      if (selectionCount === 0) {
        Alert.alert("Selection Required", "Please select at least one category.");
      }
      return;
    }

    const categoryIds = Array.from(selectedCategories);
    setSelectedCategories(categoryIds);
    if (profileId) await saveBuyerPreferences(profileId, categoryIds);
    await markStepComplete("buyerPreferences");
    setCompleted(true);
    navigation.navigate("BuyerPriceRange");
  };

  const renderItem = ({ item, index }) => {
    const selected = selectedCategories.has(item.id);
    return (
      <FadeSlideIn delay={140 + index * 40} distance={8}>
        <TactilePressable
          style={[styles.categoryTile, selected && styles.selectedTile]}
          onPress={() => toggleCategory(item.id)}
          variant="card"
          haptic="selection"
        >
          <Text style={styles.icon}>{item.icon || "🌱"}</Text>
          <Text style={styles.categoryName}>{item.name}</Text>
          <Text style={styles.categoryHint}>{selected ? "Selected" : "Tap to select"}</Text>
        </TactilePressable>
      </FadeSlideIn>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <FadeSlideIn delay={80}>
        <Text style={styles.title}>What are you interested in?</Text>
      </FadeSlideIn>
      <FadeSlideIn delay={120}>
        <Text style={styles.subtitle}>Select your preferred produce categories</Text>
      </FadeSlideIn>

      <FlatList
        data={categories}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        contentContainerStyle={styles.list}
        columnWrapperStyle={styles.row}
        initialNumToRender={8}
        windowSize={6}
      />

      <TactilePressable
        style={[styles.continueButton, completed && styles.continueButtonDisabled]}
        onPress={handleContinue}
        disabled={completed}
        haptic="commit"
      >
        <Text style={styles.continueButtonText}>Continue</Text>
      </TactilePressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  title: {
    fontSize: fonts.h2,
    fontWeight: "700",
    marginTop: spacing.md,
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: fonts.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  list: { paddingBottom: spacing.md },
  row: { gap: spacing.sm },
  categoryTile: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    minHeight: 124,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedTile: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  icon: { fontSize: 30, marginBottom: spacing.xs },
  categoryName: {
    fontSize: fonts.caption,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
  },
  categoryHint: { marginTop: spacing.xs, fontSize: fonts.small, color: colors.textTertiary },
  continueButton: {
    marginBottom: spacing.lg,
    height: 52,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  continueButtonDisabled: { opacity: 0.6 },
  continueButtonText: { color: "#fff", fontSize: fonts.body, fontWeight: "700" },
});
