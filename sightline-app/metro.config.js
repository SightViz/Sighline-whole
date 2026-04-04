const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Add support for model files
config.resolver.assetExts.push("onnx", "bin", "tflite");

module.exports = config;
