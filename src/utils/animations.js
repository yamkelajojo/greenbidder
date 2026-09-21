import { useEffect, useRef } from "react";
import { Animated } from "react-native";

/**
 * Reusable animation helpers for GreenBidder.
 *
 * All animations use React Native's built-in Animated API (no external
 * deps) and mirror the existing codebase convention: subtle, native-
 * feeling, battery-friendly. Use these instead of ad-hoc Animated.Value
 * declarations so timings and easing curves stay consistent.
 *
 * Durations are conservative — fast enough to feel responsive on a
 * mid-range Android, slow enough to not feel jarring on an AVD.
 */

/** Standard timings (ms). */
export const DURATIONS = {
  fast: 150,
  normal: 250,
  entrance: 350,
  slow: 500,
};

/**
 * useFadeIn — returns an Animated.Value that fades from 0 -> 1 on mount.
 * Optionally slides from a Y offset at the same time.
 *
 * @param {Object} [options]
 * @param {number} [options.delay=0]
 * @param {number} [options.duration=DURATIONS.entrance]
 * @param {number} [options.translateY=0] - Upward slide distance (positive = moves up)
 * @param {boolean} [options.start=true] - Set false to trigger manually via `start()`
 * @returns {{ opacity: Animated.Value, translateY: Animated.Value, restart: () => void }}
 */
export function useFadeIn({
  delay = 0,
  duration = DURATIONS.entrance,
  translateY = 0,
  start = true,
} = {}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(translateY)).current;

  const animate = () => {
    opacity.setValue(0);
    ty.setValue(translateY);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
      }),
      translateY
        ? Animated.timing(ty, {
            toValue: 0,
            duration,
            delay,
            useNativeDriver: true,
          })
        : Animated.delay(0),
    ]).start();
  };

  useEffect(() => {
    if (start) animate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start]);

  return { opacity, translateY: ty, restart: animate };
}

/**
 * usePulse — creates a looping pulse animation (scale up/down).
 * Useful for empty-state mascots/inviting CTAs.
 *
 * @param {Object} [options]
 * @param {number} [options.minScale=0.95]
 * @param {number} [options.maxScale=1.05]
 * @param {number} [options.duration=1400]
 * @returns {Animated.Value} Animated scale value
 */
export function usePulse({
  minScale = 0.96,
  maxScale = 1.04,
  duration = 1600,
} = {}) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.sequence([
      Animated.timing(scale, {
        toValue: maxScale,
        duration: duration / 2,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: minScale,
        duration: duration / 2,
        useNativeDriver: true,
      }),
    ]);
    const loop = Animated.loop(pulse);
    loop.start();
    return () => loop.stop();
  }, [scale, minScale, maxScale, duration]);

  return scale;
}

/**
 * useProgress — animates a number from 0 -> targetValue.
 * Returns an Animated.Value driven by a simple timing.
 * Used for confidence bars / progress indicators.
 *
 * @param {number} targetValue - 0..1 target
 * @param {Object} [options]
 * @param {number} [options.duration=DURATIONS.slow]
 * @param {number} [options.delay=DURATIONS.fast]
 * @returns {Animated.Value}
 */
export function useProgress(
  targetValue,
  { duration = DURATIONS.slow, delay = DURATIONS.fast } = {}
) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    const t = Animated.timing(progress, {
      toValue: targetValue,
      duration,
      delay,
      useNativeDriver: false, // need width interpolation which doesn't support native
    });
    t.start();
    return () => t.stop();
  }, [targetValue, duration, delay, progress]);

  return progress;
}

/**
 * useStagger — returns helpers for staggering multiple animatable items.
 * Returns `buildStyle(i)` which produces { opacity, translateY } for the
 * i-th staggered item (used for top-K predictions, tip rows, etc.).
 */
export function useStaggerEntrance({ count, delay = 100, stagger = 80, duration = 300, translateY = 8 } = {}) {
  const itemsRef = useRef(null);
  if (!itemsRef.current) {
    itemsRef.current = Array.from({ length: Math.max(count, 1) }, () => ({
      opacity: new Animated.Value(0),
      ty: new Animated.Value(translateY),
    }));
  }

  useEffect(() => {
    const items = itemsRef.current;
    items.forEach((it) => {
      it.opacity.setValue(0);
      it.ty.setValue(translateY);
    });
    Animated.stagger(
      stagger,
      items.map((it, i) =>
        Animated.parallel([
          Animated.timing(it.opacity, {
            toValue: 1,
            duration,
            delay: i === 0 ? delay : 0,
            useNativeDriver: true,
          }),
          Animated.timing(it.ty, {
            toValue: 0,
            duration,
            delay: i === 0 ? delay : 0,
            useNativeDriver: true,
          }),
        ])
      )
    ).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  const buildStyle = (i) => {
    const it = itemsRef.current[i] || itemsRef.current[0];
    return {
      opacity: it.opacity,
      transform: [{ translateY: it.ty }],
    };
  };

  return { buildStyle };
}
