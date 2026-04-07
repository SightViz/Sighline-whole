/**
 * Camera Service
 * Handles camera permissions, initialization, and frame capture
 */

import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
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

    // Take a picture at moderate quality
    const photo = await cameraRef.current.takePictureAsync({
      quality: 0.7, // Good quality for the initial capture
      base64: false,
      skipProcessing: true,
    });

    if (!photo) {
      return null;
    }

    // Resize the image to reduce payload size while maintaining quality
    // Target: 1024px width max (maintains aspect ratio)
    const resized = await ImageManipulator.manipulateAsync(
      photo.uri,
      [{ resize: { width: 1024 } }], // Resize to max 1024px width
      {
        compress: 0.7, // JPEG compression quality
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true, // Include base64 for API transmission
      }
    );

    return {
      uri: resized.uri,
      base64: resized.base64,
      width: resized.width,
      height: resized.height,
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
