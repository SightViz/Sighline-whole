const { getDefaultConfig } = require("expo/metro-config");
const { mergeConfig } = require("metro-config");

const config = getDefaultConfig(__dirname);

const { transformer, resolver } = config;

config.transformer = {
  ...transformer,
  babelTransformerPath: require.resolve("react-native-svg-transformer"),
};

config.resolver = {
  ...resolver,
  assetExts: resolver.assetExts.filter((ext) => ext !== "svg"),
  sourceExts: [...resolver.sourceExts, "svg"],
  // Required for packages that use package.json "exports" sub-path imports
  // (e.g. zod/v4 used by @ai-sdk/openai)
  unstable_enablePackageExports: true,
};

module.exports = config;
