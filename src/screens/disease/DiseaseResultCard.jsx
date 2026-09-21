import React, { useEffect, useRef } from "react";
import { View, Text, Image, StyleSheet, Alert, Animated } from "react-native";
import { colors, spacing, fonts, radius } from "../../config/theme";
import { formatConfidence } from "../../utils/diseaseLogic";
import AppButton from "../shared/AppButton";
import { useFadeIn, useProgress, DURATIONS } from "../../utils/animations";

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
 * @param {string|null} [props.saveError=null] - Save-failure message
 * @param {boolean} [props.isDeleting=false] - Delete in progress
 * @param {function} [props.onRetake] - Reset to a new photo
 * @param {function} [props.onReanalyze] - Re-run analysis on the same photo
 * @param {function} [props.onDelete] - Delete this scan (row + image)
 */
export default function DiseaseResultCard({
  result,
  imageUrl = null,
  isSaving = false,
  saveError = null,
  saved = false, // new: explicitly tells us whether this result is persisted
  isDeleting = false,
  isReanalyzing = false,
  onRetake,
  onReanalyze,
  onDelete,
}) {
  const isUnknown = result.severity === "unknown";
  const accent = SEVERITY_COLORS[result.severity] || colors.textSecondary;

  // Entrance animation for the card body.
  const entrance = useFadeIn({
    duration: DURATIONS.normal,
    translateY: 16,
    delay: 80,
  });

  // Animate the winner's confidence bar (and alternates) with a width tween
  // so they grow from 0 -> confidence% instead of appearing fully drawn.
  const winnerProgress = useProgress(result.confidence || 0, {
    duration: DURATIONS.slow,
    delay: 250,
  });

  const isAmbiguous = isUnknown && result.reason === "ambiguous";
  const isNotCabbage =
    isUnknown && (result.reason === "high_entropy" || result.reason === "low_confidence");

  const title = isAmbiguous
    ? "Couldn't confidently diagnose this"
    : isNotCabbage
      ? "This doesn't look like a clear cabbage leaf"
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

  const inferenceMs = typeof result.ms === "number" ? result.ms : null;
  const topPredictions = Array.isArray(result.topPredictions)
    ? result.topPredictions
    : [];
  // Don't show alternates for healthy (they'll be low-probability noise) or
  // for unknown results (we already tell the user to retake).
  const showAlternates =
    !isUnknown && result.diseaseKey !== "healthy" && topPredictions.length > 1;

  return (
    <Animated.View
      style={[
        styles.card,
        { borderColor: accent },
        {
          opacity: entrance.opacity,
          transform: [{ translateY: entrance.translateY }],
        },
      ]}
    >
      <View style={styles.header}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.thumb} resizeMode="cover" />
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
            {!isUnknown && (
              <Text style={styles.confidence}>
                {formatConfidence(result.confidence)}
              </Text>
            )}
          </View>
          {/* Winner confidence bar (animated width) — gives instant visual
              feedback on how certain the model was. */}
          {!isUnknown && (
            <View style={styles.confidenceBarTrack}>
              <Animated.View
                style={[
                  styles.confidenceBarFill,
                  {
                    backgroundColor: accent,
                    width: winnerProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0%", "100%"],
                    }),
                  },
                ]}
              />
            </View>
          )}
          {isSaving ? (
            <Text style={styles.saveNote}>Saving to your history…</Text>
          ) : saveError ? (
            <Text style={[styles.saveNote, styles.saveErrorNote]}>
              ⚠ Not saved: {saveError}
            </Text>
          ) : saved ? (
            <Text style={styles.saveNote}>✓ Saved to your history</Text>
          ) : (
            <Text style={[styles.saveNote, styles.saveNoteMuted]}>
              Not saved to history
            </Text>
          )}
        </View>
      </View>

      {isUnknown && result.reasonDetail ? (
        <View style={[styles.hintBox, { backgroundColor: accent + "15" }]}>
          <Text style={[styles.hintText, { color: accent }]}>
            💡 {result.reasonDetail}
          </Text>
        </View>
      ) : null}

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

      {showAlternates && (
        <AlternatesList
          predictions={topPredictions.slice(1)}
          winnerConfidence={result.confidence}
        />
      )}

      {inferenceMs !== null && (
        <Text style={styles.timingNote}>
          On-device inference took {inferenceMs} ms · Private, no data sent
        </Text>
      )}

      <View style={styles.actions}>
        <AppButton
          label={isUnknown ? "Try another photo" : "Retake photo"}
          variant="outline"
          onPress={onRetake}
          disabled={isReanalyzing || isDeleting}
          style={styles.actionButton}
        />
        {onReanalyze && !isUnknown && (
          <AppButton
            label="Re-analyze"
            variant="outline"
            isLoading={isReanalyzing}
            onPress={onReanalyze}
            disabled={isDeleting}
            style={styles.actionButton}
          />
        )}
        <AppButton
          label="Delete"
          variant="danger"
          isLoading={isDeleting}
          onPress={handleDelete}
          disabled={isReanalyzing}
          style={styles.actionButton}
        />
      </View>
    </Animated.View>
  );
}

/**
 * Alternates list — each bar animates its width from 0 -> target % after
 * a small staggered delay, so they don't all pop in at once.
 */
function AlternatesList({ predictions, winnerConfidence }) {
  // Create one animated progress value per alternate. Using useRef ensures
  // the values persist across re-renders; we reallocate if the number of
  // alternates changes (which can happen across re-analyze if the winner
  // changes and exposes a different number of runners-up).
  const barsRef = useRef(null);
  const count = predictions.length;
  if (!barsRef.current || barsRef.current.length !== count) {
    barsRef.current = Array.from({ length: count }, () => new Animated.Value(0));
  }
  useEffect(() => {
    const bars = barsRef.current;
    // Reset all bars before animating so re-analyzes replay the fill.
    bars.forEach((b) => b.setValue(0));
    Animated.stagger(
      80,
      bars.map((b, i) =>
        Animated.timing(b, {
          toValue: predictions[i].confidence,
          duration: DURATIONS.slow,
          delay: 250 + i * 80,
          useNativeDriver: false,
        })
      )
    ).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winnerConfidence, count]);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Other possibilities</Text>
      {predictions.map((p, i) => {
        const norm = Math.min(1, p.confidence / Math.max(winnerConfidence, 0.01));
        const bar = barsRef.current[i];
        if (!bar) return null; // defensive
        return (
          <View key={p.key} style={styles.alternateRow}>
            <Animated.View
              style={[
                styles.alternateBar,
                {
                  width: bar.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0%", `${Math.min(100, norm * 100)}%`],
                  }),
                  backgroundColor:
                    SEVERITY_COLORS[p.severity] || colors.textTertiary,
                },
              ]}
            />
            <Text style={styles.alternateLabel}>
              {p.label} — {formatConfidence(p.confidence)}
            </Text>
          </View>
        );
      })}
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
    fontWeight: "600",
  },
  confidenceBarTrack: {
    marginTop: spacing.xs,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.backgroundTertiary,
    overflow: "hidden",
  },
  confidenceBarFill: {
    height: 4,
    borderRadius: 2,
  },
  saveNote: {
    fontSize: fonts.small,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  saveErrorNote: {
    color: colors.danger,
  },
  saveNoteMuted: {
    color: colors.textTertiary,
    fontStyle: "italic",
  },
  hintBox: {
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  hintText: {
    fontSize: fonts.caption,
    fontWeight: "600",
  },
  advisory: {
    fontSize: fonts.body,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    lineHeight: 22,
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
    marginBottom: spacing.xs,
  },
  sectionBody: {
    fontSize: fonts.caption,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  alternateRow: {
    marginVertical: 3,
  },
  alternateBar: {
    height: 6,
    borderRadius: 3,
    opacity: 0.5,
    marginBottom: 2,
  },
  alternateLabel: {
    fontSize: fonts.small,
    color: colors.textSecondary,
  },
  timingNote: {
    fontSize: fonts.small,
    color: colors.textTertiary,
    fontStyle: "italic",
    textAlign: "center",
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionButton: {
    flex: 1,
    minWidth: "45%",
  },
});
