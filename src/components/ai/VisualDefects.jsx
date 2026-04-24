import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, fonts, radius } from "../../config/theme";

/**
 * ═══════════════════════════════════════════════════════════════════════
 *   VisualDefects — structured AI observation chips
 *
 *   The AI now returns a `visual_defects` array containing short
 *   observations (a mix of positives and negatives — 3-6 words each).
 *   We classify each into one of three tones and render as pill chips
 *   so the list scans at a glance, rather than hiding inside the
 *   growth_insight prose.
 *
 *   Tone classification is keyword-driven. It's a heuristic, not an
 *   oracle — worst case we fall back to "observation" (neutral).
 *
 *   Design: quiet hairline-bordered pills, TE-flavored micro-caps label
 *   ("OBSERVATIONS"), tonal color per item. Sits immediately below the
 *   growth_insight paragraph in the AI card, so the prose provides the
 *   narrative and the chips provide the structured data.
 * ═══════════════════════════════════════════════════════════════════════
 */

// ─── Tone classification ───
// Simple keyword bag — if we ever want to get fancy, we could ask the AI
// to return {text, tone} tuples directly. For now the list is short and
// this works well enough.
const POSITIVE_KEYWORDS = [
  "uniform",
  "excellent",
  "good",
  "fresh",
  "vibrant",
  "healthy",
  "consistent",
  "clean",
  "firm",
  "unblemished",
  "intact",
  "well",
  "nice",
  "strong",
  "great",
];
const NEGATIVE_KEYWORDS = [
  "brui",
  "dehydrat",
  "wilt",
  "rot",
  "mold",
  "damage",
  "defect",
  "spot",
  "blemish",
  "scar",
  "crack",
  "soft",
  "overripe",
  "shrivel",
  "discolor",
  "yellow",
  "pale",
  "dry",
  "dirt",
  "pest",
  "disease",
  "inconsist",
];

function toneFor(observation) {
  if (!observation || typeof observation !== "string") return "neutral";
  const s = observation.toLowerCase();
  // Negative wins if both match (err on the side of flagging issues)
  if (NEGATIVE_KEYWORDS.some((kw) => s.includes(kw))) return "negative";
  if (POSITIVE_KEYWORDS.some((kw) => s.includes(kw))) return "positive";
  return "neutral";
}

// ─── Tone palette ───
// Using colors that harmonise with the AI card's glass + score-tint system.
// Positive leans green, negative leans warm amber (never red — we're not
// alarming the user, just informing), neutral is a muted warm gray.
const TONE_PALETTE = {
  positive: {
    bg: "rgba(99, 153, 34, 0.09)",
    border: "rgba(99, 153, 34, 0.28)",
    text: "rgb(72, 112, 24)",
    dot: "rgb(99, 153, 34)",
  },
  negative: {
    bg: "rgba(212, 130, 42, 0.09)",
    border: "rgba(212, 130, 42, 0.30)",
    text: "rgb(140, 82, 16)",
    dot: "rgb(212, 130, 42)",
  },
  neutral: {
    bg: "rgba(120, 110, 100, 0.07)",
    border: "rgba(120, 110, 100, 0.22)",
    text: "rgb(90, 82, 74)",
    dot: "rgb(140, 130, 118)",
  },
};

export default function VisualDefects({ items }) {
  const cleaned = useMemo(() => {
    if (!Array.isArray(items)) return [];
    return items
      .filter((s) => typeof s === "string" && s.trim().length > 0)
      .map((s) => ({ text: s.trim(), tone: toneFor(s) }));
  }, [items]);

  if (cleaned.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>OBSERVATIONS</Text>

      <View style={styles.chipsRow}>
        {cleaned.map((item, idx) => {
          const palette = TONE_PALETTE[item.tone];
          return (
            <View
              key={`${idx}-${item.text}`}
              style={[
                styles.chip,
                { backgroundColor: palette.bg, borderColor: palette.border },
              ]}
            >
              <View
                style={[styles.dot, { backgroundColor: palette.dot }]}
              />
              <Text style={[styles.chipText, { color: palette.text }]}>
                {item.text}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textSecondary,
    letterSpacing: 1.2,
    marginBottom: spacing.xs,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    // Use negative right margin on each chip instead of gap, for RN compat
    // with older versions — we explicitly set marginRight/marginBottom below.
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: 6,
    marginBottom: 6,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginRight: 6,
  },
  chipText: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.15,
  },
});
