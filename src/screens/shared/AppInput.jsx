import React from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { colors, spacing, fonts, radius } from "../../config/theme";

/**
 * Reusable text input with label and error display.
 * Criterion 1 — Shared component with props for customisation.
 *
 * @param {Object} props
 * @param {string} props.label - Field label
 * @param {string} props.value - Current value
 * @param {function} props.onChangeText - Change handler
 * @param {string} [props.placeholder] - Placeholder text
 * @param {string} [props.error] - Error message to display
 * @param {boolean} [props.secureTextEntry=false] - Password mode
 * @param {string} [props.keyboardType="default"] - Keyboard type
 * @param {boolean} [props.multiline=false] - Multiline mode
 * @param {Object} [props.style] - Additional style overrides
 */
export default function AppInput({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  secureTextEntry = false,
  keyboardType = "default",
  multiline = false,
  autoCapitalize = "sentences",
  style,
}) {
  return (
    <View style={[styles.container, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        style={[
          styles.input,
          multiline && styles.multiline,
          error && styles.inputError,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        multiline={multiline}
        autoCapitalize={autoCapitalize}
        textAlignVertical={multiline ? "top" : "center"}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: {
    fontSize: fonts.caption,
    fontWeight: "500",
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: fonts.body,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  multiline: {
    height: 80,
    paddingTop: spacing.sm,
  },
  inputError: {
    borderColor: colors.danger,
  },
  error: {
    color: colors.danger,
    fontSize: fonts.small,
    marginTop: spacing.xs,
  },
});
