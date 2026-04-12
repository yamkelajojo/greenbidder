import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { colors, spacing, fonts, radius } from "../../config/theme";

/**
 * Reusable button component with variant support.
 * Criterion 1 — Shared component with props for customisation.
 *
 * @param {Object} props
 * @param {string} props.label - Button text
 * @param {function} props.onPress - Press handler
 * @param {"primary"|"outline"|"danger"} [props.variant="primary"] - Visual style
 * @param {boolean} [props.isLoading=false] - Shows spinner when true
 * @param {boolean} [props.disabled=false] - Disables the button
 * @param {Object} [props.style] - Additional style overrides
 */
export default function AppButton({
  label,
  onPress,
  variant = "primary",
  isLoading = false,
  disabled = false,
  style,
}) {
  const buttonStyles = [
    styles.base,
    styles[variant],
    (disabled || isLoading) && styles.disabled,
    style,
  ];

  const textStyles = [styles.text, styles[`${variant}Text`]];

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={onPress}
      disabled={disabled || isLoading}
      activeOpacity={0.8}
    >
      {isLoading ? (
        <ActivityIndicator
          color={variant === "primary" ? "#fff" : colors.primary}
          size="small"
        />
      ) : (
        <Text style={textStyles}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 48,
    borderRadius: radius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  primary: {
    backgroundColor: colors.primary,
  },
  primaryText: {
    color: "#fff",
    fontSize: fonts.body,
    fontWeight: "600",
  },
  outline: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: "transparent",
  },
  outlineText: {
    color: colors.primary,
    fontSize: fonts.body,
    fontWeight: "600",
  },
  danger: {
    borderWidth: 1.5,
    borderColor: colors.danger,
    backgroundColor: "transparent",
  },
  dangerText: {
    color: colors.danger,
    fontSize: fonts.body,
    fontWeight: "600",
  },
  text: {
    fontSize: fonts.body,
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.6,
  },
});
