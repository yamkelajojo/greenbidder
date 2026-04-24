import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { MapPin } from "lucide-react-native";
import { colors, spacing, fonts, radius } from "../../config/theme";

/**
 * ═══════════════════════════════════════════════════════════════════════
 *   LocationChip — etched nameplate style
 *
 *   A quiet, confident marker for where the listing is from. Inspired by
 *   the engraved TE-style nameplates (the "TP-7" / "teenage engineering"
 *   treatment on Teenage Engineering hardware): hairline-bordered,
 *   slightly recessed into the surface, small-caps letter-spaced type.
 *
 *   Three states:
 *     - default: shows the location name
 *     - with distance: shows "{location} · {distance}km" (monospaced km)
 *     - fallback: shows "Location unavailable" in a muted tone
 *
 *   This is a first-class piece of context, not decoration — it surfaces
 *   WHERE the produce is from at a glance AND makes the AI's regional
 *   analysis feel honest (the AI uses the same location as input).
 *
 *   Sizing: 'sm' for inline use in headers, 'md' for standalone.
 * ═══════════════════════════════════════════════════════════════════════
 */

const SIZING = {
  sm: {
    paddingX: 8,
    paddingY: 3,
    fontSize: 10.5,
    iconSize: 11,
    gap: 5,
    letterSpacing: 0.5,
  },
  md: {
    paddingX: 10,
    paddingY: 5,
    fontSize: 11.5,
    iconSize: 13,
    gap: 6,
    letterSpacing: 0.6,
  },
};

/**
 * Formats a location for display — strips the country suffix if obvious
 * and handles over-long strings gracefully.
 * @param {string} raw
 * @returns {string}
 */
function formatLocation(raw) {
  if (!raw || typeof raw !== "string") return "Location unavailable";

  // Reject raw lat/lng strings — these get displayed as a coordinate label
  if (/^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(raw.trim())) {
    return "Coordinates set";
  }

  // Strip ", South Africa" trailing if present — it's implied in-context
  let cleaned = raw.replace(/,\s*South Africa$/i, "").trim();

  // Cap length — prevent broken layouts on extreme strings
  if (cleaned.length > 32) cleaned = cleaned.slice(0, 30) + "…";

  return cleaned;
}

export default function LocationChip({
  location,
  distanceKm = null,
  size = "sm",
  style,
}) {
  const sizing = SIZING[size] || SIZING.sm;

  const hasLocation = location && typeof location === "string";
  const displayLocation = formatLocation(location);
  const isFallback = !hasLocation || displayLocation === "Location unavailable";

  return (
    <View
      style={[
        styles.chip,
        {
          paddingHorizontal: sizing.paddingX,
          paddingVertical: sizing.paddingY,
        },
        isFallback && styles.chipFallback,
        style,
      ]}
    >
      <MapPin
        size={sizing.iconSize}
        color={isFallback ? colors.textTertiary : colors.textSecondary}
        strokeWidth={2}
      />
      <Text
        style={[
          styles.text,
          {
            fontSize: sizing.fontSize,
            letterSpacing: sizing.letterSpacing,
            marginLeft: sizing.gap,
          },
          isFallback && styles.textFallback,
        ]}
        numberOfLines={1}
      >
        {displayLocation.toUpperCase()}
      </Text>

      {distanceKm != null && !isFallback ? (
        <>
          <View style={[styles.separator, { marginHorizontal: sizing.gap }]} />
          <Text
            style={[
              styles.distance,
              {
                fontSize: sizing.fontSize,
                letterSpacing: sizing.letterSpacing,
              },
            ]}
          >
            {distanceKm < 10 ? distanceKm.toFixed(1) : Math.round(distanceKm)}
            <Text style={styles.distanceUnit}> KM</Text>
          </Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    // Etched look: very subtle off-white bg against the page white,
    // hairline border in a desaturated tone. Radius just shy of full
    // pill — keeps a hint of rectangular industrial feel, not bubblegum.
    backgroundColor: "rgba(250, 248, 245, 0.9)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(120, 110, 100, 0.28)",
    borderRadius: radius.full,
  },
  chipFallback: {
    backgroundColor: "transparent",
    borderColor: "rgba(120, 110, 100, 0.18)",
  },
  text: {
    color: colors.textSecondary,
    fontWeight: "600",
    // TE-inspired small-caps feel via uppercase + letter-spacing
  },
  textFallback: {
    color: colors.textTertiary,
    fontWeight: "500",
  },
  separator: {
    width: 1,
    height: 9,
    backgroundColor: "rgba(120, 110, 100, 0.32)",
  },
  distance: {
    color: colors.textPrimary,
    fontWeight: "700",
    // tabular-nums gives monospaced digits without a custom font — the
    // precision signal we want from TE's digital-readout aesthetic
    fontVariant: ["tabular-nums"],
  },
  distanceUnit: {
    fontWeight: "500",
    color: colors.textSecondary,
  },
});
