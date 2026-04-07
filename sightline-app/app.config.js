const baseConfig = require('./app.base.json');

module.exports = () => {
  // Read API_URL from environment variable (set by eas.json during build)
  const API_URL = process.env.API_URL || 'https://sightviz.fabxdev.me';
  
  console.log('=================================');
  console.log('EAS Build Configuration');
  console.log('API_URL:', API_URL);
  console.log('Environment:', process.env.NODE_ENV);
  console.log('=================================');

  return {
    ...baseConfig,
    expo: {
      ...baseConfig.expo,
      extra: {
        ...baseConfig.expo.extra,
        // Override API_URL with environment variable or fallback
        API_URL: API_URL,
      },
    },
  };
};
