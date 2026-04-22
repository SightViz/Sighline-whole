const baseConfig = require("./app.base.json");

module.exports = () => {
  const API_URL = process.env.API_URL || "https://sightviz.fabxdev.me";
  const GPT_API_KEY = process.env.GPT_API_KEY || "";

  return {
    ...baseConfig,
    expo: {
      ...baseConfig.expo,
      extra: {
        ...baseConfig.expo.extra,
        API_URL,
        GPT_API_KEY,
      },
    },
  };
};
