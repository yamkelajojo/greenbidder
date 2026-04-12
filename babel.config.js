module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "@tamagui/babel-plugin",
        {
          components: ["tamagui"],
          config: "./src/config/tamagui.config.js",
          logTimings: true,
          disableExtraction: true,
        },
      ],
    ],
  };
};
