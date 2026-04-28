// src/screens/onboarding/FarmerPricingGuide.jsx
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function FarmerPricingGuide({ navigation }) {
  const handleUnderstand = () => {
    // Mark as complete and navigate to main app
    navigation.navigate("MainTabs");
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>AI Quality Assessment Guide</Text>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What This Means</Text>
          <Text style={styles.text}>
            AI quality card values are estimates based on visible produce quality. 
            These are not guarantees but helpful indicators for pricing decisions.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How to Use This</Text>
          <Text style={styles.text}>
            Use these estimates as a reference when pricing your harvest. Consider 
            market conditions, demand, and your own quality assessment alongside 
            these AI suggestions.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Important Notes</Text>
          <Text style={styles.text}>
            - AI works best with clear, well-lit photos
            {"\n"}- Limited sample sizes may affect accuracy
            {"\n"}- Always verify with your own judgment
            {"\n"}- Language is practical and non-judgmental
          </Text>
        </View>

        <TouchableOpacity style={styles.understandButton} onPress={handleUnderstand} activeOpacity={0.8}>
          <Text style={styles.understandButtonText}>I Understand</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 24,
    textAlign: "center",
    color: "#333",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#333",
  },
  text: {
    fontSize: 14,
    color: "#555",
    lineHeight: 20,
  },
  understandButton: {
    backgroundColor: "#4CAF50",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 24,
    marginBottom: 32,
  },
  understandButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
});