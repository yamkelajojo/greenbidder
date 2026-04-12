import { createTamagui } from "tamagui";
import { config as defaultConfig } from "@tamagui/config/v3";

/**
 * GreenBidder Design Tokens
 * Centralised visual values — Criterion 1 (Design Tokens)
 * Every colour, spacing, and radius value used in the app is defined here.
 * Components reference tokens via $color.primary, $space.md, etc.
 * Changing a value here updates the entire app instantly.
 */

const config = createTamagui({
  ...defaultConfig,
  tokens: {
    ...defaultConfig.tokens,
    color: {
      ...defaultConfig.tokens.color,

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

      // AI
      aiBadge: "#7209B7",
      aiBadgeLight: "#E8D5F5",

      // Market
      priceUp: "#40916C",
      priceDown: "#E76F51",
      priceStable: "#6C757D",
    },
  },
});

export default config;

// export type AppConfig = typeof config;

// declare module "tamagui" {
//   interface TamaguiCustomConfig extends AppConfig {}
// }
