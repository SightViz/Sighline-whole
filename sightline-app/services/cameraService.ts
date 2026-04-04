/**
 * Camera Service
 * Handles camera permissions, initialization, and frame capture
 */

import { CameraView, useCameraPermissions } from "expo-camera";
import { RefObject } from "react";

export interface CameraFrame {
  uri: string;
  base64?: string;
  width: number;
  height: number;
  timestamp: number;
}

/**
 * Request camera permissions from the user
 */
export const requestCameraPermission = async (): Promise<boolean> => {
  // This will be handled by the useCameraPermissions hook
  return true;
};

/**
 * Capture a single frame from the camera
 * @param cameraRef - Reference to the CameraView component
 * @returns Promise with the captured frame data or null if failed
 */
export const captureFrame = async (
  cameraRef: RefObject<CameraView>
): Promise<CameraFrame | null> => {
  try {
    if (!cameraRef.current) {
      console.warn("Camera reference not available");
      return null;
    }

    // Take a picture with low quality for faster processing
    const photo = await cameraRef.current.takePictureAsync({
      quality: 0.3, // Low quality for faster capture and smaller size
      base64: true, // Include base64 for easy API transmission
      skipProcessing: true, // Skip extra processing for speed
    });

    if (!photo) {
      return null;
    }

    return {
      uri: photo.uri,
      base64: photo.base64,
      width: photo.width,
      height: photo.height,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("Error capturing frame:", error);
    return null;
  }
};

/**
 * Start continuous frame capture
 * @param cameraRef - Reference to the CameraView component
 * @param onFrameCaptured - Callback when a frame is captured
 * @param intervalMs - Interval between captures in milliseconds (default: 1000ms = 1 frame/sec)
 * @returns Cleanup function to stop capture
 */
export const startFrameCapture = (
  cameraRef: RefObject<CameraView>,
  onFrameCaptured: (frame: CameraFrame) => void,
  intervalMs: number = 1000
): (() => void) => {
  let isCapturing = true;

  const captureLoop = async () => {
    while (isCapturing) {
      const frame = await captureFrame(cameraRef);
      if (frame && isCapturing) {
        onFrameCaptured(frame);
      }
      // Wait for the specified interval before next capture
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  };

  // Start the capture loop
  captureLoop();

  // Return cleanup function
  return () => {
    isCapturing = false;
  };
};

/**
 * Hook export for camera permissions
 */
export { useCameraPermissions };
