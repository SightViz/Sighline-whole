const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Note: Model files are now handled server-side
// No custom asset extensions needed for production

module.exports = config;
