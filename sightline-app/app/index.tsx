import { CameraComponent } from "@/components/camera-component";
import { MaterialIcons } from "@expo/vector-icons";
import { CameraView } from "expo-camera";
import { LinearGradient } from "expo-linear-gradient";
import * as Speech from "expo-speech";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  CameraFrame,
  startFrameCapture,
  useCameraPermissions,
} from "../services/cameraService";
import {
  DetectionResult,
  detectObjectsInFrame,
  formatDetectionForSpeech,
  analyzeFrameWithSpatialEngine,
} from "../services/detectionService";
import V2Demo from "./pages/v2_demo";
import V3TFLite from "./pages/v3_tflite";

type AppState = "idle" | "running" | "error";
type TabType = "scan" | "engine" | "history" | "more";
type MoreOption = "settings" | "v2" | "v3" | null;
type Theme = "light" | "dark";

interface SessionHistory {
  id: string;
  duration: string;
  durationSeconds: number;
  objectsDetected: number;
  timestamp: Date;
  detections: string[];
}

const { width } = Dimensions.get("window");

// Theme Colors
const themes = {
  light: {
    background: ["#f8fafc", "#f1f5f9", "#e2e8f0"],
    card: "rgba(255, 255, 255, 0.95)",
    cardBorder: "rgba(148, 163, 184, 0.3)",
    text: "#0f172a",
    textSecondary: "#475569",
    textTertiary: "#64748b",
    primary: "#3b82f6",
    primaryLight: "rgba(59, 130, 246, 0.15)",
    success: "#10b981",
    successLight: "rgba(16, 185, 129, 0.15)",
    warning: "#f59e0b",
    warningLight: "rgba(245, 158, 11, 0.15)",
    error: "#ef4444",
    errorLight: "rgba(239, 68, 68, 0.15)",
    tabBar: "rgba(255, 255, 255, 0.98)",
    tabBarBorder: "rgba(148, 163, 184, 0.2)",
    statusBadge: "rgba(226, 232, 240, 0.8)",
    statusBadgeActive: "rgba(16, 185, 129, 0.2)",
    statusDot: "#94a3b8",
    statusDotActive: "#10b981",
    overlay: "rgba(15, 23, 42, 0.15)",
    icon: "#3b82f6",
    iconSecondary: "#64748b",
    shadow: "rgba(15, 23, 42, 0.1)",
  },
  dark: {
    background: ["#0a0f1e", "#151b2e", "#1e293b"],
    card: "rgba(30, 41, 59, 0.8)",
    cardBorder: "rgba(71, 85, 105, 0.5)",
    text: "#ffffff",
    textSecondary: "#94a3b8",
    textTertiary: "#64748b",
    primary: "#60a5fa",
    primaryLight: "rgba(96, 165, 250, 0.15)",
    success: "#10b981",
    successLight: "rgba(16, 185, 129, 0.15)",
    warning: "#fbbf24",
    warningLight: "rgba(251, 191, 36, 0.15)",
    error: "#f87171",
    errorLight: "rgba(248, 113, 113, 0.15)",
    tabBar: "rgba(8, 20, 35, 0.98)",
    tabBarBorder: "rgba(96, 165, 250, 0.2)",
    statusBadge: "rgba(71, 85, 105, 0.4)",
    statusBadgeActive: "rgba(16, 185, 129, 0.2)",
    statusDot: "#64748b",
    statusDotActive: "#10b981",
    overlay: "rgba(0, 0, 0, 0.25)",
    icon: "#60a5fa",
    iconSecondary: "#94a3b8",
    shadow: "rgba(0, 0, 0, 0.3)",
  },
};

export default function SightlineApp() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [appState, setAppState] = useState<AppState>("idle");
  const [activeTab, setActiveTab] = useState<TabType>("scan");
  const [moreSelection, setMoreSelection] = useState<MoreOption>(null);
  const [objectsDetected, setObjectsDetected] = useState<number>(0);
  const [sessionTime, setSessionTime] = useState<string>("0:00");
  const [lastSpokenText, setLastSpokenText] = useState<string>("");
  const [sessionHistory, setSessionHistory] = useState<SessionHistory[]>([]);
  const [currentDetections, setCurrentDetections] = useState<string[]>([]);
  const [capturedFrameUri, setCapturedFrameUri] = useState<string | null>(null);

  // Spatial Engine state
  const [spatialAppState, setSpatialAppState] = useState<AppState>("idle");
  const [spatialSessionTime, setSpatialSessionTime] = useState<string>("0:00");
  const [lastSpeech, setLastSpeech] = useState<string>("Ready to start");
  const [speechLog, setSpeechLog] = useState<{ time: string; message: string }[]>([]);
  const [silenceCount, setSilenceCount] = useState<number>(0);
  const [speechCount, setSpeechCount] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isProcessingRef = useRef<boolean>(false);

  // Spatial Engine refs
  const spatialStartTimeRef = useRef<number>(0);
  const spatialTimerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const captureTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldContinueRef = useRef<boolean>(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Camera state
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const spatialCameraRef = useRef<CameraView>(null);
  const stopCaptureRef = useRef<(() => void) | null>(null);

  // Get current theme colors
  const colors = themes[theme];
  
  // Create theme-aware styles
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Theme toggle
  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const speak = (text: string) => {
    // Stop any ongoing speech
    Speech.stop();

    // Speak the text
    Speech.speak(text, {
      language: "en",
      pitch: 1.0,
      rate: 0.9, // Slightly slower for clarity
    });

    setLastSpokenText(text);
  };

  const handleToggle = async () => {
    if (appState === "idle") {
      // Check camera permission
      if (!permission?.granted) {
        const result = await requestPermission();
        if (!result.granted) {
          setAppState("error");
          speak("Camera permission denied. Please enable camera access.");
          return;
        }
      }
      startSightline();
    } else if (appState === "running") {
      stopSightline();
    }
  };

  const handleFrameCaptured = async (frame: CameraFrame) => {
    // Skip if still processing previous frame
    if (isProcessingRef.current) {
      console.log("Still processing previous frame, skipping...");
      return;
    }

    try {
      isProcessingRef.current = true;

      // Store the captured frame for display
      setCapturedFrameUri(frame.uri);

      // Detect objects in the frame
      const result: DetectionResult = await detectObjectsInFrame(frame);

      console.log("Detection result:", result);

      // Convert detection to speech
      const announcement = formatDetectionForSpeech(result);

      console.log("Announcement:", announcement);

      // Speak the detection
      speak(announcement);

      // Update stats
      setObjectsDetected((prev) => prev + result.objects.length);
      setCurrentDetections((prev) => [...prev, announcement]);

      console.log(
        `Detected ${result.objects.length} objects in ${result.processingTime}ms`,
      );
    } catch (error) {
      console.error("Error processing frame:", error);
    } finally {
      isProcessingRef.current = false;
    }
  };

  const startSightline = () => {
    setAppState("running");
    setObjectsDetected(0);
    setSessionTime("0:00");
    setCurrentDetections([]);
    startTimeRef.current = Date.now();

    // Initial announcement
    speak("SightViz active. Scanning environment.");
    AccessibilityInfo.announceForAccessibility("SightViz running.");

    // Start timer immediately - updates every second
    timerIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      setSessionTime(`${minutes}:${seconds.toString().padStart(2, "0")}`);
    }, 1000);

    // Start camera frame capture (attempts every 3 seconds, but waits for processing)
    // Wait a bit for camera to initialize
    setTimeout(() => {
      if (cameraRef.current) {
        const stopCapture = startFrameCapture(
          cameraRef as React.RefObject<CameraView>,
          handleFrameCaptured,
          3000, // Try every 3 seconds, but will skip if still processing
        );
        stopCaptureRef.current = stopCapture;
      }
    }, 1000);
  };

  const stopSightline = () => {
    // Reset processing flag
    isProcessingRef.current = false;

    // Calculate final session duration
    const durationSeconds = Math.floor(
      (Date.now() - startTimeRef.current) / 1000,
    );
    const minutes = Math.floor(durationSeconds / 60);
    const seconds = durationSeconds % 60;
    const finalDuration = `${minutes}:${seconds.toString().padStart(2, "0")}`;

    // Save session to history
    const newSession: SessionHistory = {
      id: Date.now().toString(),
      duration: finalDuration,
      durationSeconds: durationSeconds,
      objectsDetected: objectsDetected,
      timestamp: new Date(),
      detections: [...currentDetections],
    };

    setSessionHistory((prev) => [newSession, ...prev]);
    setAppState("idle");
    setCapturedFrameUri(null); // Clear the frame preview

    // Stop camera capture
    if (stopCaptureRef.current) {
      stopCaptureRef.current();
      stopCaptureRef.current = null;
    }

    // Clear intervals
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    // Stop speech
    Speech.stop();

    // Final announcement
    speak(
      `SightViz stopped. Session complete. ${objectsDetected} objects detected in ${finalDuration}.`,
    );
    AccessibilityInfo.announceForAccessibility("SightViz stopped.");
  };

  // Spatial Engine Functions
  const speakSpatial = (text: string) => {
    Speech.stop();
    Speech.speak(text, {
      language: "en",
      pitch: 1.0,
      rate: 0.9,
    });

    const timestamp = new Date().toLocaleTimeString();
    setLastSpeech(text);
    setSpeechLog((prev) => [{ time: timestamp, message: text }, ...prev].slice(0, 20));
    setSpeechCount((prev) => prev + 1);
  };

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopPulseAnimation = () => {
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  };

  const captureAndAnalyze = async () => {
    if (!shouldContinueRef.current || !spatialCameraRef.current) {
      return;
    }

    try {
      setIsProcessing(true);

      const photo = await spatialCameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });

      if (!photo) {
        console.log("Failed to capture photo");
        scheduleNextCapture();
        return;
      }

      const frame: CameraFrame = {
        uri: photo.uri,
        width: photo.width,
        height: photo.height,
        timestamp: Date.now(),
      };

      const speechOutput = await analyzeFrameWithSpatialEngine(frame);

      if (speechOutput) {
        console.log(`Speaking: "${speechOutput}"`);
        speakSpatial(speechOutput);
      } else {
        console.log("Silent");
        setSilenceCount((prev) => prev + 1);
      }
    } catch (error) {
      console.error("Error processing frame:", error);
    } finally {
      setIsProcessing(false);
      scheduleNextCapture();
    }
  };

  const scheduleNextCapture = () => {
    if (shouldContinueRef.current) {
      captureTimeoutRef.current = setTimeout(() => {
        captureAndAnalyze();
      }, 3000);
    }
  };

  const handleSpatialToggle = async () => {
    if (spatialAppState === "idle") {
      if (!permission?.granted) {
        const result = await requestPermission();
        if (!result.granted) {
          setSpatialAppState("error");
          speakSpatial("Camera permission denied");
          return;
        }
      }
      startSpatialSession();
    } else if (spatialAppState === "running") {
      stopSpatialSession();
    }
  };

  const startSpatialSession = () => {
    setSpatialAppState("running");
    setSpatialSessionTime("0:00");
    setSpeechLog([]);
    setSilenceCount(0);
    setSpeechCount(0);
    setIsProcessing(false);
    spatialStartTimeRef.current = Date.now();
    shouldContinueRef.current = true;

    speakSpatial("Spatial guidance active");
    AccessibilityInfo.announceForAccessibility("Spatial guidance running");

    startPulseAnimation();

    spatialTimerIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - spatialStartTimeRef.current) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      setSpatialSessionTime(`${minutes}:${seconds.toString().padStart(2, "0")}`);
    }, 1000);

    setTimeout(() => {
      captureAndAnalyze();
    }, 1000);
  };

  const stopSpatialSession = () => {
    shouldContinueRef.current = false;
    setIsProcessing(false);
    setSpatialAppState("idle");

    if (captureTimeoutRef.current) {
      clearTimeout(captureTimeoutRef.current);
      captureTimeoutRef.current = null;
    }

    if (spatialTimerIntervalRef.current) {
      clearInterval(spatialTimerIntervalRef.current);
      spatialTimerIntervalRef.current = null;
    }

    stopPulseAnimation();

    speakSpatial("Spatial guidance stopped");
    setLastSpeech("Session ended");
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stopCaptureRef.current) stopCaptureRef.current();
      if (scanIntervalRef.current) clearTimeout(scanIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      Speech.stop();
    };
  }, []);

  // Determine button text and state label
  const buttonText =
    appState === "running" ? "Stop Scanning" : "Start Scanning";
  const stateLabel =
    appState === "idle" ? "Ready" : appState === "running" ? "Active" : "Error";

  // Accessibility label and hint
  const accessibilityLabel =
    appState === "running" ? "Stop SightViz" : "Start SightViz";
  const accessibilityHint =
    appState === "running"
      ? "Double tap to stop spatial detection"
      : "Double tap to start spatial detection";

  const renderContent = () => {
    if (activeTab === "scan") {
      return (
        <>
          {/* Header */}
          <View style={styles.scanHeader}>
            <View style={styles.scanHeaderIcon}>
              <MaterialIcons name="qr-code-scanner" size={40} color="#60a5fa" />
            </View>
            <Text style={styles.scanTitle}>SightViz</Text>
            <Text style={styles.scanSubtitle}>Real-time Object Detection</Text>
            
            {/* Status Badge */}
            <View
              style={[
                styles.scanStatusBadge,
                appState === "running" && styles.scanStatusBadgeActive,
              ]}
              accessible={true}
              accessibilityRole="text"
              accessibilityLabel={`Status: ${stateLabel}`}
            >
              <View
                style={[
                  styles.scanStatusDot,
                  appState === "running" && styles.scanStatusDotActive,
                ]}
              />
              <Text style={styles.scanStatusText}>{stateLabel.toUpperCase()}</Text>
            </View>
          </View>

          {/* Stats Cards */}
          <View style={styles.scanStatsWrapper}>
            <View style={styles.scanStatsContainer}>
              <View
                style={styles.scanStatCard}
                accessible={true}
                accessibilityRole="text"
                accessibilityLabel={`Objects detected: ${objectsDetected}`}
              >
                <View style={styles.scanStatIconContainer}>
                  <MaterialIcons name="visibility" size={20} color="#60a5fa" />
                </View>
                <Text style={styles.scanStatLabel}>Objects</Text>
                <Text style={styles.scanStatValue}>{objectsDetected}</Text>
              </View>
              
              <View
                style={[styles.scanStatCard, styles.scanStatCardHighlight]}
                accessible={true}
                accessibilityRole="text"
                accessibilityLabel={`Session time: ${sessionTime}`}
              >
                <View style={[styles.scanStatIconContainer, styles.scanStatIconHighlight]}>
                  <MaterialIcons name="timer" size={20} color="#10b981" />
                </View>
                <Text style={styles.scanStatLabel}>Time</Text>
                <Text style={[styles.scanStatValue, styles.scanStatValueHighlight]}>{sessionTime}</Text>
              </View>
            </View>
          </View>

          {/* Captured Frame Preview */}
          {appState === "running" && capturedFrameUri && (
            <View style={styles.scanFramePreviewCard}>
              <View style={styles.scanFramePreviewHeader}>
                <MaterialIcons name="camera-alt" size={18} color="#fbbf24" />
                <Text style={styles.scanFramePreviewTitle}>Live Frame</Text>
              </View>
              <Image
                source={{ uri: capturedFrameUri }}
                style={styles.scanFramePreviewImage}
                resizeMode="cover"
              />
            </View>
          )}

          {/* Speech output display */}
          {appState === "running" && lastSpokenText && (
            <View style={styles.scanSpeechCard}>
              <View style={styles.scanSpeechCardHeader}>
                <MaterialIcons name="chat-bubble" size={20} color="#60a5fa" />
                <Text style={styles.scanSpeechCardTitle}>Current Detection</Text>
              </View>
              <Text style={styles.scanSpeechCardText}>{lastSpokenText}</Text>
            </View>
          )}

          {/* Main action button */}
          <View style={styles.scanButtonContainer}>
            <Pressable
              style={({ pressed }) => [
                styles.scanControlButton,
                pressed && styles.scanControlButtonPressed
              ]}
              onPress={handleToggle}
              accessibilityRole="button"
              accessibilityLabel={accessibilityLabel}
              accessibilityHint={accessibilityHint}
              accessibilityState={{ disabled: appState === "error" }}
              disabled={appState === "error"}
            >
              <LinearGradient
                colors={
                  appState === "running"
                    ? ["#065f46", "#059669"]
                    : appState === "error"
                    ? ["#991b1b", "#dc2626"]
                    : ["#1e3a8a", "#1e40af"]
                }
                style={styles.scanButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <MaterialIcons 
                  name={appState === "running" ? "stop" : appState === "error" ? "error" : "play-arrow"} 
                  size={24} 
                  color="#fff" 
                  style={styles.scanButtonIcon}
                />
                <Text style={styles.scanButtonText}>{buttonText}</Text>
              </LinearGradient>
            </Pressable>
          </View>

          {/* Error message */}
          {appState === "error" && (
            <View
              style={styles.scanErrorContainer}
              accessible={true}
              accessibilityRole="alert"
            >
              <MaterialIcons name="error-outline" size={24} color="#f87171" />
              <Text style={styles.scanErrorText}>
                Unable to start. Check camera permissions.
              </Text>
            </View>
          )}
        </>
      );
    } else if (activeTab === "history") {
      return (
        <>
          <View style={styles.historyHeader}>
            <View style={styles.historyHeaderIcon}>
              <MaterialIcons name="history" size={40} color="#60a5fa" />
            </View>
            <Text style={styles.historyTitle}>Session History</Text>
            <Text style={styles.historySubtitle}>
              {sessionHistory.length > 0 
                ? `${sessionHistory.length} ${sessionHistory.length === 1 ? 'session' : 'sessions'} recorded`
                : "No sessions yet"}
            </Text>
          </View>

          {sessionHistory.length === 0 ? (
            <View style={styles.historyEmptyState}>
              <MaterialIcons name="history" size={80} color="#334155" />
              <Text style={styles.historyEmptyText}>No session history yet</Text>
              <Text style={styles.historyEmptySubtext}>
                Start scanning to track your activity
              </Text>
            </View>
          ) : (
            <ScrollView 
              style={styles.historyScrollView}
              showsVerticalScrollIndicator={false}
            >
              {sessionHistory.map((session) => (
                <View key={session.id} style={styles.historySessionCard}>
                  <View style={styles.historySessionHeader}>
                    <View style={styles.historySessionDateContainer}>
                      <MaterialIcons name="calendar-today" size={16} color="#94a3b8" />
                      <Text style={styles.historySessionDate}>
                        {session.timestamp.toLocaleDateString()}{" "}
                        {session.timestamp.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>
                    <View style={styles.historyDurationBadge}>
                      <MaterialIcons name="schedule" size={14} color="#10b981" />
                      <Text style={styles.historySessionDuration}>
                        {session.duration}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.historySessionStats}>
                    <View style={styles.historySessionStat}>
                      <View style={styles.historyStatIconContainer}>
                        <MaterialIcons name="visibility" size={18} color="#60a5fa" />
                      </View>
                      <Text style={styles.historySessionStatValue}>
                        {session.objectsDetected}
                      </Text>
                      <Text style={styles.historySessionStatLabel}>Objects</Text>
                    </View>
                    <View style={styles.historySessionStat}>
                      <View style={styles.historyStatIconContainer}>
                        <MaterialIcons name="campaign" size={18} color="#a78bfa" />
                      </View>
                      <Text style={styles.historySessionStatValue}>
                        {session.detections.length}
                      </Text>
                      <Text style={styles.historySessionStatLabel}>Detections</Text>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </>
      );
    } else if (activeTab === "more") {
      // If a more option is selected, render that page
      if (moreSelection === "settings") {
        return (
          <>
            <View style={styles.settingsHeader}>
              <Pressable 
                onPress={() => setMoreSelection(null)}
                style={styles.backButton}
              >
                <MaterialIcons name="arrow-back" size={24} color="#60a5fa" />
                <Text style={styles.backButtonText}>Back to More</Text>
              </Pressable>
              <View style={styles.settingsHeaderIcon}>
                <MaterialIcons name="settings" size={40} color="#60a5fa" />
              </View>
              <Text style={styles.settingsTitle}>Settings</Text>
              <Text style={styles.settingsSubtitle}>Application Configuration</Text>
            </View>

            <View style={styles.settingsContent}>
              <Pressable style={styles.settingItemCard} onPress={toggleTheme}>
                <View style={styles.settingItemLeft}>
                  <View style={styles.settingIconContainer}>
                    <MaterialIcons name="brightness-6" size={22} color="#f59e0b" />
                  </View>
                  <View>
                    <Text style={styles.settingItemLabel}>Theme</Text>
                    <Text style={styles.settingItemDescription}>App appearance</Text>
                  </View>
                </View>
                <View style={styles.settingValueBadge}>
                  <Text style={styles.settingItemValue}>{theme === "dark" ? "Dark" : "Light"}</Text>
                </View>
              </Pressable>
              
              <View style={styles.settingItemCard}>
                <View style={styles.settingItemLeft}>
                  <View style={styles.settingIconContainer}>
                    <MaterialIcons name="record-voice-over" size={22} color="#60a5fa" />
                  </View>
                  <View>
                    <Text style={styles.settingItemLabel}>Voice Feedback</Text>
                    <Text style={styles.settingItemDescription}>Audio announcements</Text>
                  </View>
                </View>
                <View style={styles.settingValueBadge}>
                  <Text style={styles.settingItemValue}>Enabled</Text>
                </View>
              </View>
              
              <View style={styles.settingItemCard}>
                <View style={styles.settingItemLeft}>
                  <View style={styles.settingIconContainer}>
                    <MaterialIcons name="tune" size={22} color="#a78bfa" />
                  </View>
                  <View>
                    <Text style={styles.settingItemLabel}>Detection Sensitivity</Text>
                    <Text style={styles.settingItemDescription}>Object detection threshold</Text>
                  </View>
                </View>
                <View style={styles.settingValueBadge}>
                  <Text style={styles.settingItemValue}>High</Text>
                </View>
              </View>
              
              <View style={styles.settingItemCard}>
                <View style={styles.settingItemLeft}>
                  <View style={styles.settingIconContainer}>
                    <MaterialIcons name="vibration" size={22} color="#10b981" />
                  </View>
                  <View>
                    <Text style={styles.settingItemLabel}>Haptic Feedback</Text>
                    <Text style={styles.settingItemDescription}>Tactile responses</Text>
                  </View>
                </View>
                <View style={styles.settingValueBadge}>
                  <Text style={styles.settingItemValue}>Enabled</Text>
                </View>
              </View>
            </View>
          </>
        );
      } else if (moreSelection === "v2") {
        return <V2Demo />;
      } else if (moreSelection === "v3") {
        return <V3TFLite />;
      } else {
        // Show More menu
        return (
          <>
            <View style={styles.moreHeader}>
              <View style={styles.moreHeaderIcon}>
                <MaterialIcons name="apps" size={40} color="#60a5fa" />
              </View>
              <Text style={styles.moreTitle}>More Options</Text>
              <Text style={styles.moreSubtitle}>Advanced Features & Settings</Text>
            </View>

            <View style={styles.moreContent}>
              <Pressable 
                style={({ pressed }) => [
                  styles.moreOptionCard,
                  pressed && styles.moreOptionCardPressed
                ]}
                onPress={() => setMoreSelection("settings")}
              >
                <View style={[styles.moreOptionIconContainer, { backgroundColor: "rgba(96, 165, 250, 0.15)" }]}>
                  <MaterialIcons name="settings" size={32} color="#60a5fa" />
                </View>
                <View style={styles.moreOptionContent}>
                  <Text style={styles.moreOptionTitle}>Settings</Text>
                  <Text style={styles.moreOptionDescription}>Configure app preferences</Text>
                </View>
                <MaterialIcons name="chevron-right" size={24} color="#64748b" />
              </Pressable>

              <Pressable 
                style={({ pressed }) => [
                  styles.moreOptionCard,
                  pressed && styles.moreOptionCardPressed
                ]}
                onPress={() => setMoreSelection("v2")}
              >
                <View style={[styles.moreOptionIconContainer, { backgroundColor: "rgba(167, 139, 250, 0.15)" }]}>
                  <MaterialIcons name="psychology" size={32} color="#a78bfa" />
                </View>
                <View style={styles.moreOptionContent}>
                  <Text style={styles.moreOptionTitle}>V2 Detection</Text>
                  <Text style={styles.moreOptionDescription}>TensorFlow.js model demo</Text>
                </View>
                <MaterialIcons name="chevron-right" size={24} color="#64748b" />
              </Pressable>

              <Pressable 
                style={({ pressed }) => [
                  styles.moreOptionCard,
                  pressed && styles.moreOptionCardPressed
                ]}
                onPress={() => setMoreSelection("v3")}
              >
                <View style={[styles.moreOptionIconContainer, { backgroundColor: "rgba(251, 191, 36, 0.15)" }]}>
                  <MaterialIcons name="bolt" size={32} color="#fbbf24" />
                </View>
                <View style={styles.moreOptionContent}>
                  <Text style={styles.moreOptionTitle}>V3 TFLite</Text>
                  <Text style={styles.moreOptionDescription}>TensorFlow Lite integration</Text>
                </View>
                <MaterialIcons name="chevron-right" size={24} color="#64748b" />
              </Pressable>
            </View>
          </>
        );
      }
    } else if (activeTab === "engine") {
      const stateColors: Record<AppState, [string, string]> = {
        idle: ["#1e3a8a", "#1e40af"],
        running: ["#065f46", "#059669"],
        error: ["#991b1b", "#dc2626"],
      };

      const stateText = {
        idle: "Start Guidance",
        running: "Stop Guidance",
        error: "Error",
      };

      const stateIcon = {
        idle: "play-arrow",
        running: "stop",
        error: "error",
      };

      return (
        <>
          {/* Header */}
          <View style={styles.spatialHeader}>
            <View style={styles.spatialHeaderIcon}>
              <MaterialIcons name="explore" size={40} color="#60a5fa" />
            </View>
            <Text style={styles.spatialTitle}>SightViz Engine</Text>
            <Text style={styles.spatialSubtitle}>Real-time Spatial Guidance</Text>
            
            {/* Status Badge */}
            <View style={[
              styles.spatialStatusBadge,
              spatialAppState === "running" && styles.spatialStatusBadgeActive
            ]}>
              <View style={[
                styles.spatialStatusDot,
                spatialAppState === "running" && styles.spatialStatusDotActive
              ]} />
              <Text style={styles.spatialStatusText}>
                {spatialAppState === "running" ? "ACTIVE" : "IDLE"}
              </Text>
            </View>
          </View>

          {/* Camera View with Enhanced Border */}
          <View style={styles.spatialCameraWrapper}>
            <View style={styles.spatialCameraContainer}>
              <CameraView
                ref={spatialCameraRef}
                style={styles.spatialCamera}
                facing="back"
              />
              <View style={styles.spatialOverlay}>
                {isProcessing && (
                  <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                    <MaterialIcons name="visibility" size={48} color="rgba(255,255,255,0.8)" />
                  </Animated.View>
                )}
                <Text style={styles.spatialOverlayText}>
                  {isProcessing ? "ANALYZING..." : spatialAppState === "running" ? "SCANNING" : "READY"}
                </Text>
              </View>
            </View>
          </View>

          {/* Stats Cards */}
          <View style={styles.spatialStatsWrapper}>
            <View style={styles.spatialStatsContainer}>
              <View style={styles.spatialStatCard}>
                <View style={styles.spatialStatIconContainer}>
                  <MaterialIcons name="timer" size={20} color="#60a5fa" />
                </View>
                <Text style={styles.spatialStatLabel}>Session</Text>
                <Text style={styles.spatialStatValue}>{spatialSessionTime}</Text>
              </View>
              
              <View style={[styles.spatialStatCard, styles.spatialStatCardHighlight]}>
                <View style={[styles.spatialStatIconContainer, styles.spatialStatIconHighlight]}>
                  <MaterialIcons name="record-voice-over" size={20} color="#10b981" />
                </View>
                <Text style={styles.spatialStatLabel}>Speech</Text>
                <Text style={[styles.spatialStatValue, styles.spatialStatValueHighlight]}>{speechCount}</Text>
              </View>
              
              <View style={styles.spatialStatCard}>
                <View style={styles.spatialStatIconContainer}>
                  <MaterialIcons name="volume-off" size={20} color="#94a3b8" />
                </View>
                <Text style={styles.spatialStatLabel}>Silent</Text>
                <Text style={styles.spatialStatValue}>{silenceCount}</Text>
              </View>
            </View>
          </View>

          {/* Last Speech Card */}
          <View style={styles.spatialSpeechCard}>
            <View style={styles.spatialSpeechCardHeader}>
              <MaterialIcons name="chat-bubble" size={20} color="#60a5fa" />
              <Text style={styles.spatialSpeechCardTitle}>Latest Guidance</Text>
            </View>
            <Text style={styles.spatialSpeechCardText}>
              {lastSpeech || "Waiting for first detection..."}
            </Text>
          </View>

          {/* Control Button */}
          <Pressable
            onPress={handleSpatialToggle}
            style={({ pressed }) => [
              styles.spatialControlButton,
              pressed && styles.spatialControlButtonPressed
            ]}
          >
            <LinearGradient
              colors={stateColors[spatialAppState]}
              style={styles.spatialButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <MaterialIcons 
                name={stateIcon[spatialAppState] as any} 
                size={24} 
                color="#fff" 
                style={styles.spatialButtonIcon}
              />
              <Text style={styles.spatialButtonText}>{stateText[spatialAppState]}</Text>
            </LinearGradient>
          </Pressable>

          {/* Speech Log */}
          <View style={styles.spatialLogCard}>
            <View style={styles.spatialLogHeader}>
              <MaterialIcons name="history" size={18} color="#94a3b8" />
              <Text style={styles.spatialLogTitle}>Recent Activity</Text>
              {speechLog.length > 0 && (
                <View style={styles.spatialLogBadge}>
                  <Text style={styles.spatialLogBadgeText}>{speechLog.length}</Text>
                </View>
              )}
            </View>
            <ScrollView 
              style={styles.spatialLogScroll}
              showsVerticalScrollIndicator={false}
            >
              {speechLog.length === 0 ? (
                <View style={styles.spatialLogEmptyContainer}>
                  <MaterialIcons name="speaker-notes-off" size={48} color="#334155" />
                  <Text style={styles.spatialLogEmpty}>No activity yet</Text>
                  <Text style={styles.spatialLogEmptySubtext}>
                    Start scanning to see guidance history
                  </Text>
                </View>
              ) : (
                speechLog.map((entry, index) => (
                  <View key={index} style={styles.spatialLogEntry}>
                    <View style={styles.spatialLogEntryHeader}>
                      <MaterialIcons name="campaign" size={14} color="#10b981" />
                      <Text style={styles.spatialLogTime}>{entry.time}</Text>
                    </View>
                    <Text style={styles.spatialLogMessage}>{entry.message}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </>
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* Camera View (behind everything) */}
      <CameraComponent ref={cameraRef} isActive={appState === "running"} />

      <LinearGradient
        colors={colors.background as any}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.safeArea}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {renderContent()}
          </ScrollView>

          {/* Bottom Tab Bar */}
          <View style={styles.tabBar}>
            {/* Tab 1: Scan */}
            <Pressable
              style={styles.tabItem}
              onPress={() => setActiveTab("scan")}
              accessibilityRole="tab"
              accessibilityLabel="Scan tab"
              accessibilityState={{ selected: activeTab === "scan" }}
            >
              <View
                style={[
                  styles.tabIconContainer,
                  activeTab === "scan" && styles.tabIconContainerActive,
                ]}
              >
                <MaterialIcons
                  name="qr-code-scanner"
                  size={24}
                  color={activeTab === "scan" ? "#60a5fa" : "#94A3B8"}
                />
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  activeTab === "scan" && styles.tabLabelActive,
                ]}
              >
                Scan
              </Text>
            </Pressable>

            {/* Tab 2: Engine */}
            <Pressable
              style={styles.tabItem}
              onPress={() => setActiveTab("engine")}
              accessibilityRole="tab"
              accessibilityLabel="Spatial Engine tab"
              accessibilityState={{ selected: activeTab === "engine" }}
            >
              <View
                style={[
                  styles.tabIconContainer,
                  activeTab === "engine" && styles.tabIconContainerActive,
                ]}
              >
                <MaterialIcons
                  name="explore"
                  size={24}
                  color={activeTab === "engine" ? "#60a5fa" : "#94A3B8"}
                />
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  activeTab === "engine" && styles.tabLabelActive,
                ]}
              >
                Engine
              </Text>
            </Pressable>

            {/* Tab 3: History */}
            <Pressable
              style={styles.tabItem}
              onPress={() => setActiveTab("history")}
              accessibilityRole="tab"
              accessibilityLabel="History tab"
              accessibilityState={{ selected: activeTab === "history" }}
            >
              <View
                style={[
                  styles.tabIconContainer,
                  activeTab === "history" && styles.tabIconContainerActive,
                ]}
              >
                <MaterialIcons
                  name="history"
                  size={24}
                  color={activeTab === "history" ? "#60a5fa" : "#94A3B8"}
                />
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  activeTab === "history" && styles.tabLabelActive,
                ]}
              >
                History
              </Text>
            </Pressable>

            {/* Tab 4: More */}
            <Pressable
              style={styles.tabItem}
              onPress={() => {
                setActiveTab("more");
                setMoreSelection(null);
              }}
              accessibilityRole="tab"
              accessibilityLabel="More options tab"
              accessibilityState={{ selected: activeTab === "more" }}
            >
              <View
                style={[
                  styles.tabIconContainer,
                  activeTab === "more" && styles.tabIconContainerActive,
                ]}
              >
                <MaterialIcons
                  name="apps"
                  size={24}
                  color={activeTab === "more" ? "#60a5fa" : "#94A3B8"}
                />
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  activeTab === "more" && styles.tabLabelActive,
                ]}
              >
                More
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const createStyles = (colors: typeof themes.light) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background[0],
  },

  gradient: {
    flex: 1,
  },

  safeArea: {
    flex: 1,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },

  // Scan Tab Styles
  scanHeader: {
    alignItems: "center",
    marginBottom: 24,
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  scanHeaderIcon: {
    marginBottom: 12,
    backgroundColor: colors.primaryLight,
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.cardBorder,
  },
  scanTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  scanSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: "500",
    letterSpacing: 0.3,
  },
  scanStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.statusBadge,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  scanStatusBadgeActive: {
    backgroundColor: colors.statusBadgeActive,
    borderColor: colors.successLight,
  },
  scanStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textTertiary,
    marginRight: 8,
  },
  scanStatusDotActive: {
    backgroundColor: colors.success,
  },
  scanStatusText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  scanStatsWrapper: {
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  scanStatsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  scanStatCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  scanStatCardHighlight: {
    backgroundColor: colors.successLight,
    borderColor: colors.success,
  },
  scanStatIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  scanStatIconHighlight: {
    backgroundColor: colors.successLight,
  },
  scanStatLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  scanStatValue: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.text,
  },
  scanStatValueHighlight: {
    color: colors.success,
  },
  scanFramePreviewCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.warningLight,
  },
  scanFramePreviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  scanFramePreviewTitle: {
    fontSize: 12,
    color: colors.warning,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  scanFramePreviewImage: {
    width: "100%",
    height: 150,
    borderRadius: 12,
    backgroundColor: "#000",
  },
  scanSpeechCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  scanSpeechCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  scanSpeechCardTitle: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  scanSpeechCardText: {
    fontSize: 17,
    color: colors.textSecondary,
    fontWeight: "600",
    lineHeight: 24,
  },
  scanButtonContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  scanControlButton: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  scanControlButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  scanButtonGradient: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  scanButtonIcon: {
    marginRight: 4,
  },
  scanButtonText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  scanErrorContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: colors.errorLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.error,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  scanErrorText: {
    fontSize: 15,
    color: colors.error,
    fontWeight: "600",
    flex: 1,
  },

  // History Tab Styles
  historyHeader: {
    alignItems: "center",
    marginBottom: 24,
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  historyHeaderIcon: {
    marginBottom: 12,
    backgroundColor: colors.primaryLight,
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.cardBorder,
  },
  historyTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  historySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: "500",
    letterSpacing: 0.3,
  },
  historyEmptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 80,
  },
  historyEmptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.textTertiary,
    marginTop: 16,
    marginBottom: 8,
  },
  historyEmptySubtext: {
    fontSize: 14,
    color: colors.textTertiary,
    textAlign: "center",
  },
  historyScrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  historySessionCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  historySessionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(71, 85, 105, 0.3)",
  },
  historySessionDateContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  historySessionDate: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  historyDurationBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 6,
  },
  historySessionDuration: {
    fontSize: 15,
    fontWeight: "700",
    color: "#10b981",
  },
  historySessionStats: {
    flexDirection: "row",
    gap: 16,
  },
  historySessionStat: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  historyStatIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(96, 165, 250, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  historySessionStatValue: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
  },
  historySessionStatLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Settings Tab Styles
  settingsHeader: {
    alignItems: "center",
    marginBottom: 24,
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  settingsHeaderIcon: {
    marginBottom: 12,
    backgroundColor: colors.primaryLight,
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.cardBorder,
  },
  settingsTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  settingsSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: "500",
    letterSpacing: 0.3,
  },
  settingsContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  settingItemCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  settingItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },
  settingIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  settingItemLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textSecondary,
    marginBottom: 3,
  },
  settingItemDescription: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.textTertiary,
  },
  settingValueBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
  },
  settingItemValue: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
  },

  // More Tab Styles
  moreHeader: {
    alignItems: "center",
    marginBottom: 24,
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  moreHeaderIcon: {
    marginBottom: 12,
    backgroundColor: colors.primaryLight,
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.cardBorder,
  },
  moreTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  moreSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: "500",
    letterSpacing: 0.3,
  },
  moreContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  moreOptionCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 14,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  moreOptionCardPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
  moreOptionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  moreOptionContent: {
    flex: 1,
  },
  moreOptionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textSecondary,
    marginBottom: 4,
  },
  moreOptionDescription: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.textTertiary,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.primary,
  },

  // Header (old - to be removed)
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  appTitle: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    color: colors.text,
    letterSpacing: -0.5,
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.statusBadge,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },

  statusBadgeActive: {
    backgroundColor: colors.statusBadgeActive,
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.statusDot,
  },

  statusDotActive: {
    backgroundColor: colors.statusDotActive,
  },

  statusText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: colors.textSecondary,
  },

  // Stats Cards
  statsContainer: {
    flexDirection: "row",
    paddingHorizontal: 24,
    gap: 12,
    marginBottom: 32,
  },

  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },

  statValue: {
    fontSize: 36,
    fontFamily: "Inter_800ExtraBold",
    color: colors.text,
    marginBottom: 4,
  },

  statLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Main Button
  buttonContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    flex: 1,
  },

  button: {
    width: Math.min(width - 48, 320),
    height: Math.min(width - 48, 320),
    borderRadius: 160,
    overflow: "hidden",
    elevation: 10,
    shadowColor: "#10335D",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },

  buttonRunning: {
    shadowColor: "#10B981",
  },

  buttonError: {
    opacity: 0.5,
  },

  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },

  buttonGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },

  buttonText: {
    fontSize: 28,
    fontFamily: "Inter_800ExtraBold",
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: 0.5,
  },

  buttonSubtext: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "rgba(255, 255, 255, 0.8)",
    textAlign: "center",
  },

  // Frame Preview (Debug)
  framePreviewContainer: {
    marginHorizontal: 24,
    marginTop: 20,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: colors.warningLight,
  },

  framePreviewLabel: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: colors.warning,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  framePreviewImage: {
    width: "100%",
    height: 150,
    borderRadius: 8,
    backgroundColor: "#000",
  },

  // Speech Display
  speechContainer: {
    marginHorizontal: 24,
    marginTop: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: "rgba(16, 51, 93, 0.2)",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "rgba(16, 51, 93, 0.4)",
  },

  speechLabel: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: colors.primary,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  speechText: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: colors.text,
    lineHeight: 24,
  },

  // Error
  errorContainer: {
    marginHorizontal: 24,
    marginTop: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: colors.errorLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.error,
  },

  errorText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: colors.text,
    textAlign: "center",
  },

  // Tab Content
  tabContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },

  tabTitle: {
    fontSize: 28,
    fontFamily: "Inter_800ExtraBold",
    color: colors.text,
    marginBottom: 24,
  },

  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },

  emptyStateText: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: colors.textSecondary,
    marginBottom: 8,
  },

  emptyStateSubtext: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: colors.textTertiary,
  },

  // Session History Cards
  sessionCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },

  sessionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148, 163, 184, 0.1)",
  },

  sessionDate: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: colors.textSecondary,
  },

  sessionDuration: {
    fontSize: 18,
    fontFamily: "Inter_800ExtraBold",
    color: colors.primary,
  },

  sessionStats: {
    flexDirection: "row",
    gap: 20,
  },

  sessionStat: {
    flex: 1,
    alignItems: "center",
  },

  sessionStatValue: {
    fontSize: 28,
    fontFamily: "Inter_800ExtraBold",
    color: colors.text,
    marginBottom: 4,
  },

  sessionStatLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  settingItem: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },

  settingLabel: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: colors.textSecondary,
  },

  settingValue: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    color: colors.primary,
  },

  // Bottom Tab Bar
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.tabBar,
    borderTopWidth: 1,
    borderTopColor: colors.tabBarBorder,
    paddingBottom: 8,
    paddingTop: 12,
    paddingHorizontal: 8,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },

  tabItem: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
  },

  tabIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },

  tabIconContainerActive: {
    backgroundColor: colors.primaryLight,
  },

  tabLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: colors.iconSecondary,
  },

  tabLabelActive: {
    color: colors.icon,
  },

  // Spatial Engine Styles
  spatialHeader: {
    alignItems: "center",
    marginBottom: 24,
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  spatialHeaderIcon: {
    marginBottom: 12,
    backgroundColor: colors.primaryLight,
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.cardBorder,
  },
  spatialTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  spatialSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: "500",
    letterSpacing: 0.3,
  },
  spatialStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.statusBadge,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  spatialStatusBadgeActive: {
    backgroundColor: colors.statusBadgeActive,
    borderColor: colors.successLight,
  },
  spatialStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.statusDot,
    marginRight: 8,
  },
  spatialStatusDotActive: {
    backgroundColor: colors.statusDotActive,
  },
  spatialStatusText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  spatialCameraWrapper: {
    marginBottom: 20,
    marginHorizontal: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  spatialCameraContainer: {
    width: width - 32,
    height: 240,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  spatialCamera: {
    flex: 1,
  },
  spatialOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  spatialOverlayText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 3,
    textShadowColor: colors.shadow,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  spatialStatsWrapper: {
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  spatialStatsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  spatialStatCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  spatialStatCardHighlight: {
    backgroundColor: colors.successLight,
    borderColor: colors.success,
  },
  spatialStatIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  spatialStatIconHighlight: {
    backgroundColor: colors.successLight,
  },
  spatialStatLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  spatialStatValue: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.text,
  },
  spatialStatValueHighlight: {
    color: colors.success,
  },
  spatialSpeechCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  spatialSpeechCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  spatialSpeechCardTitle: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  spatialSpeechCardText: {
    fontSize: 17,
    color: colors.textSecondary,
    fontWeight: "600",
    lineHeight: 24,
  },
  spatialControlButton: {
    marginBottom: 16,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  spatialControlButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  spatialButtonGradient: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  spatialButtonIcon: {
    marginRight: 4,
  },
  spatialButtonText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  spatialLogCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  spatialLogHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  spatialLogTitle: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    flex: 1,
  },
  spatialLogBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  spatialLogBadgeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700",
  },
  spatialLogScroll: {
    flex: 1,
  },
  spatialLogEmptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  spatialLogEmpty: {
    color: colors.textTertiary,
    fontSize: 15,
    fontWeight: "600",
    marginTop: 12,
  },
  spatialLogEmptySubtext: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 6,
    textAlign: "center",
  },
  spatialLogEntry: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.success,
  },
  spatialLogEntryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 6,
  },
  spatialLogTime: {
    fontSize: 11,
    color: colors.textTertiary,
    fontWeight: "600",
  },
  spatialLogMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    fontWeight: "500",
  },
});
