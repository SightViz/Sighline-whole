import { CameraView, useCameraPermissions } from "expo-camera";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

let loadTensorflowModel: typeof import("react-native-fast-tflite").loadTensorflowModel;
let TFLiteAvailable = false;
try {
  // react-native-fast-tflite requires a native build — not available in Expo Go
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const tflite = require("react-native-fast-tflite");
  loadTensorflowModel = tflite.loadTensorflowModel;
  TFLiteAvailable = true;
} catch {
  TFLiteAvailable = false;
}

interface Detection {
  label: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
}

export default function V3TFLite() {
  const [permission, requestPermission] = useCameraPermissions();
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [detections] = useState<Detection[]>([]);
  const [model, setModel] = useState<{
    inputs: { shape: number[] }[];
    runSync: (input: Float32Array[]) => { length: number }[];
  } | null>(null);

  const cameraRef = useRef<CameraView>(null);
  const processingRef = useRef(false);

  const log = useCallback((msg: string) => {
    console.log(msg);
    setLogs((l) => [...l.slice(-20), msg]);
  }, []);

  /* -------------------- LOAD MODEL -------------------- */

  const loadModel = useCallback(async () => {
    try {
      setIsLoading(true);

      if (!TFLiteAvailable) {
        log(
          "[WARNING] react-native-fast-tflite unavailable (Expo Go does not support native modules).",
        );
        log("Build a development build with: npx expo run:android");
        return;
      }

      log("Loading TFLite model...");

      // Load the .tflite model from assets
      // NOTE: Place your .tflite model at assets/models/yolo.tflite
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const modelAsset = require("../../assets/models/yolo.tflite");

      log("Model asset loaded, initializing TFLite...");
      const loadedModel = await loadTensorflowModel(modelAsset, "default");

      log("[SUCCESS] TFLite model loaded successfully!");
      log(`Inputs: ${JSON.stringify(loadedModel.inputs)}`);
      log(`Outputs: ${JSON.stringify(loadedModel.outputs)}`);

      setModel(loadedModel);
    } catch (err) {
      log(`[ERROR] Model load error: ${err}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [log]);

  useEffect(() => {
    loadModel();
  }, [loadModel]);

  /* -------------------- INFERENCE -------------------- */

  const runInference = useCallback(async () => {
    if (!model || !cameraRef.current || processingRef.current) return;

    processingRef.current = true;

    try {
      log("Capturing image...");
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5,
        base64: true,
        skipProcessing: true,
      });

      if (!photo?.base64) {
        log("No photo captured");
        processingRef.current = false;
        return;
      }

      log("Running TFLite inference...");

      // TODO: Preprocess image to match model input shape
      // For YOLO, typically need to:
      // 1. Resize to 640x640 (or model's expected input size)
      // 2. Normalize to 0-1 or -1 to 1
      // 3. Convert to Float32Array

      // Placeholder - you'll need to implement actual preprocessing
      const inputShape: number[] = model.inputs[0]?.shape ?? [1, 640, 640, 3];
      const inputSize = inputShape.reduce((a: number, b: number) => a * b, 1);
      const inputData = new Float32Array(inputSize);

      // Run model
      const outputs = model.runSync([inputData]);

      log(`Output shapes: ${outputs.map((o: { length: number }) => o.length)}`);

      // TODO: Parse YOLO output
      // parseYoloOutput(outputs, COCO_LABELS, setDetections);
    } catch (err) {
      log(`[ERROR] Inference error: ${err}`);
      console.error(err);
    } finally {
      processingRef.current = false;
    }
  }, [model, log]);

  /* -------------------- DETECTION LOOP -------------------- */

  useEffect(() => {
    if (!isRunning || !model) return;

    const interval = setInterval(() => {
      runInference();
    }, 3000);

    return () => clearInterval(interval);
  }, [isRunning, model, runInference]);

  /* -------------------- RENDER -------------------- */

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#5B9BD5" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Camera permission required</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera Preview */}
      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back" />

        {/* Detection Overlay */}
        {detections.map((det, i) => (
          <View
            key={i}
            style={[
              styles.bbox,
              {
                left: `${det.bbox.x * 100}%`,
                top: `${det.bbox.y * 100}%`,
                width: `${det.bbox.width * 100}%`,
                height: `${det.bbox.height * 100}%`,
              },
            ]}
          >
            <Text style={styles.bboxLabel}>
              {det.label} ({(det.confidence * 100).toFixed(0)}%)
            </Text>
          </View>
        ))}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[
            styles.button,
            (!model || isLoading) && styles.buttonDisabled,
          ]}
          onPress={() => setIsRunning(!isRunning)}
          disabled={!model || isLoading}
        >
          <Text style={styles.buttonText}>
            {isRunning ? "⏹ Stop" : "▶ Start"} Detection
          </Text>
        </TouchableOpacity>

        <Text style={styles.statusText}>
          Model:{" "}
          {model ? "Ready" : isLoading ? "Loading..." : "Not loaded"}
        </Text>
      </View>

      {/* Logs */}
      <ScrollView style={styles.logContainer}>
        <Text style={styles.logTitle}>V3 TFLite Logs:</Text>
        {logs.map((l, i) => (
          <Text key={i} style={styles.logText}>
            {l}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  cameraContainer: {
    flex: 1,
    position: "relative",
  },
  camera: {
    flex: 1,
  },
  bbox: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "#00FF00",
    backgroundColor: "rgba(0, 255, 0, 0.1)",
  },
  bboxLabel: {
    color: "#00FF00",
    fontSize: 10,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    padding: 2,
  },
  controls: {
    padding: 16,
    alignItems: "center",
  },
  button: {
    backgroundColor: "#5B9BD5",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  buttonDisabled: {
    backgroundColor: "#666",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  statusText: {
    color: "#888",
    fontSize: 14,
  },
  text: {
    color: "white",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 16,
  },
  logContainer: {
    maxHeight: 200,
    backgroundColor: "#1E293B",
    padding: 8,
    margin: 8,
    borderRadius: 8,
  },
  logTitle: {
    color: "#5B9BD5",
    fontWeight: "bold",
    marginBottom: 4,
  },
  logText: {
    color: "#94A3B8",
    fontSize: 11,
    fontFamily: "monospace",
  },
});
