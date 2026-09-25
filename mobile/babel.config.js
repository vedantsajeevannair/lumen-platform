module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // Reanimated 4 compiles its animation callbacks through the worklets
    // plugin. Without it every animated component throws at runtime, and it
    // must stay last in the plugin list.
    plugins: ["react-native-worklets/plugin"],
  };
};
