import React from "react";
import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radius, shadows } from "../../config/theme";

/**
 * ═══════════════════════════════════════════════════════════════════════
 *   Surface — The Primitive That Everything Sits On
 *
 *   Every card, panel, sheet, and bounded container in the UI is a
 *   Surface. It gives us three things consistently:
 *
 *   1. Background  — paper white, with optional subtle gradient
 *   2. Hairline    — 0.5px border that hints at depth without dividing
 *   3. Elevation   — spring-sensitive shadow at the right level
 *
 *   Swiss + Apple principle: surfaces feel *made*. They have edges, they
 *   cast a subtle shadow, they sit in space. They aren't painted-on.
 *
 *   Elevation levels:
 *     flat     → no shadow (nested surfaces, chips)
 *     resting  → barely there (list rows)
 *     raised   → default cards (the 90% case)
 *     floating → interactive elements at rest
 *     overlay  → sheets, modals
 *     hero     → dramatic key moments
 *
 *   Usage:
 *     <Surface elevation="raised" padding="md">
 *       <Text>Card content</Text>
 *     </Surface>
 *
 *   With gradient background (premium moments only):
 *     <Surface gradient={gradients.ai} elevation="floating">...</Surface>
 * ═══════════════════════════════════════════════════════════════════════
 */

export default function Surface({
  children,
  elevation = "raised",
  gradient = null,
  radius: borderRadius = radius.lg,
  hairline = true,
  style,
  contentStyle,
  ...rest
}) {
  const shadowStyle = elevation === "flat" ? null : shadows[elevation];

  const containerStyle = [
    styles.base,
    { borderRadius },
    hairline && styles.hairline,
    shadowStyle,
    style,
  ];

  // With gradient background
  if (gradient) {
    return (
      <View style={containerStyle} {...rest}>
        <LinearGradient
          colors={gradient}
          style={[StyleSheet.absoluteFill, { borderRadius }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={[styles.content, contentStyle]}>{children}</View>
      </View>
    );
  }

  // Solid background (most common)
  return (
    <View style={containerStyle} {...rest}>
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface,
    overflow: "hidden", // clip children to rounded corners
  },
  hairline: {
    // 0.5px border — the Swiss detail. Hints at an edge without drawing one.
    // StyleSheet.hairlineWidth is 0.5 on iOS, 1 on Android retina.
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
  },
  content: {
    // relative positioning so absolutely-positioned gradient sits behind
    position: "relative",
    zIndex: 1,
  },
});
