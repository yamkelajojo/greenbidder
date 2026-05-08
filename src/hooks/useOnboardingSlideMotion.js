import { useMemo } from "react";
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolate,
} from "react-native-reanimated";
import { springs } from "../config/theme";

const PHASE_OFF = 0;
const PHASE_ON = 1;

// Enter/exit timing relationship:
// Exit should feel faster than enter (~60-70%).
export const onboardingMotionSpec = {
  enterSpring: springs.gentle,
  exitSpring: { ...springs.snappy, damping: 24 },
  phaseOffsets: {
    image: 0.0,
    badge: 0.08,
    title: 0.16,
    subtitle: 0.24,
  },
};

export default function useOnboardingSlideMotion({ slideCount, screenWidth }) {
  const pagerOffsetX = useSharedValue(0);
  const activeIndex = useSharedValue(0);
  const phaseProgress = Array.from({ length: slideCount }).map(() =>
    useSharedValue(0),
  );

  const bindPagerScroll = (e) => {
    const { position = 0, offset = 0 } = e.nativeEvent || {};
    pagerOffsetX.value = (position + offset) * screenWidth;
  };

  const activateSlide = (index) => {
    activeIndex.value = index;

    for (let i = 0; i < slideCount; i += 1) {
      if (i === index) {
        phaseProgress[i].value = PHASE_OFF;
        phaseProgress[i].value = withSpring(PHASE_ON, onboardingMotionSpec.enterSpring);
      } else {
        phaseProgress[i].value = withSpring(PHASE_OFF, onboardingMotionSpec.exitSpring);
      }
    }
  };

  const getSlideStyles = (index) => {
    const imageStyle = useAnimatedStyle(() => {
      const center = index * screenWidth;
      const translateX = interpolate(
        pagerOffsetX.value,
        [center - screenWidth, center, center + screenWidth],
        [-screenWidth * 0.12, 0, screenWidth * 0.12],
        Extrapolate.CLAMP,
      );
      const scale = interpolate(
        pagerOffsetX.value,
        [center - screenWidth, center, center + screenWidth],
        [0.94, 1, 0.94],
        Extrapolate.CLAMP,
      );
      const phase = phaseProgress[index].value;
      return {
        opacity: interpolate(
          phase,
          [onboardingMotionSpec.phaseOffsets.image, 1],
          [0, 1],
          Extrapolate.CLAMP,
        ),
        transform: [{ translateX }, { scale }],
      };
    });

    const badgeStyle = useAnimatedStyle(() => {
      const phase = phaseProgress[index].value;
      return {
        opacity: interpolate(
          phase,
          [onboardingMotionSpec.phaseOffsets.badge, 1],
          [0, 1],
          Extrapolate.CLAMP,
        ),
        transform: [
          {
            translateY: interpolate(
              phase,
              [onboardingMotionSpec.phaseOffsets.badge, 1],
              [14, 0],
              Extrapolate.CLAMP,
            ),
          },
        ],
      };
    });

    const titleStyle = useAnimatedStyle(() => {
      const phase = phaseProgress[index].value;
      return {
        opacity: interpolate(
          phase,
          [onboardingMotionSpec.phaseOffsets.title, 1],
          [0, 1],
          Extrapolate.CLAMP,
        ),
        transform: [
          {
            translateY: interpolate(
              phase,
              [onboardingMotionSpec.phaseOffsets.title, 1],
              [18, 0],
              Extrapolate.CLAMP,
            ),
          },
        ],
      };
    });

    const subtitleStyle = useAnimatedStyle(() => {
      const phase = phaseProgress[index].value;
      return {
        opacity: interpolate(
          phase,
          [onboardingMotionSpec.phaseOffsets.subtitle, 1],
          [0, 1],
          Extrapolate.CLAMP,
        ),
        transform: [
          {
            translateY: interpolate(
              phase,
              [onboardingMotionSpec.phaseOffsets.subtitle, 1],
              [12, 0],
              Extrapolate.CLAMP,
            ),
          },
        ],
      };
    });

    return { imageStyle, badgeStyle, titleStyle, subtitleStyle };
  };

  const getProgressStyles = useMemo(
    () => () => ({
      activeIndex,
      slideCount,
    }),
    [slideCount],
  );

  return {
    bindPagerScroll,
    activateSlide,
    getSlideStyles,
    getProgressStyles,
  };
}
