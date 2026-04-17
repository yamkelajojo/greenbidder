import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { BlurView } from "expo-blur";
import TactilePressable from "../shared/TactilePressable";
import {
  colors,
  spacing,
  radius,
  shadows,
  springs,
  text,
} from "../../config/theme";
import { haptic } from "../../utils/haptics";

/**
 * ═══════════════════════════════════════════════════════════════════════
 *   Sheet — Decision Surface
 *
 *   For moments when the user must commit. Slides up from the bottom
 *   with proper physics. Dismissible by:
 *   ─ Tapping a button
 *   ─ Swiping the sheet down past a threshold
 *   ─ Tapping the blurred backdrop
 *
 *   Animation:
 *   ─ Backdrop fades in (blur + dim)
 *   ─ Sheet slides up with spring, slight overshoot
 *   ─ Drag gesture tracks finger 1:1, rubber-bands if pulled up
 *   ─ On release, springs home or dismisses based on velocity + distance
 *
 *   This replaces every Alert.alert() that asks a question.
 *
 *   Usage (through FeedbackProvider):
 *     const ok = await sheet.confirm({
 *       title: "Delete this listing?",
 *       description: "This cannot be undone.",
 *       confirmLabel: "Delete",
 *       destructive: true,
 *     });
 * ═══════════════════════════════════════════════════════════════════════
 */

const HEIGHT = Dimensions.get("window").height;
const DISMISS_THRESHOLD = 100; // pixels
const DISMISS_VELOCITY = 500; // pixels per second

export default function Sheet({ sheet, onResolve }) {
  const {
    id,
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    destructive = false,
  } = sheet;

  // Single driver: 0 = hidden, 1 = visible
  const progress = useSharedValue(0);
  // Drag offset — when user pulls the sheet
  const dragY = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(1, springs.standard);
  }, [id]);

  const dismiss = (result) => {
    "worklet";
    progress.value = withTiming(0, { duration: 220 }, (finished) => {
      if (finished) runOnJS(onResolve)(id, result);
    });
  };

  const handleConfirm = () => {
    haptic.commit();
    dismiss(true);
  };

  const handleCancel = () => {
    haptic.tap();
    dismiss(false);
  };

  const handleBackdropPress = () => {
    haptic.tap();
    dismiss(false);
  };

  // Pan gesture: drag down to dismiss
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      // Allow down only (upward drag = rubber-band resistance)
      if (e.translationY > 0) {
        dragY.value = e.translationY;
      } else {
        dragY.value = e.translationY * 0.3; // rubber-band
      }
    })
    .onEnd((e) => {
      const shouldDismiss =
        e.translationY > DISMISS_THRESHOLD ||
        e.velocityY > DISMISS_VELOCITY;

      if (shouldDismiss) {
        dragY.value = withSpring(HEIGHT, springs.snappy);
        dismiss(false);
      } else {
        dragY.value = withSpring(0, springs.standard);
      }
    });

  // Backdrop fade
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  // Sheet slides in + tracks drag
  const sheetStyle = useAnimatedStyle(() => {
    const baseTranslate = interpolate(progress.value, [0, 1], [HEIGHT, 0]);
    return {
      transform: [{ translateY: baseTranslate + dragY.value }],
    };
  });

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Backdrop — blur + dim — tappable to dismiss */}
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill}>
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(20, 19, 15, 0.35)" }]}
            onPress={handleBackdropPress}
          />
        </BlurView>
      </Animated.View>

      {/* Sheet surface */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.sheet, shadows.overlay, sheetStyle]}>
          {/* Drag handle — visual affordance */}
          <View style={styles.handle} />

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Description */}
          {description ? (
            <Text style={styles.description}>{description}</Text>
          ) : null}

          {/* Actions */}
          <View style={styles.actions}>
            <TactilePressable
              style={styles.cancelButton}
              onPress={handleCancel}
              haptic={false}
              variant="subtle"
            >
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </TactilePressable>

            <TactilePressable
              style={[
                styles.confirmButton,
                destructive && styles.destructiveButton,
              ]}
              onPress={handleConfirm}
              haptic={false}
            >
              <Text
                style={[
                  styles.confirmText,
                  destructive && styles.destructiveText,
                ]}
              >
                {confirmLabel}
              </Text>
            </TactilePressable>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl + spacing.md,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: spacing.lg,
  },
  title: {
    ...text.h2,
    marginBottom: spacing.sm,
  },
  description: {
    ...text.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  cancelButton: {
    flex: 1,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelText: {
    ...text.button,
    color: colors.textPrimary,
  },
  confirmButton: {
    flex: 1,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  destructiveButton: {
    backgroundColor: colors.danger,
  },
  confirmText: {
    ...text.button,
    color: colors.onPrimary,
  },
  destructiveText: {
    color: colors.onPrimary,
  },
});
