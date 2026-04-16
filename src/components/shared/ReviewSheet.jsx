import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { submitReview, REVIEW_TAGS } from "../../services/reviewService";
import { colors, spacing, fonts, radius } from "../../config/theme";

/**
 * ReviewSheet — structured, emotion-driven review experience.
 *
 * Designed for farmers and buyers who aren't tech-savvy.
 * Three taps to complete the core review (quality, accuracy, rebuy),
 * optional quick tags, optional text. Takes under 10 seconds.
 *
 * Psychology: emotion-based choices (emoji faces) are faster and
 * more honest than numeric scales. People think "this was great"
 * not "this was a 4.2."
 *
 * @param {Object} props
 * @param {string} props.buyerProfileId - buyer_profiles.id
 * @param {string} props.farmerProfileId - farmer_profiles.id
 * @param {string} props.farmerName - farm name for display
 * @param {string|null} props.listingId - listing this review is about
 * @param {string|null} props.listingTitle - listing title for context
 * @param {function} props.onComplete - called after successful submit
 * @param {function} props.onCancel - called when user cancels
 */
export default function ReviewSheet({
  buyerProfileId,
  farmerProfileId,
  farmerName,
  listingId = null,
  listingTitle = null,
  onComplete,
  onCancel,
}) {
  // Dimension selections
  const [quality, setQuality] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [wouldBuyAgain, setWouldBuyAgain] = useState(null);

  // Tags
  const [selectedTags, setSelectedTags] = useState([]);

  // Optional text
  const [text, setText] = useState("");

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleTag = (tagId) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId],
    );
  };

  const canSubmit = quality && accuracy && wouldBuyAgain;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    const { data, error } = await submitReview({
      buyerProfileId,
      farmerProfileId,
      listingId,
      quality,
      accuracy,
      wouldBuyAgain,
      tags: selectedTags,
      text,
    });

    setIsSubmitting(false);

    if (error) {
      if (error.message?.includes("one_review_per_buyer_farmer")) {
        Alert.alert(
          "Already Reviewed",
          "You've already left a review for this farmer.",
        );
      } else {
        Alert.alert("Error", "Could not submit review. Please try again.");
      }
      return;
    }

    onComplete?.();
  };

  // ── Dimension Option Component ──
  const DimensionOption = ({
    emoji,
    label,
    isSelected,
    onPress,
    selectedColor,
  }) => (
    <TouchableOpacity
      style={[
        styles.dimensionOption,
        isSelected && {
          backgroundColor: selectedColor,
          borderColor: selectedColor,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.dimensionEmoji}>{emoji}</Text>
      <Text
        style={[
          styles.dimensionLabel,
          isSelected && styles.dimensionLabelSelected,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Rate your experience</Text>
        <Text style={styles.headerFarm}>{farmerName}</Text>
        {listingTitle ? (
          <Text style={styles.headerListing}>{listingTitle}</Text>
        ) : null}
      </View>

      {/* ── Dimension 1: Quality ── */}
      <View style={styles.dimension}>
        <Text style={styles.dimensionTitle}>How was the produce?</Text>
        <View style={styles.dimensionRow}>
          <DimensionOption
            emoji="😕"
            label="Below expectations"
            isSelected={quality === "below"}
            onPress={() => setQuality("below")}
            selectedColor="#FEE2E2"
          />
          <DimensionOption
            emoji="😊"
            label="As expected"
            isSelected={quality === "expected"}
            onPress={() => setQuality("expected")}
            selectedColor="#FEF3C7"
          />
          <DimensionOption
            emoji="🤩"
            label="Even better!"
            isSelected={quality === "above"}
            onPress={() => setQuality("above")}
            selectedColor={colors.primaryLight}
          />
        </View>
      </View>

      {/* ── Dimension 2: Accuracy ── */}
      <View style={styles.dimension}>
        <Text style={styles.dimensionTitle}>Did it match the listing?</Text>
        <View style={styles.dimensionRow}>
          <DimensionOption
            emoji="📷 ✗"
            label="Not as shown"
            isSelected={accuracy === "no"}
            onPress={() => setAccuracy("no")}
            selectedColor="#FEE2E2"
          />
          <DimensionOption
            emoji="📷 ~"
            label="Close enough"
            isSelected={accuracy === "close"}
            onPress={() => setAccuracy("close")}
            selectedColor="#FEF3C7"
          />
          <DimensionOption
            emoji="📷 ✓"
            label="Exactly as shown"
            isSelected={accuracy === "exact"}
            onPress={() => setAccuracy("exact")}
            selectedColor={colors.primaryLight}
          />
        </View>
      </View>

      {/* ── Dimension 3: Would buy again ── */}
      <View style={styles.dimension}>
        <Text style={styles.dimensionTitle}>Would you buy again?</Text>
        <View style={styles.rebuyRow}>
          <TouchableOpacity
            style={[
              styles.rebuyOption,
              wouldBuyAgain === "no" && styles.rebuyNo,
            ]}
            onPress={() => setWouldBuyAgain("no")}
            activeOpacity={0.7}
          >
            <Text style={styles.rebuyEmoji}>👎</Text>
            <Text
              style={[
                styles.rebuyLabel,
                wouldBuyAgain === "no" && styles.rebuyLabelSelected,
              ]}
            >
              No
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.rebuyOption,
              wouldBuyAgain === "yes" && styles.rebuyYes,
            ]}
            onPress={() => setWouldBuyAgain("yes")}
            activeOpacity={0.7}
          >
            <Text style={styles.rebuyEmoji}>👍</Text>
            <Text
              style={[
                styles.rebuyLabel,
                wouldBuyAgain === "yes" && styles.rebuyLabelSelected,
              ]}
            >
              Yes
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Quick Tags ── */}
      <View style={styles.tagsSection}>
        <Text style={styles.tagsTitle}>Quick tags (optional)</Text>

        <Text style={styles.tagsSubtitle}>What went well?</Text>
        <View style={styles.tagsRow}>
          {REVIEW_TAGS.positive.map((tag) => (
            <TouchableOpacity
              key={tag.id}
              style={[
                styles.tag,
                styles.tagPositive,
                selectedTags.includes(tag.id) && styles.tagPositiveSelected,
              ]}
              onPress={() => toggleTag(tag.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.tagEmoji}>{tag.emoji}</Text>
              <Text
                style={[
                  styles.tagLabel,
                  selectedTags.includes(tag.id) &&
                    styles.tagLabelPositiveSelected,
                ]}
              >
                {tag.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.tagsSubtitle}>What could improve?</Text>
        <View style={styles.tagsRow}>
          {REVIEW_TAGS.negative.map((tag) => (
            <TouchableOpacity
              key={tag.id}
              style={[
                styles.tag,
                styles.tagNegative,
                selectedTags.includes(tag.id) && styles.tagNegativeSelected,
              ]}
              onPress={() => toggleTag(tag.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.tagEmoji}>{tag.emoji}</Text>
              <Text
                style={[
                  styles.tagLabel,
                  selectedTags.includes(tag.id) &&
                    styles.tagLabelNegativeSelected,
                ]}
              >
                {tag.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Optional Text ── */}
      <View style={styles.textSection}>
        <Text style={styles.textLabel}>Anything else? (optional)</Text>
        <TextInput
          style={styles.textInput}
          value={text}
          onChangeText={setText}
          placeholder="Share your experience..."
          placeholderTextColor={colors.textTertiary}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      {/* ── Actions ── */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.submitButton, !canSubmit && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || isSubmitting}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.submitText}>
              {canSubmit ? "Submit Review" : "Answer all 3 questions to submit"}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onCancel}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelText}>Maybe later</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl },

  // Header
  header: { marginBottom: spacing.lg },
  headerTitle: {
    fontSize: fonts.h2,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  headerFarm: {
    fontSize: fonts.body,
    color: colors.primary,
    fontWeight: "600",
    marginTop: spacing.xs,
  },
  headerListing: {
    fontSize: fonts.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Dimensions
  dimension: { marginBottom: spacing.lg },
  dimensionTitle: {
    fontSize: fonts.body,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  dimensionRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  dimensionOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  dimensionEmoji: { fontSize: 24, marginBottom: spacing.xs },
  dimensionLabel: {
    fontSize: fonts.small,
    color: colors.textSecondary,
    textAlign: "center",
    fontWeight: "500",
  },
  dimensionLabelSelected: {
    color: colors.textPrimary,
    fontWeight: "600",
  },

  // Rebuy (wider buttons for Yes/No)
  rebuyRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  rebuyOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  rebuyNo: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FCA5A5",
  },
  rebuyYes: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  rebuyEmoji: { fontSize: 24 },
  rebuyLabel: {
    fontSize: fonts.body,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  rebuyLabelSelected: {
    color: colors.textPrimary,
  },

  // Tags
  tagsSection: { marginBottom: spacing.lg },
  tagsTitle: {
    fontSize: fonts.body,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  tagsSubtitle: {
    fontSize: fonts.small,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    gap: 4,
  },
  tagPositive: {
    borderColor: colors.primaryLight,
    backgroundColor: colors.background,
  },
  tagPositiveSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  tagNegative: {
    borderColor: "#FEE2E2",
    backgroundColor: colors.background,
  },
  tagNegativeSelected: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FCA5A5",
  },
  tagEmoji: { fontSize: 14 },
  tagLabel: {
    fontSize: fonts.small,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  tagLabelPositiveSelected: {
    color: colors.primaryDark,
    fontWeight: "600",
  },
  tagLabelNegativeSelected: {
    color: colors.danger,
    fontWeight: "600",
  },

  // Text input
  textSection: { marginBottom: spacing.lg },
  textLabel: {
    fontSize: fonts.caption,
    fontWeight: "500",
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  textInput: {
    height: 80,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    fontSize: fonts.body,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },

  // Actions
  actions: { gap: spacing.sm },
  submitButton: {
    height: 52,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  submitDisabled: { opacity: 0.5 },
  submitText: {
    color: "#fff",
    fontSize: fonts.body,
    fontWeight: "600",
  },
  cancelButton: {
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelText: {
    color: colors.textTertiary,
    fontSize: fonts.caption,
  },
});
