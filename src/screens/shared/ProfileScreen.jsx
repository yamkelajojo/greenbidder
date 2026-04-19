import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";
import { logoutUser } from "../../services/authService";
import { colors, spacing, fonts, radius } from "../../config/theme";
import AIBadge from "../../components/ai/AIBadge";

/**
 * Profile screen — shows user info and logout.
 *
 * TEMPORARY: includes an "AI Badge Lab" section at the bottom for
 * testing the new AIBadge component while the modal system is being
 * built. Remove once Stage 4 integration is complete.
 */
export default function ProfileScreen() {
  const { user, userRole } = useAuth();
  const [lastTap, setLastTap] = useState(null);
  const [remountKey, setRemountKey] = useState(0);

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
        },
      },
    ]);
  };

  const handleBadgePress = (rect, score) => {
    setLastTap({
      score,
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      w: Math.round(rect.width),
      h: Math.round(rect.height),
    });
  };

  // Sample scores across the full gradient so we can see the color math
  const sampleScores = [3.2, 5.4, 6.5, 7.2, 7.8, 8.1, 8.5, 8.9, 9.4, 9.8];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
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

        {/* ─── TEMPORARY: AI BADGE LAB ─────────────────────── */}
        <View style={styles.lab}>
          <Text style={styles.labTitle}>AI Badge Lab</Text>
          <Text style={styles.labSubtitle}>
            Testing the new AI condition badge. Each score gets its own color.
            Tap any badge to verify the measure-in-window capture.
          </Text>

          <Text style={styles.labSection}>Full gradient range</Text>
          <View key={`row-${remountKey}`} style={styles.badgeRow}>
            {sampleScores.map((s) => (
              <AIBadge
                key={`${s}-${remountKey}`}
                score={s}
                onPress={handleBadgePress}
                style={styles.badgeSpacing}
              />
            ))}
          </View>

          <Text style={styles.labSection}>Compact variant</Text>
          <View key={`row-compact-${remountKey}`} style={styles.badgeRow}>
            {sampleScores.map((s) => (
              <AIBadge
                key={`c-${s}-${remountKey}`}
                score={s}
                compact
                onPress={handleBadgePress}
                style={styles.badgeSpacing}
              />
            ))}
          </View>

          <TouchableOpacity
            style={styles.replayButton}
            onPress={() => setRemountKey((k) => k + 1)}
            activeOpacity={0.8}
          >
            <Text style={styles.replayText}>Replay breath animation</Text>
          </TouchableOpacity>

          {lastTap ? (
            <View style={styles.tapInfo}>
              <Text style={styles.tapInfoLabel}>Last tap captured:</Text>
              <Text style={styles.tapInfoText}>
                score {lastTap.score.toFixed(1)} · x={lastTap.x} y={lastTap.y} ·{" "}
                {lastTap.w}×{lastTap.h}
              </Text>
            </View>
          ) : (
            <Text style={styles.tapHint}>Tap a badge above to test →</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundSecondary },
  container: { padding: spacing.lg, paddingBottom: spacing.xxl },
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

  // AI Badge Lab (temp)
  lab: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  labTitle: {
    fontSize: fonts.h3,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  labSubtitle: {
    fontSize: fonts.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  labSection: {
    fontSize: fonts.small,
    color: colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  badgeSpacing: {
    marginRight: 0,
  },
  replayButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.backgroundTertiary,
    borderRadius: radius.md,
    alignSelf: "flex-start",
  },
  replayText: {
    fontSize: fonts.small,
    fontWeight: "500",
    color: colors.textPrimary,
  },
  tapInfo: {
    marginTop: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radius.sm,
  },
  tapInfoLabel: {
    fontSize: fonts.small,
    color: colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  tapInfoText: {
    fontSize: fonts.small,
    fontFamily: "monospace",
    color: colors.textPrimary,
  },
  tapHint: {
    marginTop: spacing.md,
    fontSize: fonts.small,
    color: colors.textTertiary,
    fontStyle: "italic",
  },
});
