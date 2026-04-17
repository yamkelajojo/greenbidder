import React from "react";
import { View, StyleSheet } from "react-native";
import { colors, spacing } from "../../config/theme";

/**
 * ═══════════════════════════════════════════════════════════════════════
 *   Hairline — The Swiss Detail
 *
 *   Most apps use 1px dividers. They read as "boundaries" — harsh, dividing.
 *   A hairline (0.5px on retina) reads as "organisation" — subtle, rhythmic.
 *
 *   StyleSheet.hairlineWidth resolves to:
 *     iOS retina  → 0.5
 *     Android     → 1 (unavoidable — pixel density limitation)
 *     iOS non-retina → 1
 *
 *   Use it for:
 *   ─ Separating list rows
 *   ─ Dividing sections within a card
 *   ─ Under sticky headers
 *   ─ Above/below important actions
 *
 *   Avoid it for:
 *   ─ Decorative division (use spacing instead)
 *   ─ Around cards (Surface already has hairline border built in)
 *
 *   Props:
 *     inset  — left/right inset in px (default 0, full width)
 *     color  — override default (rarely needed)
 *     vertical — renders as vertical line instead of horizontal
 * ═══════════════════════════════════════════════════════════════════════
 */

export default function Hairline({
  inset = 0,
  color = colors.borderLight,
  vertical = false,
  style,
}) {
  if (vertical) {
    return (
      <View
        style={[
          {
            width: StyleSheet.hairlineWidth,
            backgroundColor: color,
            marginVertical: inset,
          },
          style,
        ]}
      />
    );
  }

  return (
    <View
      style={[
        {
          height: StyleSheet.hairlineWidth,
          backgroundColor: color,
          marginHorizontal: inset,
        },
        style,
      ]}
    />
  );
}
