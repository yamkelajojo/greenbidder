import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { loginUser } from "../../services/authService";
import { validate, loginSchema } from "../../validators/schemas";
import { colors, spacing, fonts, radius } from "../../config/theme";

/**
 * Login screen — email + password form.
 * Criterion 8 — full auth flow, error handling, loading states.
 */
export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setErrors({});
    setApiError("");

    // Criterion 4 — validate input before sending
    const result = validate(loginSchema, { email, password });
    if (!result.success) {
      setErrors(result.errors);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await loginUser({ email, password });

      if (error) {
        setApiError(error.message || "Something went wrong. Please try again.");
      }
    } catch (err) {
      setApiError("Network error. Check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.logo}>GreenBidder</Text>
            <Text style={styles.subtitle}>
              Fresh produce, straight from the farm
            </Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.title}>Welcome back</Text>

            {apiError ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{apiError}</Text>
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={[styles.input, errors.email && styles.inputError]}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
              {errors.email ? (
                <Text style={styles.fieldError}>{errors.email}</Text>
              ) : null}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={[styles.input, errors.password && styles.inputError]}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor={colors.textTertiary}
                secureTextEntry
              />
              {errors.password ? (
                <Text style={styles.fieldError}>{errors.password}</Text>
              ) : null}
            </View>

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.buttonText}>Log In</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => navigation.navigate("Register")}
            >
              <Text style={styles.linkText}>
                Don't have an account?{" "}
                <Text style={styles.linkBold}>Sign up</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", padding: spacing.lg },
  header: { alignItems: "center", marginBottom: spacing.xl },
  logo: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.primary,
  },
  subtitle: {
    fontSize: fonts.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  form: { width: "100%" },
  title: {
    fontSize: fonts.h2,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  errorBanner: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorBannerText: { color: colors.danger, fontSize: fonts.caption },
  field: { marginBottom: spacing.md },
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
  inputError: { borderColor: colors.danger },
  fieldError: {
    color: colors.danger,
    fontSize: fonts.small,
    marginTop: spacing.xs,
  },
  button: {
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    justifyContent: "center",
    alignItems: "center",
    marginTop: spacing.sm,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: fonts.body, fontWeight: "600" },
  linkButton: { alignItems: "center", marginTop: spacing.lg },
  linkText: { fontSize: fonts.caption, color: colors.textSecondary },
  linkBold: { color: colors.primary, fontWeight: "600" },
});
