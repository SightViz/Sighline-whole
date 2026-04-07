import Constants from "expo-constants";

/**
 * Service Configuration
 * Central place to configure API endpoints and settings
 */

/**
 * Get the base URL from environment variables
 * Falls back to production server if not configured
 */
const getBaseURL = (): string => {
  console.log("[SightViz Config] Loading API URL...");
  console.log("[SightViz Config] Constants.expoConfig:", Constants.expoConfig);
  console.log("[SightViz Config] Constants.manifest:", Constants.manifest);
  console.log("[SightViz Config] Constants.manifest2:", Constants.manifest2);
  
  // Try multiple sources for API_URL (needed for production builds)
  let apiUrl = 
    Constants.expoConfig?.extra?.API_URL ||
    Constants.manifest2?.extra?.expoClient?.extra?.API_URL ||
    "https://sightviz.fabxdev.me"; // Hardcoded fallback
  
  console.log("[SightViz Config] Resolved API URL:", apiUrl);
  return apiUrl;
};

/**
 * API Configuration
 */
export const API_CONFIG = {
  BASE_URL: getBaseURL(),
  
  ENDPOINTS: {
    DETECT: "/detect",
  },
  
  // Request timeouts (ms)
  TIMEOUT: 10000,
  
  // Retry configuration
  MAX_RETRIES: 2,
  RETRY_DELAY: 1000,
};

/**
 * Get the full detection endpoint URL
 */
export const getDetectionEndpoint = (): string => {
  return `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.DETECT}`;
};

/**
 * Check if running on Android emulator
 * Android emulator uses 10.0.2.2 to reach localhost on the host machine
 */
export const getAPIBaseURL = (): string => {
  // You can add platform detection here if needed
  return API_CONFIG.BASE_URL;
};
