/**
 * Camera Component
 * Displays camera view when scanning is active
 */

import { CameraView } from "expo-camera";
import React, { forwardRef } from "react";
import { StyleSheet, View } from "react-native";

interface CameraComponentProps {
  isActive: boolean;
}

export const CameraComponent = forwardRef<CameraView, CameraComponentProps>(
  ({ isActive }, ref) => {
    if (!isActive) {
      return null;
    }

    return (
      <View style={styles.cameraContainer}>
        <CameraView
          ref={ref}
          style={styles.camera}
          facing="back"
          // Disable audio since we only need photos
          enableTorch={false}
        />
      </View>
    );
  }
);

CameraComponent.displayName = "CameraComponent";

const styles = StyleSheet.create({
  cameraContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1, // Behind UI elements
  },
  camera: {
    flex: 1,
  },
});
