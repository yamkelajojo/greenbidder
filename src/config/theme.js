/**
 * GreenBidder Design Tokens
 * Centralised visual values — Criterion 1 (Design Tokens).
 * Every colour, spacing, and radius value used in the app is defined here.
 * Components import from this file — never hardcode hex values.
 */

export const colors = {
  // Brand
  primary: "#2D6A4F",
  primaryLight: "#D8F3DC",
  primaryDark: "#1B4332",

  // Semantic
  success: "#40916C",
  warning: "#E9C46A",
  danger: "#E76F51",
  info: "#457B9D",

  // Neutrals
  background: "#FFFFFF",
  backgroundSecondary: "#F8F9FA",
  backgroundTertiary: "#F1F3F5",
  textPrimary: "#212529",
  textSecondary: "#6C757D",
  textTertiary: "#ADB5BD",
  border: "#DEE2E6",
  borderLight: "#E9ECEF",

  // AI feature
  aiBadge: "#7209B7",
  aiBadgeLight: "#E8D5F5",

  // Market prices
  priceUp: "#40916C",
  priceDown: "#E76F51",
  priceStable: "#6C757D",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const fonts = {
  small: 12,
  caption: 14,
  body: 16,
  h3: 18,
  h2: 22,
  h1: 28,
};
