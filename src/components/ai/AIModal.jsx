import React, { useEffect, useRef, useMemo } from "react";
import { View, Text, StyleSheet, Dimensions, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  runOnJS,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { X } from "lucide-react-native";
import { useAIModal } from "./AIModalContext";
import { scoreToHex, scoreToColor } from "../../utils/scoreColor";
import { colors, spacing, fonts, radius } from "../../config/theme";

/**
 * ═══════════════════════════════════════════════════════════════════════
 *   AIModal v9 — v7 Entrances + v8 Leaves (Tamed)
 *
 *   ROLLBACK: entrance animations restored to the v7 state the user
 *   loved — subtle slide-ins, motion stretch, gentle easing. No wild
 *   rotations. AI label, close button, etc. animate calmly.
 *
 *   KEPT FROM v8: the LEAVE animation system. Elements have distinct
 *   exits (rotate, slide, scale down) that scatter quickly while the
 *   modal closes. Modal close begins at t=110ms (50% through leaves).
 *
 *   TUNED ON TOP:
 *     • Opacity fades FASTER on leave — uses sub-range [0, 0.75] of the
 *       leave value so element is mostly transparent by 75% of leave.
 *     • Scale shrinks EVEN FASTER — sub-range [0, 0.65]. Element
 *       collapses inward before fully fading. "Husk collapsing" feel.
 *
 *   Everything else preserved from v7: ribbon band, tactile close button,
 *   word-by-word text, choreography timing.
 * ═══════════════════════════════════════════════════════════════════════
 */

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const MODAL_WIDTH = 340;
const MODAL_HEIGHT = 420;
const MODAL_RADIUS = 20;

const RIBBON_TOP_INSET = 80;
const RIBBON_BOTTOM_INSET = 70;

const OPEN_SPRING = {
  damping: 24,
  stiffness: 200,
  mass: 0.7,
  overshootClamping: false,
  restDisplacementThreshold: 0.001,
  restSpeedThreshold: 0.001,
};

const CLOSE_SPRING = {
  damping: 22,
  stiffness: 220,
  mass: 0.8,
  overshootClamping: false,
  restDisplacementThreshold: 0.001,
  restSpeedThreshold: 0.001,
};

// Ease vocabulary
const EASE_SETTLE = Easing.bezier(0.22, 1, 0.36, 1);
const EASE_TACTILE = Easing.bezier(0.34, 1.35, 0.64, 1);
const EASE_PLAYFUL = Easing.bezier(0.34, 1.7, 0.6, 1);
const EASE_DROP = Easing.bezier(0.5, 0, 0.2, 1);
const EASE_READING = Easing.bezier(0.25, 0.1, 0.3, 1);
const EASE_IN_QUICK = Easing.bezier(0.5, 0, 0.9, 0.4);
const EASE_IN_CUBIC = Easing.bezier(0.64, 0, 0.78, 0);

const DOT_SPRING = {
  damping: 12,
  stiffness: 280,
  mass: 0.6,
  overshootClamping: false,
};

const PRESS_SPRING = {
  damping: 15,
  stiffness: 400,
  mass: 0.5,
};

// Ribbon motion
const PHI = 1.618033988749;
const SQRT2 = 1.414213562373;
const SQRT3 = 1.732050807568;
const SPEED_MULT = 1.15;
const DIST_MULT = 1.15;

// ═══ LEAVE SUB-RANGE CONSTANTS ═══
// Instead of opacity = 1 - leaveValue (linear), we use sub-ranges so
// opacity finishes fading at 75% of leave and scale at 65%. This makes
// scale shrink ahead of opacity — "collapsing husk" feel.
const LEAVE_OPACITY_END = 0.75;
const LEAVE_SCALE_END = 0.65;

function buildGradientColors(score) {
  let primaryTransparent, secondaryPeak;
  if (score >= 7.5) {
    primaryTransparent = "rgba(99, 153, 34, 0.0)";
    secondaryPeak = "rgba(99, 153, 34, 0.165)";
  } else if (score >= 6) {
    primaryTransparent = "rgba(239, 159, 39, 0.0)";
    secondaryPeak = "rgba(239, 159, 39, 0.165)";
  } else {
    primaryTransparent = "rgba(186, 117, 23, 0.0)";
    secondaryPeak = "rgba(186, 117, 23, 0.165)";
  }
  return [
    primaryTransparent,
    "rgba(239, 159, 39, 0.09)",
    "rgba(255, 220, 170, 0.11)",
    secondaryPeak,
    "rgba(255, 200, 160, 0.105)",
    "rgba(168, 195, 170, 0.075)",
    "rgba(205, 195, 215, 0.06)",
    primaryTransparent,
  ];
}

const GRADIENT_POSITIONS = [0, 0.12, 0.28, 0.48, 0.62, 0.76, 0.86, 1.0];

function modalBackgroundForScore(score) {
  if (score == null) return "rgba(252, 251, 248, 0.96)";
  const [r, g, b] = scoreToColor(score);
  const mixR = Math.round(r * 0.04 + 255 * 0.96);
  const mixG = Math.round(g * 0.04 + 255 * 0.96);
  const mixB = Math.round(b * 0.04 + 255 * 0.96);
  return `rgba(${mixR}, ${mixG}, ${mixB}, 0.96)`;
}

function modalShadowForScore(score) {
  if (score == null) return "rgba(60, 55, 50, 0.06)";
  const [r, g, b] = scoreToColor(score);
  const dR = Math.round(r * 0.1 + 60 * 0.9);
  const dG = Math.round(g * 0.1 + 55 * 0.9);
  const dB = Math.round(b * 0.1 + 50 * 0.9);
  return `rgba(${dR}, ${dG}, ${dB}, 0.06)`;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Small per-open randomization just for leave motion directions.
 * Entry animations stay calm and predictable (as the user loved in v7).
 */
function generateLeaveDirections() {
  const sign = () => (Math.random() > 0.5 ? 1 : -1);
  return {
    scoreLeaveDir: sign(),
    labelLeaveDir: sign(),
    harvestLeaveDir: sign(),
    storageLeaveDir: sign(),
  };
}

// ─── Close button (tactile) ─────
function CloseButton({ onPress, entranceStyle, leaveStyle }) {
  const pressScale = useSharedValue(1);
  const pressGlow = useSharedValue(0);
  const iconRotate = useSharedValue(0);

  const handlePressIn = () => {
    pressScale.value = withSpring(0.88, PRESS_SPRING);
    pressGlow.value = withTiming(1, { duration: 180, easing: EASE_SETTLE });
    iconRotate.value = withSequence(
      withTiming(-6, { duration: 120, easing: EASE_TACTILE }),
      withTiming(0, { duration: 220, easing: EASE_SETTLE }),
    );
  };

  const handlePressOut = () => {
    pressScale.value = withSpring(1, PRESS_SPRING);
    pressGlow.value = withTiming(0, { duration: 380, easing: EASE_SETTLE });
  };

  const buttonAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const redGlowStyle = useAnimatedStyle(() => ({
    opacity: pressGlow.value,
  }));

  const iconAnimStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${iconRotate.value}deg` }],
  }));

  return (
    <Animated.View
      style={[styles.closeButtonContainer, entranceStyle, leaveStyle]}
    >
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.closeButton, buttonAnimStyle]}
        hitSlop={10}
      >
        <Animated.View
          style={[styles.closeButtonRedPulse, redGlowStyle]}
          pointerEvents="none"
        />
        <Animated.View style={iconAnimStyle}>
          <X size={16} color={colors.textSecondary} />
        </Animated.View>
      </AnimatedPressable>
    </Animated.View>
  );
}

// ─── Word-by-word text ───
function WordByWordText({ text, wordValues, textStyle }) {
  const words = text.split(" ");
  return (
    <View style={styles.wordContainer}>
      {words.map((word, i) => (
        <AnimatedWord
          key={`${i}-${word}`}
          word={word}
          sharedValue={wordValues[i]}
          textStyle={textStyle}
          isLast={i === words.length - 1}
        />
      ))}
    </View>
  );
}

function AnimatedWord({ word, sharedValue, textStyle, isLast }) {
  const animStyle = useAnimatedStyle(() => {
    if (!sharedValue) return { opacity: 0 };
    const v = sharedValue.value;
    return {
      opacity: v,
      transform: [{ translateY: interpolate(v, [0, 1], [6, 0]) }],
    };
  });

  return (
    <Animated.Text style={[textStyle, styles.word, animStyle]}>
      {word}
      {!isLast ? " " : ""}
    </Animated.Text>
  );
}

export default function AIModal() {
  const {
    isOpen,
    aiData,
    sourceRect,
    score,
    hideAIModal,
    finalizeClose,
    closeProgress,
  } = useAIModal();

  const progress = useSharedValue(0);

  // Entry values (0 = pre-entry, 1 = arrived)
  const dotR = useSharedValue(0);
  const scoreR = useSharedValue(0);
  const labelR = useSharedValue(0);
  const closeR = useSharedValue(0);
  const harvestR = useSharedValue(0);
  const stat1R = useSharedValue(0);
  const stat2R = useSharedValue(0);
  const storageR = useSharedValue(0);

  // Leave values (0 = still present, 1 = gone)
  const dotLeave = useSharedValue(0);
  const scoreLeave = useSharedValue(0);
  const labelLeave = useSharedValue(0);
  const closeLeave = useSharedValue(0);
  const harvestLeave = useSharedValue(0);
  const stat1Leave = useSharedValue(0);
  const stat2Leave = useSharedValue(0);
  const storageLeave = useSharedValue(0);

  const content = prepareContent(aiData);
  const varietyWords = content.variety.split(" ");
  const qualityWords = content.qualityNote.split(" ");

  const varietyWordValues = [
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
  ];
  const qualityWordValues = [
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
  ];

  const jitteredTimings = useRef(generateCornerTimings()).current;
  const leaveDirs = useRef(generateLeaveDirections()).current;

  useEffect(() => {
    if (isOpen) {
      Object.assign(jitteredTimings, generateCornerTimings());
      Object.assign(leaveDirs, generateLeaveDirections());
      progress.value = 0;

      // Reset all entry + leave values
      [
        dotR,
        scoreR,
        labelR,
        closeR,
        harvestR,
        stat1R,
        stat2R,
        storageR,
        dotLeave,
        scoreLeave,
        labelLeave,
        closeLeave,
        harvestLeave,
        stat1Leave,
        stat2Leave,
        storageLeave,
      ].forEach((sv) => (sv.value = 0));
      varietyWordValues.forEach((v) => (v.value = 0));
      qualityWordValues.forEach((v) => (v.value = 0));

      progress.value = withSpring(1, OPEN_SPRING);

      // ═══ V7 ENTRANCES — calm, subtle, as the user loved ═══
      const T0 = 340;

      dotR.value = withDelay(T0 + 0, withSpring(1, DOT_SPRING));

      scoreR.value = withDelay(
        T0 + 80,
        withTiming(1, { duration: 480, easing: EASE_TACTILE }),
      );

      labelR.value = withDelay(
        T0 + 180,
        withTiming(1, { duration: 400, easing: EASE_SETTLE }),
      );

      closeR.value = withDelay(
        T0 + 240,
        withTiming(1, { duration: 460, easing: EASE_PLAYFUL }),
      );

      varietyWords.forEach((_, i) => {
        if (i >= varietyWordValues.length) return;
        varietyWordValues[i].value = withDelay(
          T0 + 300 + i * 150,
          withTiming(1, { duration: 420, easing: EASE_READING }),
        );
      });

      harvestR.value = withDelay(
        T0 + 600,
        withTiming(1, { duration: 440, easing: EASE_TACTILE }),
      );

      stat1R.value = withDelay(
        T0 + 720,
        withTiming(1, { duration: 460, easing: EASE_DROP }),
      );
      stat2R.value = withDelay(
        T0 + 820,
        withTiming(1, { duration: 460, easing: EASE_DROP }),
      );

      qualityWords.forEach((_, i) => {
        if (i >= qualityWordValues.length) return;
        qualityWordValues[i].value = withDelay(
          T0 + 840 + i * 120,
          withTiming(1, { duration: 440, easing: EASE_READING }),
        );
      });

      const qualityEndTime =
        T0 +
        840 +
        Math.min(qualityWords.length, qualityWordValues.length) * 120;
      storageR.value = withDelay(
        qualityEndTime - 200,
        withTiming(1, { duration: 500, easing: EASE_SETTLE }),
      );
    } else if (progress.value > 0) {
      // ═══ V8 LEAVE ANIMATIONS — elements scatter, modal closes overlap ═══
      const leaveTiming = (duration) => ({ duration, easing: EASE_IN_QUICK });

      storageLeave.value = withDelay(0, withTiming(1, leaveTiming(180)));

      qualityWords.forEach((_, i) => {
        if (i >= qualityWordValues.length) return;
        qualityWordValues[i].value = withDelay(
          i * 15,
          withTiming(0, { duration: 140, easing: EASE_IN_CUBIC }),
        );
      });

      stat2Leave.value = withDelay(20, withTiming(1, leaveTiming(200)));
      stat1Leave.value = withDelay(30, withTiming(1, leaveTiming(200)));

      harvestLeave.value = withDelay(45, withTiming(1, leaveTiming(200)));

      varietyWords.forEach((_, i) => {
        if (i >= varietyWordValues.length) return;
        varietyWordValues[i].value = withDelay(
          i * 12,
          withTiming(0, { duration: 140, easing: EASE_IN_CUBIC }),
        );
      });

      closeLeave.value = withDelay(60, withTiming(1, leaveTiming(220)));
      labelLeave.value = withDelay(70, withTiming(1, leaveTiming(180)));
      scoreLeave.value = withDelay(80, withTiming(1, leaveTiming(200)));
      dotLeave.value = withDelay(90, withTiming(1, leaveTiming(180)));

      // Modal starts closing at t=110ms (about 50% through leaves)
      progress.value = withDelay(
        110,
        withSpring(0, CLOSE_SPRING, (finished) => {
          if (finished) {
            runOnJS(finalizeClose)();
          }
        }),
      );
    }
  }, [isOpen]);

  useAnimatedReaction(
    () => ({ p: progress.value, open: isOpen }),
    (current) => {
      if (!current.open && current.p < 1) {
        closeProgress.value = 1 - current.p;
      } else {
        closeProgress.value = 0;
      }
    },
  );

  if (!sourceRect && progress.value === 0) return null;

  const safeRect = sourceRect || {
    x: SCREEN_W / 2 - 30,
    y: SCREEN_H / 2 - 12,
    width: 60,
    height: 24,
  };

  const elementValues = {
    dotR,
    scoreR,
    labelR,
    closeR,
    harvestR,
    stat1R,
    stat2R,
    storageR,
    dotLeave,
    scoreLeave,
    labelLeave,
    closeLeave,
    harvestLeave,
    stat1Leave,
    stat2Leave,
    storageLeave,
    varietyWordValues,
    qualityWordValues,
  };

  return (
    <ModalInner
      progress={progress}
      elementValues={elementValues}
      safeRect={safeRect}
      aiData={aiData}
      score={score}
      hideAIModal={hideAIModal}
      timings={jitteredTimings}
      leaveDirs={leaveDirs}
      content={content}
    />
  );
}

function generateCornerTimings() {
  const j = () => (Math.random() - 0.5) * 0.12;
  return {
    topRight: [0.15 + j(), 0.55 + j()],
    bottomRight: [0.25 + j(), 0.48 + j()],
    topLeft: [0.55 + j(), 0.95 + j()],
    bottomLeft: [0.7 + j(), 1.0 + j()],
  };
}

function ModalInner({
  progress,
  elementValues,
  safeRect,
  aiData,
  score,
  hideAIModal,
  timings,
  leaveDirs,
  content,
}) {
  const insets = useSafeAreaInsets();
  const visibleCenterY =
    insets.top + (SCREEN_H - insets.top - insets.bottom) / 2;
  const visibleCenterX = SCREEN_W / 2;

  const ribbonPhase = useRef(Math.random() * Math.PI * 2).current;
  const ribbonTime = useSharedValue(0);

  useAnimatedReaction(
    () => progress.value,
    (p) => {
      if (p > 0.1) {
        ribbonTime.value += 0.016 * SPEED_MULT;
      }
    },
  );

  const gradientColors = useMemo(
    () => buildGradientColors(score ?? 7),
    [score],
  );
  const modalBg = useMemo(() => modalBackgroundForScore(score), [score]);
  const modalShadow = useMemo(() => modalShadowForScore(score), [score]);
  const dotHex = score != null ? scoreToHex(score) : "#888";

  const {
    dotR,
    scoreR,
    labelR,
    closeR,
    harvestR,
    stat1R,
    stat2R,
    storageR,
    dotLeave,
    scoreLeave,
    labelLeave,
    closeLeave,
    harvestLeave,
    stat1Leave,
    stat2Leave,
    storageLeave,
    varietyWordValues,
    qualityWordValues,
  } = elementValues;

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 0.2, 1],
      [0, 1, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const morphStyle = useAnimatedStyle(() => {
    const p = progress.value;

    const centerX_src = safeRect.x + safeRect.width / 2;
    const centerY_src = safeRect.y + safeRect.height / 2;
    const currentX = interpolate(p, [0, 1], [centerX_src, visibleCenterX]);
    const currentY = interpolate(p, [0, 1], [centerY_src, visibleCenterY]);

    const shapeProgress = interpolate(
      p,
      [0, 0.85, 1],
      [0, 0.94, 1],
      Extrapolation.CLAMP,
    );
    const currentW = interpolate(
      shapeProgress,
      [0, 1],
      [safeRect.width, MODAL_WIDTH],
    );
    const currentH = interpolate(
      shapeProgress,
      [0, 1],
      [safeRect.height, MODAL_HEIGHT],
    );

    const pillCurve = Math.min(safeRect.height, safeRect.width) / 2;
    const trProgress = interpolate(
      p,
      timings.topRight,
      [0, 1],
      Extrapolation.CLAMP,
    );
    const brProgress = interpolate(
      p,
      timings.bottomRight,
      [0, 1],
      Extrapolation.CLAMP,
    );
    const tlProgress = interpolate(
      p,
      timings.topLeft,
      [0, 1],
      Extrapolation.CLAMP,
    );
    const blProgress = interpolate(
      p,
      timings.bottomLeft,
      [0, 1],
      Extrapolation.CLAMP,
    );
    const topRightRadius = interpolate(
      trProgress,
      [0, 1],
      [pillCurve, MODAL_RADIUS],
    );
    const bottomRightRadius = interpolate(
      brProgress,
      [0, 1],
      [pillCurve, MODAL_RADIUS],
    );
    const topLeftRadius = interpolate(
      tlProgress,
      [0, 1],
      [pillCurve, MODAL_RADIUS],
    );
    const bottomLeftRadius = interpolate(
      blProgress,
      [0, 1],
      [pillCurve, MODAL_RADIUS],
    );

    const ghostOpacity = interpolate(p, [0, 0.15], [0, 1], Extrapolation.CLAMP);
    const shadowOpacity = interpolate(p, [0, 1], [0, 0.22]);
    const shadowRadius = interpolate(p, [0, 1], [0, 24]);

    return {
      position: "absolute",
      left: currentX - currentW / 2,
      top: currentY - currentH / 2,
      width: currentW,
      height: currentH,
      borderTopLeftRadius: topLeftRadius,
      borderTopRightRadius: topRightRadius,
      borderBottomLeftRadius: bottomLeftRadius,
      borderBottomRightRadius: bottomRightRadius,
      opacity: ghostOpacity,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity,
      shadowRadius,
      elevation: interpolate(p, [0, 1], [0, 12]),
    };
  });

  const softRibbonStyle = useAnimatedStyle(() => {
    const t = ribbonTime.value;
    const driftX = Math.sin(t / PHI + ribbonPhase) * 28 * DIST_MULT;
    const floatY = Math.sin(t / SQRT2 + ribbonPhase * 1.7) * 8 * DIST_MULT;
    const opacityPhase = Math.sin(t / SQRT3 + ribbonPhase * 2.3);
    const baseOpacity = interpolate(opacityPhase, [-1, 1], [0.35, 0.58]);
    return {
      opacity: baseOpacity,
      transform: [
        { translateX: driftX },
        { translateY: floatY },
        { scale: 1.15 },
      ],
    };
  });

  const sharpRibbonStyle = useAnimatedStyle(() => {
    const t = ribbonTime.value;
    const driftX = Math.sin(t / PHI + ribbonPhase + Math.PI) * 20 * DIST_MULT;
    const floatY =
      Math.sin(t / SQRT2 + ribbonPhase * 1.7 + Math.PI / 2) * 6 * DIST_MULT;
    const opacityPhase = Math.sin(t / SQRT3 + ribbonPhase * 2.3 + Math.PI / 3);
    const baseOpacity = interpolate(opacityPhase, [-1, 1], [0.4, 0.62]);
    return {
      opacity: baseOpacity,
      transform: [{ translateX: driftX }, { translateY: floatY }, { scale: 1 }],
    };
  });

  const ultraSoftRibbonStyle = useAnimatedStyle(() => {
    const t = ribbonTime.value;
    const driftX =
      Math.sin(t / (PHI * 1.5) + ribbonPhase + 2.1) * 34 * DIST_MULT;
    const opacityPhase = Math.sin(t / (SQRT3 * 1.3) + ribbonPhase);
    const baseOpacity = interpolate(opacityPhase, [-1, 1], [0.28, 0.48]);
    return {
      opacity: baseOpacity,
      transform: [{ translateX: driftX }, { scale: 1.3 }],
    };
  });

  // ═══════════════════════════════════════════════════════════════
  //   Helper: leave-value-derived opacity and scale multipliers.
  //
  //   Opacity sub-range [0, 0.75] — element is ~transparent by 75% of leave.
  //   Scale sub-range [0, 0.65]   — element has reached minimum scale by 65%.
  //
  //   Scale shrinks AHEAD of opacity fade. Combined: element collapses
  //   inward while still slightly visible, then its "husk" fades. Creates
  //   a tactile "element absorbed away" feel rather than a flat fadeout.
  // ═══════════════════════════════════════════════════════════════

  // ═══ ENTRANCE STYLES (v7 — unchanged) + LEAVE additions ═══

  // DOT — v7 entrance + leave with faster scale drop
  const dotEntranceStyle = useAnimatedStyle(() => {
    const v = dotR.value;
    const l = dotLeave.value;
    // v7 entrance
    const entryScale = v;
    const entryOp = interpolate(v, [0, 0.3, 1], [0, 1, 1], Extrapolation.CLAMP);
    // Leave — scale shrinks faster than opacity
    const leaveOp = interpolate(
      l,
      [0, LEAVE_OPACITY_END],
      [1, 0],
      Extrapolation.CLAMP,
    );
    const leaveScale = interpolate(
      l,
      [0, LEAVE_SCALE_END],
      [1, 0],
      Extrapolation.CLAMP,
    );
    return {
      opacity: entryOp * leaveOp,
      transform: [{ scale: entryScale * leaveScale }],
    };
  });

  // SCORE — v7: slide up 10px + scale 0.7→1 with motion stretch
  const scoreEntranceStyle = useAnimatedStyle(() => {
    const v = scoreR.value;
    const l = scoreLeave.value;
    const motionStretchY = interpolate(v, [0, 0.5, 1], [1, 1.08, 1]);
    // v7 entrance
    const entryY = interpolate(v, [0, 1], [10, 0]);
    const entryScaleX = interpolate(v, [0, 1], [0.7, 1]);
    const entryScaleY = interpolate(v, [0, 1], [0.7, 1]) * motionStretchY;
    const entryOp = interpolate(v, [0, 0.3, 1], [0, 1, 1], Extrapolation.CLAMP);
    // Leave — fade + scale down (scale faster) + slight upward drift with rotation
    const leaveOp = interpolate(
      l,
      [0, LEAVE_OPACITY_END],
      [1, 0],
      Extrapolation.CLAMP,
    );
    const leaveScale = interpolate(
      l,
      [0, LEAVE_SCALE_END],
      [1, 0.7],
      Extrapolation.CLAMP,
    );
    const leaveY = interpolate(l, [0, 1], [0, -20]);
    const leaveRot = interpolate(l, [0, 1], [0, leaveDirs.scoreLeaveDir * 15]);
    return {
      opacity: entryOp * leaveOp,
      transform: [
        { translateY: entryY + leaveY },
        { rotate: `${leaveRot}deg` },
        { scaleX: entryScaleX * leaveScale },
        { scaleY: entryScaleY * leaveScale },
      ],
    };
  });

  // AI LABEL — v7: slide from right +24 with motion stretch
  const labelEntranceStyle = useAnimatedStyle(() => {
    const v = labelR.value;
    const l = labelLeave.value;
    const motionStretchX = interpolate(v, [0, 0.5, 1], [1, 1.12, 1]);
    const entryX = interpolate(v, [0, 1], [24, 0]);
    const entryOp = v;
    // Leave — fade + drift up with slight rotation
    const leaveOp = interpolate(
      l,
      [0, LEAVE_OPACITY_END],
      [1, 0],
      Extrapolation.CLAMP,
    );
    const leaveScale = interpolate(
      l,
      [0, LEAVE_SCALE_END],
      [1, 0.85],
      Extrapolation.CLAMP,
    );
    const leaveY = interpolate(l, [0, 1], [0, -15]);
    const leaveRot = interpolate(l, [0, 1], [0, leaveDirs.labelLeaveDir * 15]);
    return {
      opacity: entryOp * leaveOp,
      transform: [
        { translateX: entryX },
        { translateY: leaveY },
        { rotate: `${leaveRot}deg` },
        { scaleX: motionStretchX * leaveScale },
        { scaleY: leaveScale },
      ],
    };
  });

  // CLOSE BUTTON — v7 entrance (returned to calm: scale 0.3→1 + rotate -20°)
  //                 leave: scale to 0 (shrinks fast), opacity fades
  const closeEntranceStyle = useAnimatedStyle(() => {
    const v = closeR.value;
    const entryScale = interpolate(v, [0, 1], [0.3, 1]);
    const entryRot = interpolate(v, [0, 1], [-20, 0]);
    const entryOp = interpolate(v, [0, 0.2, 1], [0, 1, 1], Extrapolation.CLAMP);
    return {
      opacity: entryOp,
      transform: [{ scale: entryScale }, { rotate: `${entryRot}deg` }],
    };
  });

  const closeLeaveStyle = useAnimatedStyle(() => {
    const l = closeLeave.value;
    const leaveOp = interpolate(
      l,
      [0, LEAVE_OPACITY_END],
      [1, 0],
      Extrapolation.CLAMP,
    );
    const leaveScale = interpolate(
      l,
      [0, LEAVE_SCALE_END],
      [1, 0],
      Extrapolation.CLAMP,
    );
    const leaveRot = interpolate(l, [0, 1], [0, 90]);
    return {
      opacity: leaveOp,
      transform: [{ scale: leaveScale }, { rotate: `${leaveRot}deg` }],
    };
  });

  // HARVEST PILL — v7: slide from left -24, scale 0.9→1, motion stretch
  const harvestEntranceStyle = useAnimatedStyle(() => {
    const v = harvestR.value;
    const l = harvestLeave.value;
    const motionStretchX = interpolate(v, [0, 0.5, 1], [1, 1.1, 1]);
    const entryX = interpolate(v, [0, 1], [-24, 0]);
    const entryScale = interpolate(v, [0, 1], [0.9, 1]);
    const entryOp = v;
    // Leave — slight drift + fade + scale shrink
    const leaveOp = interpolate(
      l,
      [0, LEAVE_OPACITY_END],
      [1, 0],
      Extrapolation.CLAMP,
    );
    const leaveScale = interpolate(
      l,
      [0, LEAVE_SCALE_END],
      [1, 0.8],
      Extrapolation.CLAMP,
    );
    const leaveX = interpolate(l, [0, 1], [0, leaveDirs.harvestLeaveDir * 20]);
    const leaveY = interpolate(l, [0, 1], [0, -12]);
    const leaveRot = interpolate(
      l,
      [0, 1],
      [0, leaveDirs.harvestLeaveDir * 15],
    );
    return {
      opacity: entryOp * leaveOp,
      transform: [
        { translateX: entryX + leaveX },
        { translateY: leaveY },
        { rotate: `${leaveRot}deg` },
        { scale: entryScale * leaveScale },
        { scaleX: motionStretchX },
      ],
    };
  });

  // STAT 1 — v7: drop from +20 with motion stretch
  const stat1EntranceStyle = useAnimatedStyle(() => {
    const v = stat1R.value;
    const l = stat1Leave.value;
    const motionStretchY = interpolate(v, [0, 0.5, 1], [1, 1.15, 1]);
    const entryY = interpolate(v, [0, 1], [20, 0]);
    const entryOp = v;
    // Leave — falls down + fades + scales
    const leaveOp = interpolate(
      l,
      [0, LEAVE_OPACITY_END],
      [1, 0],
      Extrapolation.CLAMP,
    );
    const leaveScale = interpolate(
      l,
      [0, LEAVE_SCALE_END],
      [1, 0.8],
      Extrapolation.CLAMP,
    );
    const leaveY = interpolate(l, [0, 1], [0, 25]);
    const leaveRot = interpolate(l, [0, 1], [0, -20]);
    return {
      opacity: entryOp * leaveOp,
      transform: [
        { translateY: entryY + leaveY },
        { rotate: `${leaveRot}deg` },
        { scale: leaveScale },
        { scaleY: motionStretchY },
      ],
    };
  });

  // STAT 2 — mirrors stat 1 on leave (opposite rotation direction)
  const stat2EntranceStyle = useAnimatedStyle(() => {
    const v = stat2R.value;
    const l = stat2Leave.value;
    const motionStretchY = interpolate(v, [0, 0.5, 1], [1, 1.15, 1]);
    const entryY = interpolate(v, [0, 1], [20, 0]);
    const entryOp = v;
    const leaveOp = interpolate(
      l,
      [0, LEAVE_OPACITY_END],
      [1, 0],
      Extrapolation.CLAMP,
    );
    const leaveScale = interpolate(
      l,
      [0, LEAVE_SCALE_END],
      [1, 0.8],
      Extrapolation.CLAMP,
    );
    const leaveY = interpolate(l, [0, 1], [0, 25]);
    const leaveRot = interpolate(l, [0, 1], [0, 20]); // opposite of stat1
    return {
      opacity: entryOp * leaveOp,
      transform: [
        { translateY: entryY + leaveY },
        { rotate: `${leaveRot}deg` },
        { scale: leaveScale },
        { scaleY: motionStretchY },
      ],
    };
  });

  // STORAGE TIP — v7: slide up +24, scale 0.95→1
  const storageEntranceStyle = useAnimatedStyle(() => {
    const v = storageR.value;
    const l = storageLeave.value;
    const motionStretchY = interpolate(v, [0, 0.5, 1], [1, 1.1, 1]);
    const entryY = interpolate(v, [0, 1], [24, 0]);
    const entryScale = interpolate(v, [0, 1], [0.95, 1]);
    const entryOp = v;
    // Leave — falls down + rotates + fades
    const leaveOp = interpolate(
      l,
      [0, LEAVE_OPACITY_END],
      [1, 0],
      Extrapolation.CLAMP,
    );
    const leaveScale = interpolate(
      l,
      [0, LEAVE_SCALE_END],
      [1, 0.85],
      Extrapolation.CLAMP,
    );
    const leaveY = interpolate(l, [0, 1], [0, 30]);
    const leaveRot = interpolate(
      l,
      [0, 1],
      [0, leaveDirs.storageLeaveDir * 12],
    );
    return {
      opacity: entryOp * leaveOp,
      transform: [
        { translateY: entryY + leaveY },
        { rotate: `${leaveRot}deg` },
        { scale: entryScale * leaveScale },
        { scaleY: motionStretchY },
      ],
    };
  });

  return (
    <>
      <Animated.View
        style={[StyleSheet.absoluteFill, backdropStyle, styles.backdropWrap]}
        pointerEvents="auto"
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={hideAIModal}>
          <BlurView
            intensity={10}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.backdropTint} />
        </Pressable>
      </Animated.View>

      <Animated.View style={[morphStyle, styles.morphContainer]}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: modalBg }]}>
          <View
            style={[
              styles.ribbonBand,
              { top: RIBBON_TOP_INSET, bottom: RIBBON_BOTTOM_INSET },
            ]}
            pointerEvents="none"
          >
            <Animated.View
              style={[styles.ribbonLayerUltraSoft, ultraSoftRibbonStyle]}
            >
              <LinearGradient
                colors={gradientColors}
                locations={GRADIENT_POSITIONS}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>

            <Animated.View style={[styles.ribbonLayer, softRibbonStyle]}>
              <LinearGradient
                colors={gradientColors}
                locations={GRADIENT_POSITIONS}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>

            <Animated.View style={[styles.ribbonLayerSharp, sharpRibbonStyle]}>
              <LinearGradient
                colors={gradientColors}
                locations={GRADIENT_POSITIONS}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>

          <LinearGradient
            colors={[
              "rgba(255, 255, 255, 0.55)",
              "rgba(255, 255, 255, 0.08)",
              "rgba(255, 255, 255, 0)",
            ]}
            locations={[0, 0.25, 0.55]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          <LinearGradient
            colors={["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0)", modalShadow]}
            locations={[0, 0.6, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          <View style={styles.edgeLight} pointerEvents="none" />

          <View style={styles.content}>
            <View style={styles.headerRow}>
              <View style={styles.scoreRow}>
                <Animated.View
                  style={[
                    styles.bigDot,
                    { backgroundColor: dotHex },
                    dotEntranceStyle,
                  ]}
                />
                <Animated.Text style={[styles.bigScore, scoreEntranceStyle]}>
                  {score != null ? score.toFixed(1) : "—"}
                </Animated.Text>
              </View>

              <Animated.Text style={[styles.aiLabel, labelEntranceStyle]}>
                AI ANALYSIS
              </Animated.Text>

              <CloseButton
                onPress={hideAIModal}
                entranceStyle={closeEntranceStyle}
                leaveStyle={closeLeaveStyle}
              />
            </View>

            <View style={styles.varietyContainer}>
              <WordByWordText
                text={content.variety}
                wordValues={varietyWordValues}
                textStyle={styles.variety}
              />
            </View>

            <Animated.View
              style={[
                styles.harvestPill,
                content.harvestStyle,
                harvestEntranceStyle,
              ]}
            >
              <Text style={[styles.harvestText, content.harvestTextStyle]}>
                {content.harvestText}
              </Text>
            </Animated.View>

            <View style={styles.statsRow}>
              <Animated.View style={[styles.statBox, stat1EntranceStyle]}>
                <Text style={styles.statLabel}>SHELF LIFE</Text>
                <Text style={styles.statValue}>{content.shelfLife}</Text>
              </Animated.View>
              <Animated.View style={[styles.statBox, stat2EntranceStyle]}>
                <Text style={styles.statLabel}>RIPENESS</Text>
                <Text style={styles.statValue}>{content.ripeness}</Text>
              </Animated.View>
            </View>

            <View style={styles.qualityContainer}>
              <WordByWordText
                text={content.qualityNote}
                wordValues={qualityWordValues}
                textStyle={styles.qualityNote}
              />
            </View>

            <Animated.View style={[styles.storageTip, storageEntranceStyle]}>
              <Text style={styles.storageTipText}>
                <Text style={{ fontWeight: "600" }}>Storage · </Text>
                {content.storageTip}
              </Text>
            </Animated.View>
          </View>
        </View>
      </Animated.View>
    </>
  );
}

function prepareContent(aiData) {
  const raw = aiData?.raw_feedback || {};

  const harvestReady = raw.harvest_readiness;
  let harvestText, harvestStyle, harvestTextStyle;
  if (harvestReady === "ready") {
    harvestText = "✓ Ready to sell";
    harvestStyle = styles.harvestGreen;
    harvestTextStyle = styles.harvestGreenText;
  } else if (harvestReady === "soon") {
    harvestText = "◐ Almost ready";
    harvestStyle = styles.harvestAmber;
    harvestTextStyle = styles.harvestAmberText;
  } else if (harvestReady === "overdue") {
    harvestText = "⚠ Overdue";
    harvestStyle = styles.harvestRed;
    harvestTextStyle = styles.harvestRedText;
  } else {
    harvestText = "✓ Ready to sell";
    harvestStyle = styles.harvestGreen;
    harvestTextStyle = styles.harvestGreenText;
  }

  return {
    variety: raw.variety_identified || "Fresh produce",
    harvestText,
    harvestStyle,
    harvestTextStyle,
    shelfLife: raw.shelf_life_days
      ? `~${raw.shelf_life_days} days`
      : "Not measured",
    ripeness: aiData?.ripeness_estimate || "Peak",
    qualityNote:
      aiData?.growth_insight ||
      "Vibrant colour, firm texture, no visible defects.",
    storageTip:
      raw.storage_advice ||
      "Store in a cool, dry place away from direct sunlight.",
  };
}

const styles = StyleSheet.create({
  backdropWrap: { zIndex: 999 },
  backdropTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(20, 18, 14, 0.18)",
  },
  morphContainer: { zIndex: 1000, overflow: "hidden" },
  ribbonBand: {
    position: "absolute",
    left: 0,
    right: 0,
    overflow: "hidden",
  },
  ribbonLayerUltraSoft: {
    ...StyleSheet.absoluteFillObject,
    left: -60,
    right: -60,
    width: undefined,
  },
  ribbonLayer: {
    ...StyleSheet.absoluteFillObject,
    left: -45,
    right: -45,
    width: undefined,
  },
  ribbonLayerSharp: {
    ...StyleSheet.absoluteFillObject,
    left: -30,
    right: -30,
    top: "20%",
    bottom: "20%",
    width: undefined,
  },
  edgeLight: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.5)",
    borderRadius: MODAL_RADIUS,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
    paddingTop: spacing.lg + 4,
    zIndex: 2,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  bigDot: { width: 14, height: 14, borderRadius: 7 },
  bigScore: {
    fontSize: 28,
    fontWeight: "500",
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  aiLabel: {
    fontSize: 11,
    color: colors.textTertiary,
    letterSpacing: 0.6,
    fontWeight: "500",
    textAlign: "right",
  },
  closeButtonContainer: {},
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  closeButtonRedPulse: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(215, 95, 85, 0.7)",
    borderRadius: 14,
  },
  wordContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  word: {},
  varietyContainer: {
    marginBottom: spacing.sm,
    minHeight: 24,
  },
  variety: {
    fontSize: fonts.body,
    color: colors.textSecondary,
  },
  harvestPill: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.full,
    marginBottom: spacing.lg,
  },
  harvestGreen: { backgroundColor: "#dceee1" },
  harvestGreenText: { color: "#1f4f30" },
  harvestAmber: { backgroundColor: "#faedd3" },
  harvestAmberText: { color: "#7a5410" },
  harvestRed: { backgroundColor: "#f4d7d7" },
  harvestRedText: { color: "#7d2020" },
  harvestText: { fontSize: 12, fontWeight: "500" },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: spacing.md },
  statBox: {
    flex: 1,
    padding: 12,
    backgroundColor: "rgba(239, 159, 39, 0.08)",
    borderRadius: 10,
  },
  statLabel: {
    fontSize: 10,
    color: colors.textTertiary,
    letterSpacing: 0.5,
    fontWeight: "500",
  },
  statValue: {
    fontSize: fonts.caption,
    color: colors.textPrimary,
    fontWeight: "500",
    marginTop: 3,
  },
  qualityContainer: {
    marginBottom: spacing.md,
    minHeight: 40,
  },
  qualityNote: {
    fontSize: fonts.caption,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  storageTip: {
    padding: 12,
    backgroundColor: "rgba(239, 159, 39, 0.1)",
    borderRadius: 10,
  },
  storageTipText: { fontSize: 12, color: "#633806", lineHeight: 18 },
});
