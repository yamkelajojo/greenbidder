import React from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from "react-native";
import { colors, spacing, fonts, radius } from "../../config/theme";
import { timeAgo } from "../../utils/dateUtils";
import { formatConfidence } from "../../utils/diseaseLogic";
import { useFadeIn } from "../../utils/animations";

/** Map disease key -> severity bucket. Same mapping as advisories.json
 *  but we duplicate it here to avoid importing the whole JSON in a
 *  list-item render path. */
const SEVERITY_MAP = {
  healthy: "healthy",
  alternaria_leaf_spot: "moderate",
  bacterial_leaf_spot: "moderate",
  downy_mildew: "moderate",
  grey_mould: "moderate",
  ringspot: "moderate",
  black_rot: "severe",
  clubroot: "severe",
};

const SEVERITY_COLORS = {
  healthy: colors.success,
  moderate: colors.warning,
  severe: colors.danger,
  unknown: colors.textSecondary,
};

function guessSeverity(key) {
  return SEVERITY_MAP[key] || (key === "unknown" ? "unknown" : "moderate");
}

/**
 * One row in the scan-history list: thumbnail, label, confidence, timestamp,
 * and a delete button (PRD §8.2).
 *
 * Animates in on mount with a subtle fade+slide for a smoother list feel
 * (consistent with DiseaseScanScreen and DiseaseResultCard).
 *
 * @param {Object} props
 * @param {Object} props.item - disease_scans row (+ image_url)
 * @param {number} [props.index=0] - List index for stagger timing
 * @param {function} [props.onDelete] - Called with the row id
 * @param {boolean} [props.isDeleting=false] - Delete in progress for this row
 * @param {function} [props.onPress] - Optional tap handler (view detail)
 */
export default function ScanHistoryItem({
  item,
  index = 0,
  onDelete,
  isDeleting = false,
  onPress,
}) {
  const isUnknown = item.disease_key === "unknown" || item.is_cabbage === false;
  const labelColor = isUnknown
    ? SEVERITY_COLORS.unknown
    : SEVERITY_COLORS[guessSeverity(item.disease_key)] || colors.textPrimary;

  // List-row entrance — quick fade with slight upward drift, delayed by
  // position so newly added/loaded rows feel like they glide in.
  const entrance = useFadeIn({
    duration: 250,
    translateY: 8,
    delay: Math.min(index * 40, 200),
  });

  const content = (
    <Animated.View
      style={[
        styles.row,
        {
          opacity: entrance.opacity,
          transform: [{ translateY: entrance.translateY }],
        },
      ]}
    >
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={styles.thumb} resizeMode="cover" />
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
        activeOpacity={0.8}
        accessibilityLabel={`Delete scan ${item.disease_label}`}
      >
        <Text style={styles.deleteIcon}>{isDeleting ? "…" : "🗑"}</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => onPress(item)}
        disabled={isDeleting}
        style={styles.rowWrapper}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  rowWrapper: {
    // Touchable wrapper for press feedback on the whole row.
  },
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
