import React from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { colors, spacing, fonts, radius } from "../../config/theme";
import { timeAgo } from "../../utils/dateUtils";
import { formatConfidence } from "../../utils/diseaseLogic";

/**
 * One row in the scan-history list: thumbnail, label, confidence, timestamp,
 * and a delete button (PRD §8.2).
 *
 * @param {Object} props
 * @param {Object} props.item - disease_scans row (+ image_url)
 * @param {function} [props.onDelete] - Called with the row id
 * @param {boolean} [props.isDeleting=false] - Delete in progress for this row
 */
export default function ScanHistoryItem({ item, onDelete, isDeleting = false }) {
  const isHealthy = item.disease_key === "healthy";
  const isUnknown = item.disease_key === "unknown";
  const labelColor = isUnknown
    ? colors.textSecondary
    : isHealthy
      ? colors.success
      : colors.textPrimary;

  return (
    <View style={styles.row}>
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Text style={styles.thumbPlaceholderText}>🥬</Text>
        </View>
      )}

      <View style={styles.text}>
        <Text style={[styles.label, { color: labelColor }]} numberOfLines={1}>
          {item.disease_label}
        </Text>
        <Text style={styles.meta}>
          {formatConfidence(item.confidence)} · {timeAgo(item.created_at)}
        </Text>
        {isUnknown && (
          <Text style={styles.footnote}>No confident diagnosis</Text>
        )}
      </View>

      <TouchableOpacity
        style={[styles.deleteBtn, isDeleting && styles.deleteBtnBusy]}
        onPress={() => onDelete && onDelete(item.id)}
        disabled={isDeleting}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel={`Delete scan ${item.disease_label}`}
      >
        <Text style={styles.deleteIcon}>{isDeleting ? "…" : "🗑"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.backgroundTertiary,
  },
  thumbPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  thumbPlaceholderText: {
    fontSize: 20,
  },
  text: {
    flex: 1,
  },
  label: {
    fontSize: fonts.body,
    fontWeight: "600",
  },
  meta: {
    fontSize: fonts.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
  footnote: {
    fontSize: fonts.small,
    color: colors.textTertiary,
    marginTop: 2,
    fontStyle: "italic",
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: "center",
    alignItems: "center",
  },
  deleteBtnBusy: {
    opacity: 0.5,
  },
  deleteIcon: {
    fontSize: 16,
  },
});
