import React from "react";
import { View, Text, Image, StyleSheet, Alert } from "react-native";
import { colors, spacing, fonts, radius } from "../../config/theme";
import { formatConfidence } from "../../utils/diseaseLogic";
import AppButton from "../shared/AppButton";

/**
 * Result card for a cabbage disease diagnosis.
 *
 * Colour-coded by severity (PRD §8.2):
 *   green  = healthy
 *   amber  = moderate disease
 *   red    = severe disease
 *   grey   = unable to diagnose / not a cabbage
 *
 * @param {Object} props
 * @param {Object} props.result - `data` from diseaseService.diagnose
 * @param {string|null} props.imageUrl - Public URL of the saved scan image
 * @param {boolean} [props.isSaving=false] - Persist to Supabase in progress
 * @param {boolean} [props.isDeleting=false] - Delete in progress
 * @param {function} [props.onRetake] - Reset to a new photo
 * @param {function} [props.onDelete] - Delete this scan (row + image)
 * @param {function} [props.onOpenAdvisory] - Reserved for future deep-links
 */
export default function DiseaseResultCard({
  result,
  imageUrl = null,
  isSaving = false,
  isDeleting = false,
  onRetake,
  onDelete,
}) {
  const isUnknown = result.severity === "unknown";
  const accent = SEVERITY_COLORS[result.severity] || colors.textSecondary;

  const title = isUnknown
    ? result.reason === "ambiguous"
      ? "Couldn't confidently diagnose this"
      : "This doesn't look like a cabbage"
    : result.diseaseLabel;

  const handleDelete = () => {
    Alert.alert(
      "Delete this scan?",
      "The photo and the diagnosis will be permanently deleted.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: onDelete },
      ]
    );
  };

  return (
    <View style={[styles.card, { borderColor: accent }]}>
      <View style={styles.header}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Text style={styles.thumbPlaceholderText}>🥬</Text>
          </View>
        )}
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: accent }]} numberOfLines={2}>
            {title}
          </Text>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: accent }]}>
              <Text style={styles.badgeText}>
                {isUnknown
                  ? "No diagnosis"
                  : result.severity.toUpperCase()}
              </Text>
            </View>
            <Text style={styles.confidence}>
              Confidence {formatConfidence(result.confidence)}
            </Text>
          </View>
          {isSaving ? (
            <Text style={styles.saveNote}>Saving to your history…</Text>
          ) : (
            <Text style={styles.saveNote}>Saved to your history</Text>
          )}
        </View>
      </View>

      <Text style={styles.advisory}>{result.advisory}</Text>

      {result.symptoms && result.symptoms !== "—" && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What to look for</Text>
          <Text style={styles.sectionBody}>{result.symptoms}</Text>
        </View>
      )}

      {result.action && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What to do</Text>
          <Text style={styles.sectionBody}>{result.action}</Text>
        </View>
      )}

      <View style={styles.actions}>
        <AppButton
          label="Retake photo"
          variant="outline"
          onPress={onRetake}
          style={styles.actionButton}
        />
        <AppButton
          label="Delete"
          variant="danger"
          isLoading={isDeleting}
          onPress={handleDelete}
          style={styles.actionButton}
        />
      </View>
    </View>
  );
}

const SEVERITY_COLORS = {
  healthy: colors.success,
  moderate: colors.warning,
  severe: colors.danger,
  unknown: colors.textSecondary,
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderWidth: 2,
    padding: spacing.md,
    marginVertical: spacing.sm,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  header: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  thumb: {
    width: 96,
    height: 96,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundTertiary,
  },
  thumbPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  thumbPlaceholderText: {
    fontSize: 36,
  },
  headerText: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    fontSize: fonts.h2,
    fontWeight: "700",
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  badge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: {
    color: "#fff",
    fontSize: fonts.small,
    fontWeight: "700",
  },
  confidence: {
    fontSize: fonts.caption,
    color: colors.textSecondary,
  },
  saveNote: {
    fontSize: fonts.small,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  advisory: {
    fontSize: fonts.body,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  section: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: fonts.small,
    fontWeight: "700",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  sectionBody: {
    fontSize: fonts.caption,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
});
