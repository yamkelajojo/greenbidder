import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from "react-native";
import Animated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { loginUser } from "../../services/authService";
import { validate, loginSchema } from "../../validators/schemas";
import { colors, spacing, fonts, radius } from "../../config/theme";
import TactilePressable from "../../components/shared/TactilePressable";
import FadeSlideIn from "../../components/shared/FadeSlideIn";
import AnimatedLogo from "../../components/shared/AnimatedLogo";
import {
  AnimatedErrorText,
  AnimatedErrorBanner,
  useErrorShake,
} from "../../components/shared/AnimatedError";

/**
 * Login screen — email + password form.
 *
 * Stage 1a polish:
 *   • Logo: letter-spacing collapse + fade + scale entrance
 *   • Staggered FadeSlideIn for each form element
 *   • Field errors slide in from above + offending input shakes
 *   • API error banner springs down from above the form
 *   • Haptic on submit (commit) only; silent on everything else
 */
export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [emailShakeStyle, shakeEmail] = useErrorShake();
  const [passwordShakeStyle, shakePassword] = useErrorShake();

  const handleLogin = async () => {
    setErrors({});
    setApiError("");

    const result = validate(loginSchema, { email, password });
    if (!result.success) {
      setErrors(result.errors);
      if (result.errors.email) shakeEmail();
      if (result.errors.password) shakePassword();
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await loginUser({ email, password });
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
          {/* Logo — letters collapse into place */}
          <View style={styles.header}>
            <AnimatedLogo text="GreenBidder" style={styles.logo} />
            {/* Subtitle fades up after logo settles */}
            <FadeSlideIn delay={380} distance={6}>
              <Text style={styles.subtitle}>
                Fresh produce, straight from the farm
              </Text>
            </FadeSlideIn>
          </View>

          <View style={styles.form}>
            <FadeSlideIn delay={480}>
              <Text style={styles.title}>Welcome back</Text>
            </FadeSlideIn>

            <AnimatedErrorBanner message={apiError} />

            <FadeSlideIn delay={540}>
              <Animated.View style={[styles.field, emailShakeStyle]}>
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
                <AnimatedErrorText error={errors.email} />
              </Animated.View>
            </FadeSlideIn>

            <FadeSlideIn delay={600}>
              <Animated.View style={[styles.field, passwordShakeStyle]}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={[styles.input, errors.password && styles.inputError]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.textTertiary}
                  secureTextEntry
                />
                <AnimatedErrorText error={errors.password} />
              </Animated.View>
            </FadeSlideIn>

            <FadeSlideIn delay={680}>
              <TactilePressable
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={isLoading}
                haptic="commit"
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.buttonText}>Log In</Text>
                )}
              </TactilePressable>
            </FadeSlideIn>

            <FadeSlideIn delay={760}>
              <TactilePressable
                style={styles.linkButton}
                variant="compact"
                onPress={() => navigation.navigate("Register")}
              >
                <Text style={styles.linkText}>
                  Don't have an account?{" "}
                  <Text style={styles.linkBold}>Sign up</Text>
                </Text>
              </TactilePressable>
            </FadeSlideIn>

            <FadeSlideIn delay={790}>
              <View style={styles.socialContainer}>
                <Text style={styles.socialLabel}>Or continue with</Text>
                <View style={styles.socialButtons}>
                  <TactilePressable
                    style={styles.socialButton}
                    disabled={true} // Placeholder
                    onPress={() => {}}
                  >
                    <Image
                      source={require("../../../assets/google.png")}
                      style={styles.socialIcon}
                    />
                    <Text style={styles.socialButtonText}>
                      Google (Coming Soon)
                    </Text>
                  </TactilePressable>
                  <TactilePressable
                    style={styles.socialButton}
                    disabled={true} // Placeholder
                    onPress={() => {}}
                  >
                    <Image
                      source={require("../../../assets/apple.png")}
                      style={styles.socialIcon}
                    />
                    <Text style={styles.socialButtonText}>
                      Apple (Coming Soon)
                    </Text>
                  </TactilePressable>
                </View>
              </View>
            </FadeSlideIn>
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
    fontSize: 36,
    fontWeight: "800",
    color: colors.primary,
    letterSpacing: 0,
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
  linkButton: {
    alignItems: "center",
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  linkText: { fontSize: fonts.caption, color: colors.textSecondary },
  linkBold: { color: colors.primary, fontWeight: "600" },
  socialContainer: {
    marginTop: spacing.lg,
    alignItems: "center",
  },
  socialLabel: {
    fontSize: fonts.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  socialButtons: {
    width: "100%",
    flexDirection: "row",
    gap: spacing.sm,
  },
  socialButton: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    opacity: 0.7,
  },
  socialIcon: {
    width: 18,
    height: 18,
    marginBottom: 6,
    resizeMode: "contain",
  },
  socialButtonText: {
    fontSize: fonts.caption,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
