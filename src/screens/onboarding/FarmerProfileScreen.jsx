import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../config/supabase";
import { useOnboarding } from "../../context/OnboardingContext";
import { useAuth } from "../../hooks/useAuth";

export default function FarmerProfileScreen({ navigation }) {
  const { farmProfile, setFarmProfile, markStepComplete } = useOnboarding();
  const { appUserId, profileId } = useAuth();

  const [farmName, setFarmName] = useState(farmProfile?.farmName || "");
  const [bio, setBio] = useState(farmProfile?.bio || "");
  const [phone, setPhone] = useState(farmProfile?.phone || "");
  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = async () => {
    if (!farmName.trim() || farmName.trim().length < 2) {
      Alert.alert(
        "Required",
        "Please enter your farm name (at least 2 characters).",
      );
      return;
    }

    setIsLoading(true);

    try {
      const updates = {
        farm_name: farmName.trim(),
        bio: bio.trim(),
        phone: phone.trim(),
      };

      // Save to Supabase
      const { error } = await supabase
        .from("farmer_profiles")
        .update(updates)
        .eq("id", profileId);

      if (error) throw error;

      // Update context
      setFarmProfile({
        farmName: farmName.trim(),
        bio: bio.trim(),
        phone: phone.trim(),
        specializations: farmProfile?.specializations || [],
      });

      markStepComplete("farmProfile");
      navigation.navigate("FarmerCategories");
    } catch (error) {
      console.error("Failed to save farm profile:", error);
      Alert.alert("Error", "Failed to save profile. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Tell us about your farm</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Farm Name *</Text>
          <TextInput
            style={styles.input}
            value={farmName}
            onChangeText={setFarmName}
            placeholder="e.g. Green Valley Farm"
            placeholderTextColor="#999"
            maxLength={100}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Bio (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={bio}
            onChangeText={setBio}
            placeholder="Tell buyers about your farm..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            maxLength={500}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Phone (optional)</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+1 234 567 8900"
            placeholderTextColor="#999"
            keyboardType="phone-pad"
          />
        </View>
      </ScrollView>

      <TouchableOpacity
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={handleContinue}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>
          {isLoading ? "Saving..." : "Continue"}
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
  content: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 24,
    color: "#333",
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    color: "#333",
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#DDD",
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  button: {
    backgroundColor: "#4CAF50",
    padding: 16,
    alignItems: "center",
    margin: 16,
    borderRadius: 8,
  },
  buttonDisabled: {
    backgroundColor: "#CCCCCC",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
});
