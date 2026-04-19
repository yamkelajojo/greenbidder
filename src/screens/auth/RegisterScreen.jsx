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
} from "react-native";
import Animated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { registerUser } from "../../services/authService";
import {
  createFarmerProfile,
  createBuyerProfile,
} from "../../services/profileService";
import { validate, registerSchema } from "../../validators/schemas";
import { colors, spacing, fonts, radius } from "../../config/theme";
import { supabase } from "../../config/supabase";
import TactilePressable from "../../components/shared/TactilePressable";
import FadeSlideIn from "../../components/shared/FadeSlideIn";
import AnimatedLogo from "../../components/shared/AnimatedLogo";
import {
  AnimatedErrorText,
  AnimatedErrorBanner,
  useErrorShake,
} from "../../components/shared/AnimatedError";
import { haptic } from "../../utils/haptics";

/**
 * Register screen — name, email, password, role selection.
 *
 * Stage 1a polish:
 *   • AnimatedLogo at top (subtle mode once user arrives from Login)
 *   • Staggered FadeSlideIn across sections
 *   • Role cards: TactilePressable; selection haptic fires on change only
 *   • Each input has its own shake style — only failing fields shake
 *   • AnimatedErrorText slides in below failed fields
 *   • AnimatedErrorBanner springs down on API error
 *   • Commit haptic on submit
 *
 * After signup, creates the role-specific profile (farmer or buyer).
 * Criterion 8 — full auth flow with error handling.
 */
export default function RegisterScreen({ navigation }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(null);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // One shake style per input — targeted shakes, not a blanket one
  const [nameShakeStyle, shakeName] = useErrorShake();
  const [emailShakeStyle, shakeEmail] = useErrorShake();
  const [passwordShakeStyle, shakePassword] = useErrorShake();
  const [roleShakeStyle, shakeRole] = useErrorShake();

  /**
   * Role selection handler — fires a selection haptic ONLY when the
   * role actually changes. Repeated taps on the already-selected role
   * stay silent.
   */
  const handleRoleSelect = (newRole) => {
    if (role === newRole) return;
    setRole(newRole);
    haptic.selection();
  };

  const handleRegister = async () => {
    setErrors({});
    setApiError("");

    const result = validate(registerSchema, {
      fullName,
      email,
      password,
      role,
    });
    if (!result.success) {
      setErrors(result.errors);
      // Shake whichever fields failed
      if (result.errors.fullName) shakeName();
      if (result.errors.email) shakeEmail();
      if (result.errors.password) shakePassword();
      if (result.errors.role) shakeRole();
      return;
    }

    setIsLoading(true);
    try {
      // Step 1: Create auth user (trigger auto-creates users row)
      const { data, error } = await registerUser({
        email,
        password,
        role,
        fullName,
      });

      if (error) {
        if (error.message?.includes("already registered")) {
          setApiError("This email is already registered. Try logging in.");
        } else {
          setApiError(
            error.message || "Registration failed. Please try again.",
          );
        }
        return;
      }

      // Step 2: Wait briefly for trigger to create users row, then fetch it
      const userId = data?.user?.id;
      if (!userId) {
        setApiError("Account created but profile setup failed. Please log in.");
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));

      let userData = null;
      let retries = 3;
      while (retries > 0 && !userData) {
        const { data: row } = await supabase
          .from("users")
          .select("id")
          .eq("auth_id", userId)
          .single();
        userData = row;
        if (!userData) {
          retries--;
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      if (!userData) {
        console.warn("Profile creation deferred — user row not yet available");
        return;
      }

      if (role === "farmer") {
        await createFarmerProfile({
          userId: userData.id,
          farmName: fullName + "'s Farm",
        });
      } else {
        await createBuyerProfile({
          userId: userData.id,
          fullName,
        });
      }

      // useAuth listener handles redirect
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
          {/* Logo — subtle mode since it already played on Login */}
          <View style={styles.header}>
            <AnimatedLogo text="GreenBidder" style={styles.logo} />
            <FadeSlideIn delay={120} distance={6}>
              <Text style={styles.subtitle}>Join the marketplace</Text>
            </FadeSlideIn>
          </View>

          <View style={styles.form}>
            <FadeSlideIn delay={200}>
              <Text style={styles.title}>Create Account</Text>
            </FadeSlideIn>

            <AnimatedErrorBanner message={apiError} />

            {/* Role selection */}
            <FadeSlideIn delay={260}>
              <Animated.View style={roleShakeStyle}>
                <Text style={styles.label}>I am a...</Text>
                <View style={styles.roleRow}>
                  <TactilePressable
                    style={[
                      styles.roleButton,
                      role === "buyer" && styles.roleSelected,
                    ]}
                    onPress={() => handleRoleSelect("buyer")}
                  >
                    <Text style={styles.roleEmoji}>🛒</Text>
                    <Text
                      style={[
                        styles.roleText,
                        role === "buyer" && styles.roleTextSelected,
                      ]}
                    >
                      Buyer
                    </Text>
                    <Text style={styles.roleDesc}>Browse and buy produce</Text>
                  </TactilePressable>

                  <TactilePressable
                    style={[
                      styles.roleButton,
                      role === "farmer" && styles.roleSelected,
                    ]}
                    onPress={() => handleRoleSelect("farmer")}
                  >
                    <Text style={styles.roleEmoji}>🌱</Text>
                    <Text
                      style={[
                        styles.roleText,
                        role === "farmer" && styles.roleTextSelected,
                      ]}
                    >
                      Farmer
                    </Text>
                    <Text style={styles.roleDesc}>List and sell produce</Text>
                  </TactilePressable>
                </View>
                <AnimatedErrorText error={errors.role} />
              </Animated.View>
            </FadeSlideIn>

            {/* Full Name */}
            <FadeSlideIn delay={340}>
              <Animated.View style={[styles.field, nameShakeStyle]}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={[styles.input, errors.fullName && styles.inputError]}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Your full name"
                  placeholderTextColor={colors.textTertiary}
                  autoComplete="name"
                />
                <AnimatedErrorText error={errors.fullName} />
              </Animated.View>
            </FadeSlideIn>

            {/* Email */}
            <FadeSlideIn delay={400}>
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

            {/* Password */}
            <FadeSlideIn delay={460}>
              <Animated.View style={[styles.field, passwordShakeStyle]}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={[styles.input, errors.password && styles.inputError]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Min 8 characters, 1 uppercase, 1 number"
                  placeholderTextColor={colors.textTertiary}
                  secureTextEntry
                />
                <AnimatedErrorText error={errors.password} />
              </Animated.View>
            </FadeSlideIn>

            {/* Submit */}
            <FadeSlideIn delay={540}>
              <TactilePressable
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleRegister}
                disabled={isLoading}
                haptic="commit"
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.buttonText}>Create Account</Text>
                )}
              </TactilePressable>
            </FadeSlideIn>

            {/* Log in link */}
            <FadeSlideIn delay={620}>
              <TactilePressable
                style={styles.linkButton}
                variant="compact"
                onPress={() => navigation.navigate("Login")}
              >
                <Text style={styles.linkText}>
                  Already have an account?{" "}
                  <Text style={styles.linkBold}>Log in</Text>
                </Text>
              </TactilePressable>
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
  scroll: { flexGrow: 1, padding: spacing.lg, paddingTop: spacing.xl },
  header: { alignItems: "center", marginBottom: spacing.lg },
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
  roleRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  roleButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
    backgroundColor: colors.background,
  },
  roleSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  roleEmoji: { fontSize: 28, marginBottom: spacing.xs },
  roleText: {
    fontSize: fonts.body,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  roleTextSelected: { color: colors.primaryDark },
  roleDesc: {
    fontSize: fonts.small,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: "center",
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
    paddingBottom: spacing.xl,
  },
  linkText: { fontSize: fonts.caption, color: colors.textSecondary },
  linkBold: { color: colors.primary, fontWeight: "600" },
});
