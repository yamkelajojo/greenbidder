// Metro configuration for GreenBidder.
//
// Adds `.tflite` to the bundleable asset extensions so the CabbageGuard
// model (src/models/cabbageguard.tflite) can be required from JS and
// shipped inside the app bundle on both dev and release builds
// (PRD §8.4).
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver = {
  ...config.resolver,
  assetExts: [...(config.resolver.assetExts || []), "tflite"],
};

module.exports = config;
