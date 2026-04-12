import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";
import { logoutUser } from "../../services/authService";
import { colors, spacing, fonts, radius } from "../../config/theme";

/**
 * Profile screen — shows user info and logout.
 * Criterion 8 — logout completes the auth flow demonstration.
 */
export default function ProfileScreen() {
  const { user, userRole } = useAuth();

  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          const { error } = await logoutUser();
          if (error) {
            Alert.alert("Error", "Failed to log out. Please try again.");
          }
          // useAuth listener handles redirect to LoginScreen
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Profile</Text>

        <View style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.email?.[0]?.toUpperCase() || "?"}
            </Text>
          </View>
          <Text style={styles.email}>{user?.email || "No email"}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>
              {userRole === "farmer" ? "🌱 Farmer" : "🛒 Buyer"}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundSecondary },
  container: { flex: 1, padding: spacing.lg },
  title: {
    fontSize: fonts.h1,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  avatarText: {
    fontSize: fonts.h1,
    fontWeight: "700",
    color: colors.primaryDark,
  },
  email: {
    fontSize: fonts.body,
    color: colors.textPrimary,
    fontWeight: "500",
  },
  roleBadge: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
  },
  roleText: {
    fontSize: fonts.caption,
    fontWeight: "600",
    color: colors.primaryDark,
  },
  logoutButton: {
    marginTop: spacing.xl,
    height: 48,
    borderWidth: 1.5,
    borderColor: colors.danger,
    borderRadius: radius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  logoutText: {
    color: colors.danger,
    fontSize: fonts.body,
    fontWeight: "600",
  },
});
