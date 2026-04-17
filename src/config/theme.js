import { Platform } from "react-native";

/**
 * ═══════════════════════════════════════════════════════════════════════
 *   GREENBIDDER — DESIGN TOKENS
 *
 *   Single source of visual truth. Inspired by Swiss design principles
 *   (grid, typography, restraint) and Apple's material sensibility
 *   (physics, depth, craft). Every component in the app references this
 *   file. Never hardcode colors, spacing, or font sizes in components.
 *
 *   Principles:
 *   ─ Grid: everything aligns to 4px, usually 8px.
 *   ─ Restraint: fewer tokens used well beats many tokens used poorly.
 *   ─ Purpose: every token has a job. No "just in case" values.
 *   ─ Hierarchy: weight and size differences are pronounced, not subtle.
 * ═══════════════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────────────────────────
//   COLOR — palette primitives
// ─────────────────────────────────────────────────────────────────────────

/**
 * Raw palette. Never use these directly in components — use semantic
 * names below. If we ever dark-theme the app, only the semantic map
 * changes. The palette stays.
 */
const palette = {
  // ── Greens: the soul of the brand ──
  // Warm, alive, agricultural. Not a generic tech-green.
  green50: "#F1F8F2",
  green100: "#DCEEE1",
  green200: "#B8DDC3",
  green300: "#8CC79F",
  green400: "#5FA876",
  green500: "#3D8A55", // primary
  green600: "#2D6A41", // primary dark
  green700: "#1F4F30",
  green800: "#123320",
  green900: "#091811",

  // ── Warm neutrals: our paper ──
  // Not cold greys. Every surface carries a hint of warmth.
  paper50: "#FCFBF8", // background
  paper100: "#F7F5F0", // surface secondary
  paper200: "#EFEDE6", // surface tertiary / chips
  paper300: "#D9D5CA", // hairline borders
  paper400: "#A8A398", // disabled / placeholders
  paper500: "#78736A", // tertiary text
  paper600: "#57534A", // secondary text
  paper700: "#3A3732", // body text
  paper800: "#25231F", // headings
  paper900: "#14130F", // max contrast

  // ── Amber: AI and premium moments ──
  // Warm counterpoint to green. Used sparingly — only for AI-related UI.
  amber50: "#FEF8EC",
  amber100: "#FCEECB",
  amber200: "#F8DD8F",
  amber400: "#E8A820",
  amber500: "#C68712",
  amber700: "#7A4F09",

  // ── Signals: feedback states ──
  red50: "#FEF2F2",
  red100: "#FEE2E2",
  red400: "#F87171",
  red500: "#DC2626",
  red700: "#991B1B",

  blue50: "#EEF6FB",
  blue500: "#2976A8",
  blue700: "#1A4E72",

  white: "#FFFFFF",
  black: "#000000",
  transparent: "transparent",
};

/**
 * Semantic colors — named by purpose, not appearance.
 * Components ask for `colors.textPrimary`, get the right value.
 */
export const colors = {
  // ── Surfaces ──
  background: palette.paper50,
  surface: palette.white,
  surfaceSecondary: palette.paper100,
  surfaceTertiary: palette.paper200,

  // ── Brand ──
  primary: palette.green500,
  primaryDark: palette.green600,
  primaryLight: palette.green100,
  primarySubtle: palette.green50,
  onPrimary: palette.white,

  // ── Text ──
  textPrimary: palette.paper800,
  textBody: palette.paper700,
  textSecondary: palette.paper600,
  textTertiary: palette.paper500,
  textDisabled: palette.paper400,
  textOnDark: palette.paper50,

  // ── Borders ──
  border: palette.paper300,
  borderLight: palette.paper200,
  borderStrong: palette.paper400,

  // ── AI / premium ──
  aiBadge: palette.amber500,
  aiBadgeLight: palette.amber100,
  aiBadgeSubtle: palette.amber50,
  aiBadgeDark: palette.amber700,

  // ── Signals ──
  success: palette.green500,
  successLight: palette.green50,
  warning: palette.amber400,
  warningLight: palette.amber50,
  danger: palette.red500,
  dangerLight: palette.red50,
  info: palette.blue500,
  infoLight: palette.blue50,

  // ── Legacy aliases for not-yet-migrated screens ──
  backgroundSecondary: palette.paper100,
  backgroundTertiary: palette.paper200,
  priceUp: palette.green500,
  priceDown: palette.red500,
  priceStable: palette.paper500,
  accent: palette.amber500,

  // ── Escape hatch for advanced use ──
  palette,
};

/**
 * Gradients — used for premium moments, not decoration.
 * Always pass these to LinearGradient from expo-linear-gradient.
 */
export const gradients = {
  primary: [palette.green500, palette.green600],
  primarySoft: [palette.green50, palette.paper50],
  sunrise: [palette.paper50, palette.amber50, palette.green50],
  ai: [palette.amber50, palette.paper50],
  aiAccent: [palette.amber400, palette.amber500],
};

// ─────────────────────────────────────────────────────────────────────────
//   TYPOGRAPHY — type scale and weights
// ─────────────────────────────────────────────────────────────────────────

/**
 * Font family.
 *   iOS  → SF Pro (system) — free, beautiful, no ship weight.
 *   Android → Roboto (system) — clean, reliable.
 * Swap to Inter or Fraunces later for signature, no component changes needed.
 */
export const fontFamily = {
  sans: Platform.select({
    ios: "System",
    android: "Roboto",
    default: "System",
  }),
  mono: Platform.select({
    ios: "Menlo",
    android: "monospace",
    default: "monospace",
  }),
};

/**
 * Type scale — modular, every step visibly distinct.
 * Swiss principle: size does the work, not color or weight tricks.
 */
export const typeScale = {
  display: 40, // hero — welcome, big moments
  h1: 32, // screen titles
  h2: 26, // section headers
  h3: 20, // card titles
  body: 16, // default body text
  caption: 14, // supporting copy
  small: 12, // labels, captions
  micro: 10, // tiny badges
};

/**
 * Line heights, expressed as pixel values (multiply by fontSize for em).
 * Tighter for display, looser for body. Not literal — feel based.
 */
export const lineHeights = {
  display: 44,
  h1: 38,
  h2: 32,
  h3: 26,
  body: 24,
  caption: 20,
  small: 16,
  micro: 14,
};

/**
 * Weight system — deliberate two-weight hierarchy.
 *   400 regular for body.
 *   700 bold for emphasis and headings.
 *   500 and 600 reserved for specific UI needs (buttons).
 * Avoid 500-600 mid-weights for text — they read as "meh."
 */
export const fontWeight = {
  regular: "400",
  medium: "500", // buttons, emphasised labels
  semibold: "600", // rare, for specific emphasis
  bold: "700", // headings, strong emphasis
  heavy: "800", // display only
};

/**
 * Pre-composed text styles — what components actually use.
 * Each style bundles size, line-height, weight, and sometimes letter-spacing.
 * New screens reference these directly, so hierarchy is consistent everywhere.
 */
export const text = {
  display: {
    fontFamily: fontFamily.sans,
    fontSize: typeScale.display,
    lineHeight: lineHeights.display,
    fontWeight: fontWeight.heavy,
    letterSpacing: -0.8,
    color: colors.textPrimary,
  },
  h1: {
    fontFamily: fontFamily.sans,
    fontSize: typeScale.h1,
    lineHeight: lineHeights.h1,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.5,
    color: colors.textPrimary,
  },
  h2: {
    fontFamily: fontFamily.sans,
    fontSize: typeScale.h2,
    lineHeight: lineHeights.h2,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.3,
    color: colors.textPrimary,
  },
  h3: {
    fontFamily: fontFamily.sans,
    fontSize: typeScale.h3,
    lineHeight: lineHeights.h3,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.2,
    color: colors.textPrimary,
  },
  body: {
    fontFamily: fontFamily.sans,
    fontSize: typeScale.body,
    lineHeight: lineHeights.body,
    fontWeight: fontWeight.regular,
    color: colors.textBody,
  },
  bodyEmphasis: {
    fontFamily: fontFamily.sans,
    fontSize: typeScale.body,
    lineHeight: lineHeights.body,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  caption: {
    fontFamily: fontFamily.sans,
    fontSize: typeScale.caption,
    lineHeight: lineHeights.caption,
    fontWeight: fontWeight.regular,
    color: colors.textSecondary,
  },
  small: {
    fontFamily: fontFamily.sans,
    fontSize: typeScale.small,
    lineHeight: lineHeights.small,
    fontWeight: fontWeight.regular,
    color: colors.textTertiary,
  },
  label: {
    fontFamily: fontFamily.sans,
    fontSize: typeScale.small,
    lineHeight: lineHeights.small,
    fontWeight: fontWeight.medium,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.textTertiary,
  },
  button: {
    fontFamily: fontFamily.sans,
    fontSize: typeScale.body,
    lineHeight: typeScale.body,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.1,
  },
  // Numeric — uses tabular figures where available.
  // Important for prices where digits should align visually.
  numeric: {
    fontFamily: fontFamily.sans,
    fontVariant: ["tabular-nums"],
    fontWeight: fontWeight.bold,
  },
};

// ─────────────────────────────────────────────────────────────────────────
//   SPACING — 4/8 grid system
// ─────────────────────────────────────────────────────────────────────────

/**
 * Spacing scale — geometric progression aligned to 4px.
 * Everything in the app uses these. No arbitrary margins.
 *
 *   Rule of thumb:
 *   xs, sm  → inside components (button padding, chip gaps)
 *   md      → between related elements (label → input)
 *   lg      → between groups (card → card)
 *   xl, 2xl → between sections
 *   3xl+    → hero spacing (welcome screens)
 */
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
  display: 96,
};

// ─────────────────────────────────────────────────────────────────────────
//   RADIUS — corner treatment
// ─────────────────────────────────────────────────────────────────────────

/**
 * Corners communicate character. Too sharp = clinical. Too round = toy-like.
 * We use a precise scale, applied consistently.
 *
 *   xs → input fields, hairline elements
 *   sm → chips, small pills
 *   md → cards (the most common)
 *   lg → large cards, modals
 *   xl → hero cards, sheets
 *   full → pills, avatars, round buttons
 */
export const radius = {
  none: 0,
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  xxl: 36,
  full: 9999,
};

// ─────────────────────────────────────────────────────────────────────────
//   SHADOWS — depth and hierarchy
// ─────────────────────────────────────────────────────────────────────────

/**
 * Shadow system — four levels of elevation.
 * Spread over iOS + Android consistently.
 *
 *   resting     → flat on surface (subtle hint of separation)
 *   raised      → cards at rest (default for interactive elements)
 *   floating    → elements lifting on interaction (hover/press)
 *   overlay     → modals, sheets (significant elevation)
 *   hero        → key moments (dramatic)
 *
 * Each level defines iOS shadow props + Android elevation.
 * Apply via spread: `...shadows.raised`.
 */
export const shadows = {
  resting: {
    shadowColor: palette.paper900,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  raised: {
    shadowColor: palette.paper900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  floating: {
    shadowColor: palette.paper900,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 8,
  },
  overlay: {
    shadowColor: palette.paper900,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 28,
    elevation: 16,
  },
  hero: {
    shadowColor: palette.green700,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.18,
    shadowRadius: 48,
    elevation: 24,
  },
};

// ─────────────────────────────────────────────────────────────────────────
//   MOTION — spring physics specs
// ─────────────────────────────────────────────────────────────────────────

/**
 * Spring configurations — every animation in the app uses one of these.
 * Reanimated 3 consumes these directly: `withSpring(target, springs.gentle)`.
 *
 *   gentle   → subtle entrances, state changes (most common)
 *   standard → buttons, cards (default tactile feel)
 *   snappy   → quick, confident responses (toggle, check)
 *   bouncy   → playful moments (success, arrival) — use sparingly
 *   slow     → large elements, hero animations
 *   press    → compression on touch (critical — this IS the tactility)
 *
 * Principles:
 *   damping controls oscillation (higher = less bounce)
 *   stiffness controls speed (higher = snappier)
 *   mass controls weight (higher = slower to start, harder to stop)
 */
export const springs = {
  gentle: {
    damping: 20,
    stiffness: 120,
    mass: 1,
  },
  standard: {
    damping: 18,
    stiffness: 180,
    mass: 1,
  },
  snappy: {
    damping: 22,
    stiffness: 260,
    mass: 0.9,
  },
  bouncy: {
    damping: 12,
    stiffness: 180,
    mass: 1,
  },
  slow: {
    damping: 25,
    stiffness: 80,
    mass: 1.2,
  },
  press: {
    damping: 25,
    stiffness: 350,
    mass: 0.6,
  },
};

/**
 * Timing durations — for cases where we use timing instead of spring
 * (rare: only fade-outs, crossfades, screen transitions).
 */
export const durations = {
  instant: 100, // micro feedback
  fast: 180, // quick state change
  standard: 260, // default transition
  slow: 420, // larger movements
  hero: 680, // dramatic entrance
};

/**
 * Stagger intervals — when animating groups of elements,
 * delay each subsequent element by this much.
 * Creates the "ripple" effect of elements arriving one by one.
 */
export const stagger = {
  tight: 40,
  standard: 70,
  loose: 120,
};

// ─────────────────────────────────────────────────────────────────────────
//   LAYOUT — consistent sizing
// ─────────────────────────────────────────────────────────────────────────

export const layout = {
  // Hit targets — Apple HIG minimum is 44, Material is 48
  minTouchTarget: 44,

  // Content widths — where we constrain reading width
  maxContentWidth: 520,

  // Common component heights
  button: 52,
  buttonSmall: 40,
  input: 52,
  tabBar: 64,

  // Screen edges — how far content sits from the edge of the phone
  screenPadding: spacing.lg,
};

// ─────────────────────────────────────────────────────────────────────────
//   LEGACY EXPORT — backwards compatibility
// ─────────────────────────────────────────────────────────────────────────

/**
 * Old `fonts` export kept for screens still referencing `fonts.h1` etc.
 * New screens should use `text.h1` (the pre-composed style).
 * Delete this block once all screens are migrated.
 */
export const fonts = {
  h1: typeScale.h1,
  h2: typeScale.h2,
  h3: typeScale.h3,
  body: typeScale.body,
  caption: typeScale.caption,
  small: typeScale.small,
};
