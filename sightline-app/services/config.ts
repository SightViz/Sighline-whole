import { Platform } from "react-native";

/**
 * Service Configuration
 * Central place to configure API endpoints and settings
 */

/**
 * Get the base URL based on platform
 * - Android emulator: 10.0.2.2 (maps to host localhost)
 * - iOS simulator: localhost (works directly)
 * - Physical device: Use your computer's IP address
 */
const getBaseURL = (): string => {
  if (Platform.OS === "android") {
    // Android emulator uses 10.0.2.2 to reach host machine
    return "http://192.168.10.102:6969";
  } else if (Platform.OS === "ios") {
    // iOS simulator can use localhost directly
    return "http://192.168.10.102:6969";
  } else {
    // For physical devices, you'll need to set your computer's IP
    // Example: "http://192.168.1.100:6969"
    return "http://192.168.10.102:6969";
  }
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
