import * as tf from "@tensorflow/tfjs";
import { Asset } from "expo-asset";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import * as jpeg from "jpeg-js";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const MODEL_INPUT_SIZE = 640;

export default function V2Demo() {
  const [permission, requestPermission] = useCameraPermissions();
  const [tfReady, setTfReady] = useState(false);
  const [model, setModel] = useState<tf.GraphModel | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const cameraRef = useRef<CameraView>(null);
  const processingRef = useRef(false);

  const log = (msg: string) => {
    console.log(msg);
    setLogs((l) => [...l.slice(-20), msg]);
  };

  /* -------------------- LOAD MODEL -------------------- */

const loadModel = useCallback(async () => {
    try {
      setIsLoading(true);
      log("Loading TF.js model from assets...");

      // Load model JSON directly via require
      const modelJson = require("../../assets/models/finally/model.json");
      log("[SUCCESS] Loaded model.json");

      // Load weight shards using expo-asset to get proper URIs
      log("Loading weight shard assets...");

      const [shard1Asset, shard2Asset, shard3Asset] = await Promise.all([
        Asset.fromModule(
          require("../../assets/models/finally/group1-shard1of3.bin"),
        ).downloadAsync(),
        Asset.fromModule(
          require("../../assets/models/finally/group1-shard2of3.bin"),
        ).downloadAsync(),
        Asset.fromModule(
          require("../../assets/models/finally/group1-shard3of3.bin"),
        ).downloadAsync(),
      ]);

      log("Fetching weight shards...");
      const [buf1, buf2, buf3] = await Promise.all([
        fetch(shard1Asset.localUri!).then((r) => r.arrayBuffer()),
        fetch(shard2Asset.localUri!).then((r) => r.arrayBuffer()),
        fetch(shard3Asset.localUri!).then((r) => r.arrayBuffer()),
      ]);

      log(
        `[SUCCESS] Loaded ${((buf1.byteLength + buf2.byteLength + buf3.byteLength) / 1024 / 1024).toFixed(2)} MB weights`,
      );

      log("Loading model into TensorFlow.js...");

      // Convert to Uint8Array and combine into single ArrayBuffer
      const totalSize = buf1.byteLength + buf2.byteLength + buf3.byteLength;
      const combinedWeights = new Uint8Array(totalSize);
      combinedWeights.set(new Uint8Array(buf1), 0);
      combinedWeights.set(new Uint8Array(buf2), buf1.byteLength);
      combinedWeights.set(
        new Uint8Array(buf3),
        buf1.byteLength + buf2.byteLength,
      );

      // Pass as single ArrayBuffer
      const modelArtifacts = {
        modelTopology: modelJson.modelTopology,
        format: modelJson.format,
        generatedBy: modelJson.generatedBy,
        convertedBy: modelJson.convertedBy,
        weightSpecs: modelJson.weightsManifest[0].weights,
        weightData: combinedWeights.buffer,
      };

      const loadedModel = await tf.loadGraphModel(
        tf.io.fromMemory(modelArtifacts),
      );

      log("[SUCCESS] Model loaded successfully!");
      log(`Input: ${JSON.stringify(loadedModel.inputs[0].shape)}`);
      log(`Output: ${JSON.stringify(loadedModel.outputs[0].shape)}`);

      setModel(loadedModel);
    } catch (err) {
      console.error(err);
      log(`[ERROR] Model load failed: ${err}`);
    } finally {
      setIsLoading(false);
    }
  }, []);;

  /* -------------------- INIT TFJS -------------------- */

  useEffect(() => {
    (async () => {
      log("Initializing TensorFlow.js...");
      await tf.ready();
      log("[SUCCESS] TensorFlow.js ready");
      setTfReady(true);
      await loadModel();
    })();
  }, [loadModel]);

  /* -------------------- IMAGE → TENSOR -------------------- */

  const imageToTensor = async (uri: string) => {
    const buffer = await fetch(uri).then((r) => r.arrayBuffer());
    const raw = jpeg.decode(buffer, { useTArray: true });

    let tensor = tf.tensor3d(raw.data, [raw.height, raw.width, 4], "int32");

    // RGBA → RGB
    tensor = tensor.slice([0, 0, 0], [-1, -1, 3]);

    // Normalize & batch
    return tensor.toFloat().div(255.0).expandDims(0); // [1, 640, 640, 3]
  };

  /* -------------------- INFERENCE -------------------- */

  const runInference = async () => {
    if (!model || !cameraRef.current || processingRef.current) return;

    processingRef.current = true;

    try {
      log("Capturing image...");

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        skipProcessing: true,
      });

      const resized = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: MODEL_INPUT_SIZE, height: MODEL_INPUT_SIZE } }],
        { format: ImageManipulator.SaveFormat.JPEG },
      );

      const inputTensor = await imageToTensor(resized.uri);

      const start = Date.now();
      const output = model.execute(inputTensor) as tf.Tensor;
      const time = Date.now() - start;

      log(`Inference done in ${time} ms`);
      log(`Output shape: ${output.shape}`);

      // TEMP: just log raw output
      const raw = await output.array();
      console.log("RAW YOLO OUTPUT", raw);

      // cleanup
      tf.dispose([inputTensor, output]);
    } catch (e) {
      console.error(e);
      log("Inference error");
    }

    processingRef.current = false;

    if (isRunning) {
      setTimeout(runInference, 2000);
    }
  };

  /* -------------------- CONTROLS -------------------- */

  const start = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) return;
    }
    setIsRunning(true);
    runInference();
  };

  const stop = () => {
    setIsRunning(false);
  };

  /* -------------------- UI -------------------- */

  if (!tfReady || isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text>Loading TensorFlow / Model…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isRunning && (
        <CameraView ref={cameraRef} style={styles.camera} facing="back" />
      )}

      <TouchableOpacity
        style={styles.button}
        onPress={isRunning ? stop : start}
      >
        <Text style={styles.buttonText}>
          {isRunning ? "Stop" : "Start Detection"}
        </Text>
      </TouchableOpacity>

      <ScrollView style={styles.logBox}>
        {logs.map((l, i) => (
          <Text key={i} style={styles.log}>
            {l}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

/* -------------------- STYLES -------------------- */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a1628" },
  camera: { height: "50%" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  button: {
    margin: 16,
    padding: 16,
    backgroundColor: "#2563EB",
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 18 },
  logBox: { padding: 12 },
  log: { color: "#9CA3AF", fontSize: 12 },
});
