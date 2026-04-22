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
  // Try multiple sources for API_URL (needed for production builds)
  let apiUrl =
    Constants.expoConfig?.extra?.API_URL ||
    Constants.manifest2?.extra?.expoClient?.extra?.API_URL ||
    "https://sightviz.fabxdev.me"; // Hardcoded fallback

  return apiUrl;
};

/**
 * API Configuration
 */
export const API_CONFIG = {
  BASE_URL: getBaseURL(),

  ENDPOINTS: {
    DETECT: "/detect",
    ANALYZE: "/analyze",
    FACES_ENROLL: "/faces/enroll",
    FACES_LIST: "/faces/list",
    FACES_DELETE: (name: string) => `/faces/${encodeURIComponent(name)}`,
    OCR: "/ocr",
    OCR_CHAT: "/ocr/chat",
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

export const getAnalyzeEndpoint = (): string => {
  return `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ANALYZE}`;
};

export const getFacesEnrollEndpoint = (): string => {
  return `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.FACES_ENROLL}`;
};

export const getFacesListEndpoint = (): string => {
  return `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.FACES_LIST}`;
};

export const getFacesDeleteEndpoint = (name: string): string => {
  return `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.FACES_DELETE(name)}`;
};

export const getOCREndpoint = (): string => {
  return `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.OCR}`;
};

export const getOCRChatEndpoint = (): string => {
  return `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.OCR_CHAT}`;
};
