import { CameraComponent } from "@/components/camera-component";
import {
    SettingsPanel,
    type SpeechLanguage,
} from "@/components/settings-panel";
import {
    colors,
    gradients,
    radius,
    shadows,
    spacing,
} from "@/constants/design-system";
import { MaterialIcons } from "@expo/vector-icons";
import { CameraView } from "expo-camera";
import { LinearGradient } from "expo-linear-gradient";
import * as Speech from "expo-speech";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    AccessibilityInfo,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
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
    analyzeFrameWithSpatialEngine,
    detectObjectsInFrame,
    enrollFaceProfile,
    fetchEnrolledFaces,
    formatDetectionForSpeech,
    type FaceProfile,
} from "../services/detectionService";

type AppState = "idle" | "running" | "error";
type ScanMode = "normal" | "engine";
type TabType = "home" | "engine" | "saveFaces" | "more";
type MoreSection = "menu" | "settings" | "history" | "about";

interface SessionHistory {
  id: string;
  duration: string;
  durationSeconds: number;
  objectsDetected: number;
  timestamp: Date;
  detections: string[];
}

// Server-side face profile shape
type ServerFaceProfile = FaceProfile;

const headerLogo = require("@/assets/images/logo.png");

export default function SightlineApp() {
  const [activeTab, setActiveTab] = useState<TabType>("home");
  const [scanMode, setScanMode] = useState<ScanMode>("normal");
  const [moreSection, setMoreSection] = useState<MoreSection>("menu");
  const [appState, setAppState] = useState<AppState>("idle");
  const [objectsDetected, setObjectsDetected] = useState<number>(0);
  const [sessionTime, setSessionTime] = useState<string>("0:00");
  const [lastSpokenText, setLastSpokenText] = useState<string>("");
  const [speechLanguage, setSpeechLanguage] =
    useState<SpeechLanguage>("English");
  const [audioLevel, setAudioLevel] = useState<number>(90);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [sessionHistory, setSessionHistory] = useState<SessionHistory[]>([]);
  const [currentDetections, setCurrentDetections] = useState<string[]>([]);
  const [capturedFrameUri, setCapturedFrameUri] = useState<string | null>(null);
  const [faceNameDraft, setFaceNameDraft] = useState<string>("");
  const [faceShotsDraft, setFaceShotsDraft] = useState<string[]>([]);
  const [isSavingFace, setIsSavingFace] = useState<boolean>(false);
  const [serverFaces, setServerFaces] = useState<ServerFaceProfile[]>([]);

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const stopCaptureRef = useRef<(() => void) | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const isProcessingRef = useRef<boolean>(false);

  const styles = useMemo(() => createStyles(), []);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (stopCaptureRef.current) {
        stopCaptureRef.current();
      }
    };
  }, []);

  useEffect(() => {
    if (isMuted) {
      Speech.stop();
    }
  }, [isMuted]);

  const handleAudioLevelChange = (next: number) => {
    setAudioLevel(next);
    Speech.stop();
  };

  const handleMutedChange = (next: boolean) => {
    setIsMuted(next);
    if (next) {
      Speech.stop();
    }
  };

  const speak = (text: string) => {
    setLastSpokenText(text);

    if (isMuted) {
      return;
    }

    Speech.stop();
    Speech.speak(text, {
      language: speechLanguage === "Hindi" ? "hi-IN" : "en-US",
      volume: audioLevel / 100,
      pitch: 1.0,
      rate: 0.9,
    });
  };

  const handleFrameCaptured = async (frame: CameraFrame) => {
    if (isProcessingRef.current) {
      return;
    }

    try {
      isProcessingRef.current = true;
      setCapturedFrameUri(frame.uri);

      let announcement = "";
      let detectedCount = 0;

      if (scanMode === "engine") {
        try {
          const speech = await analyzeFrameWithSpatialEngine(frame);
          announcement = speech ?? "No new guidance";
          detectedCount = speech ? 1 : 0;
        } catch (engineError) {
          console.error(
            "Spatial engine failed, falling back to object detection",
            engineError,
          );
          const fallbackResult: DetectionResult =
            await detectObjectsInFrame(frame);
          announcement = formatDetectionForSpeech(fallbackResult);
          detectedCount = fallbackResult.objects.length;
        }
      } else {
        const result: DetectionResult = await detectObjectsInFrame(frame);
        announcement = formatDetectionForSpeech(result);
        detectedCount = result.objects.length;
      }

      speak(announcement);
      setObjectsDetected((prev) => prev + detectedCount);
      setCurrentDetections((prev) => [...prev, announcement]);
    } catch (error) {
      console.error("Error processing frame:", error);
    } finally {
      isProcessingRef.current = false;
    }
  };

  const startSightline = async (mode: ScanMode) => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        setAppState("error");
        speak("Camera permission denied. Please enable camera access.");
        return;
      }
    }

    setScanMode(mode);
    setAppState("running");
    setObjectsDetected(0);
    setSessionTime("0:00");
    setCurrentDetections([]);
    setCapturedFrameUri(null);
    startTimeRef.current = Date.now();

    speak(
      mode === "engine"
        ? "Spatial engine active. Scanning space and nearby objects."
        : "SightViz active. Scanning nearby objects.",
    );
    AccessibilityInfo.announceForAccessibility("SightViz running");

    timerIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      setSessionTime(`${minutes}:${seconds.toString().padStart(2, "0")}`);
    }, 1000);

    setTimeout(() => {
      if (cameraRef.current) {
        const stopCapture = startFrameCapture(
          cameraRef as React.RefObject<CameraView>,
          handleFrameCaptured,
          3000,
        );
        stopCaptureRef.current = stopCapture;
      }
    }, 900);
  };

  const stopSightline = () => {
    isProcessingRef.current = false;

    const durationSeconds = Math.floor(
      (Date.now() - startTimeRef.current) / 1000,
    );
    const minutes = Math.floor(durationSeconds / 60);
    const seconds = durationSeconds % 60;
    const finalDuration = `${minutes}:${seconds.toString().padStart(2, "0")}`;

    setSessionHistory((prev) => [
      {
        id: Date.now().toString(),
        duration: finalDuration,
        durationSeconds,
        objectsDetected,
        timestamp: new Date(),
        detections: [...currentDetections],
      },
      ...prev,
    ]);

    setAppState("idle");

    if (stopCaptureRef.current) {
      stopCaptureRef.current();
      stopCaptureRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    Speech.stop();
    speak(
      `Scanning stopped. ${objectsDetected} objects detected in ${finalDuration}.`,
    );
    AccessibilityInfo.announceForAccessibility("SightViz stopped");
  };

  const handlePrimaryToggle = (mode: ScanMode) => {
    if (appState === "running") {
      stopSightline();
      return;
    }
    startSightline(mode);
  };

  // Load enrolled faces from server on mount
  useEffect(() => {
    fetchEnrolledFaces()
      .then(setServerFaces)
      .catch((err) => console.warn("[Faces] Could not fetch enrolled faces:", err));
  }, []);

  const saveFaceProfile = async () => {
    const cleanName = faceNameDraft.trim();
    if (cleanName.length === 0 || faceShotsDraft.length < 3) {
      return;
    }

    setIsSavingFace(true);
    try {
      const result = await enrollFaceProfile(cleanName, faceShotsDraft);

      if (result.success) {
        // Refresh enrolled faces from server
        fetchEnrolledFaces().then(setServerFaces).catch(() => {});
        setFaceNameDraft("");
        setFaceShotsDraft([]);
        speak(`${cleanName} saved. ${result.enrolled} face angles enrolled.`);
      } else {
        speak("No faces detected in the captured photos. Please try again with clearer images.");
      }
    } catch (error) {
      console.error("Face enroll error:", error);
      speak("Failed to save face profile. Check your connection and try again.");
    } finally {
      setIsSavingFace(false);
    }
  };

  const captureFaceShot = async () => {
    if (faceShotsDraft.length >= 4) {
      speak("Maximum 4 angle shots captured.");
      return;
    }

    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        speak("Camera permission denied. Please enable camera access.");
        return;
      }
    }

    if (!cameraRef.current) {
      speak("Camera is not ready yet. Please try again.");
      return;
    }

    try {
      const shot = await cameraRef.current.takePictureAsync({
        quality: 0.65,
        skipProcessing: true,
      });

      if (!shot?.uri) {
        speak("Unable to capture image. Please retry.");
        return;
      }

      setFaceShotsDraft((prev) => [...prev, shot.uri]);
      setCapturedFrameUri(shot.uri);
      speak(`Captured angle ${faceShotsDraft.length + 1} of 4.`);
    } catch (error) {
      console.error("Error capturing face shot:", error);
      speak("Capture failed. Please try again.");
    }
  };

  const renderHomeContent = () => {
    const primaryText =
      appState === "running" && scanMode === "normal"
        ? "Stop Scanning"
        : "Start Scanning";

    return (
      <ScrollView
        style={styles.tabScroll}
        contentContainerStyle={styles.tabScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerTextWrap}>
            <View style={styles.brandRow}>
              <View style={styles.brandLogoWrap}>
                <View style={styles.brandLogoRing} />
                <Image
                  source={headerLogo}
                  style={styles.brandLogoInner}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.brandTitle}>SIGHTVIZ</Text>
            </View>
            <Text style={styles.brandSubtitle}>
              Real-time detection of nearby objects
            </Text>
          </View>
          <View
            style={[
              styles.activeBadge,
              appState === "running" && styles.activeBadgeRunning,
            ]}
          >
            <View style={styles.activeDot} />
            <Text style={styles.activeText}>
              {appState === "running" ? "ACTIVE" : "IDLE"}
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={styles.statCardLabelRow}>
              <MaterialIcons
                name="category"
                size={18}
                color={colors.textPrimary}
              />
              <Text style={styles.statCardLabel}>OBJECTS</Text>
            </View>
            <Text style={styles.statCardValue}>{objectsDetected}</Text>
            <Text style={styles.statCardHint}>objects detected</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statCardLabelRow}>
              <MaterialIcons
                name="schedule"
                size={18}
                color={colors.textPrimary}
              />
              <Text style={styles.statCardLabel}>TIME</Text>
            </View>
            <Text style={styles.statCardValue}>{sessionTime}</Text>
            <Text style={styles.statCardHint}>minutes taken</Text>
          </View>
        </View>

        <View style={styles.detectionCard}>
          <View style={styles.detectionHeaderRow}>
            <Text style={styles.detectionTitle}>Current Detection</Text>
            <Text style={styles.detectionAge}>{sessionTime}</Text>
          </View>
          <Text style={styles.detectionText}>
            {lastSpokenText ||
              "No detections yet. Start scanning to hear guidance."}
          </Text>
        </View>

        <View style={styles.liveCard}>
          <View style={styles.liveHeaderRow}>
            <Text style={styles.liveTitle}>Live Frame</Text>
            <MaterialIcons
              name="open-in-full"
              size={18}
              color={colors.textMuted}
            />
          </View>

          {capturedFrameUri ? (
            <Image
              source={{ uri: capturedFrameUri }}
              style={styles.liveImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.livePlaceholder}>
              <MaterialIcons name="image" size={26} color={colors.textMuted} />
              <Text style={styles.livePlaceholderText}>
                Frame preview appears while scanning
              </Text>
            </View>
          )}

          <Pressable
            onPress={() => handlePrimaryToggle("normal")}
            style={({ pressed }) => [
              styles.primaryButtonWrap,
              pressed && styles.primaryButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={primaryText}
          >
            <LinearGradient
              colors={
                appState === "running" && scanMode === "normal"
                  ? [...gradients.ctaRunning]
                  : [...gradients.ctaActive]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryButton}
            >
              <MaterialIcons
                name={
                  appState === "running" && scanMode === "normal"
                    ? "stop"
                    : "play-arrow"
                }
                size={20}
                color={colors.white}
              />
              <Text style={styles.primaryButtonText}>{primaryText}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </ScrollView>
    );
  };

  const renderHistoryContent = () => {
    return (
      <ScrollView
        style={styles.tabScroll}
        contentContainerStyle={styles.tabScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.historyHeader}>
          <Text style={styles.historyTitle}>History</Text>
          <Text style={styles.historySubtitle}>
            {sessionHistory.length > 0
              ? `${sessionHistory.length} ${sessionHistory.length === 1 ? "session" : "sessions"}`
              : "No sessions yet"}
          </Text>
        </View>

        {sessionHistory.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="history" size={42} color={colors.textMuted} />
            <Text style={styles.emptyStateTitle}>No session history yet</Text>
            <Text style={styles.emptyStateText}>
              Start scanning to create your first log.
            </Text>
          </View>
        ) : (
          sessionHistory.map((session) => (
            <View key={session.id} style={styles.historyCard}>
              <View style={styles.historyCardTop}>
                <Text style={styles.historyDate}>
                  {session.timestamp.toLocaleDateString()}{" "}
                  {session.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
                <Text style={styles.historyDuration}>{session.duration}</Text>
              </View>
              <View style={styles.historyStatsRow}>
                <View style={styles.historyStatMini}>
                  <Text style={styles.historyStatValue}>
                    {session.objectsDetected}
                  </Text>
                  <Text style={styles.historyStatLabel}>objects</Text>
                </View>
                <View style={styles.historyStatMini}>
                  <Text style={styles.historyStatValue}>
                    {session.detections.length}
                  </Text>
                  <Text style={styles.historyStatLabel}>detections</Text>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    );
  };

  const renderEngineContent = () => {
    const isEngineRunning = appState === "running" && scanMode === "engine";
    const primaryText = isEngineRunning
      ? "Stop Engine Scan"
      : "Start Engine Scan";

    return (
      <ScrollView
        style={styles.tabScroll}
        contentContainerStyle={styles.tabScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.engineHeader}>
          <Text style={styles.engineTitle}>Spatial Engine</Text>
          <Text style={styles.engineSubtitle}>
            Depth-aware scanning mode for richer scene understanding.
          </Text>
        </View>

        <View style={styles.engineCard}>
          <View style={styles.engineRow}>
            <Text style={styles.engineLabel}>Mode</Text>
            <Text style={styles.engineValue}>SPATIAL</Text>
          </View>
          <View style={styles.engineRow}>
            <Text style={styles.engineLabel}>Session</Text>
            <Text style={styles.engineValue}>{sessionTime}</Text>
          </View>
          <View style={styles.engineRow}>
            <Text style={styles.engineLabel}>Objects</Text>
            <Text style={styles.engineValue}>{objectsDetected}</Text>
          </View>
        </View>

        <View style={styles.detectionCard}>
          <View style={styles.detectionHeaderRow}>
            <Text style={styles.detectionTitle}>Spatial Detection</Text>
            <Text style={styles.detectionAge}>{sessionTime}</Text>
          </View>
          <Text style={styles.detectionText}>
            {lastSpokenText ||
              "No spatial detections yet. Start engine scan to begin."}
          </Text>
        </View>

        <View style={styles.liveCard}>
          <View style={styles.liveHeaderRow}>
            <Text style={styles.liveTitle}>Engine Live Feed</Text>
            <MaterialIcons
              name="open-in-full"
              size={18}
              color={colors.textMuted}
            />
          </View>

          {capturedFrameUri ? (
            <Image
              source={{ uri: capturedFrameUri }}
              style={styles.liveImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.livePlaceholder}>
              <MaterialIcons name="image" size={26} color={colors.textMuted} />
              <Text style={styles.livePlaceholderText}>
                Live preview appears while engine scanning
              </Text>
            </View>
          )}
        </View>

        <Pressable
          onPress={() => handlePrimaryToggle("engine")}
          style={({ pressed }) => [
            styles.primaryButtonWrap,
            pressed && styles.primaryButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={primaryText}
        >
          <LinearGradient
            colors={
              isEngineRunning
                ? [...gradients.ctaRunning]
                : [...gradients.ctaActive]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.primaryButton}
          >
            <MaterialIcons
              name={isEngineRunning ? "stop" : "radar"}
              size={20}
              color={colors.white}
            />
            <Text style={styles.primaryButtonText}>{primaryText}</Text>
          </LinearGradient>
        </Pressable>
      </ScrollView>
    );
  };

  const renderSaveFacesContent = () => {
    const canSave =
      faceNameDraft.trim().length > 0 && faceShotsDraft.length >= 3;

    return (
      <ScrollView
        style={styles.tabScroll}
        contentContainerStyle={styles.tabScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.engineHeader}>
          <Text style={styles.engineTitle}>Save Faces</Text>
          <Text style={styles.engineSubtitle}>
            Capture 3-4 angles and save a person with a name for recognition.
          </Text>
        </View>

        <View style={styles.faceCard}>
          <Text style={styles.faceLabel}>Person Name</Text>
          <TextInput
            value={faceNameDraft}
            onChangeText={setFaceNameDraft}
            placeholder="Enter name"
            placeholderTextColor={colors.textMuted}
            style={styles.faceInput}
          />

          <View style={styles.faceCaptureRow}>
            <Pressable
              style={styles.faceCaptureButton}
              onPress={captureFaceShot}
            >
              <MaterialIcons
                name="photo-camera"
                size={16}
                color={colors.white}
              />
              <Text style={styles.faceCaptureText}>Add Angle Shot</Text>
            </Pressable>
            <Pressable
              style={styles.faceResetButton}
              onPress={() => setFaceShotsDraft([])}
            >
              <Text style={styles.faceResetText}>Reset</Text>
            </Pressable>
          </View>

          <Text style={styles.faceProgressText}>
            Captured shots: {faceShotsDraft.length}/4 (minimum 3 required)
          </Text>

          {faceShotsDraft.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.faceShotsRow}
            >
              {faceShotsDraft.map((uri, index) => (
                <Image
                  key={`${uri}-${index}`}
                  source={{ uri }}
                  style={styles.faceShotThumb}
                />
              ))}
            </ScrollView>
          )}

          <Pressable
            onPress={saveFaceProfile}
            disabled={!canSave || isSavingFace}
            style={({ pressed }) => [
              styles.faceSaveButton,
              (!canSave || isSavingFace) && styles.faceSaveButtonDisabled,
              pressed && canSave && !isSavingFace && styles.primaryButtonPressed,
            ]}
          >
            <Text style={styles.faceSaveText}>
              {isSavingFace ? "Saving…" : "Save Face Profile"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.faceCard}>
          <Text style={styles.faceLabel}>Saved Profiles</Text>
          {serverFaces.length === 0 ? (
            <Text style={styles.faceProgressText}>
              No saved faces yet. Add a profile to enable name-based
              recognition.
            </Text>
          ) : (
            serverFaces.map((profile) => (
              <View key={profile.name} style={styles.savedFaceRow}>
                <View>
                  <Text style={styles.savedFaceName}>{profile.name}</Text>
                  <Text style={styles.savedFaceMeta}>
                    {profile.photoCount} angles enrolled
                  </Text>
                </View>
                <MaterialIcons
                  name="verified"
                  size={18}
                  color={colors.success}
                />
              </View>
            ))
          )}
        </View>
      </ScrollView>
    );
  };

  const renderMoreMenu = () => {
    return (
      <ScrollView
        style={styles.tabScroll}
        contentContainerStyle={styles.tabScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.engineHeader}>
          <Text style={styles.engineTitle}>More</Text>
          <Text style={styles.engineSubtitle}>
            Settings, history, app info, and future pages live here.
          </Text>
        </View>

        <Pressable
          style={styles.moreRow}
          onPress={() => setMoreSection("settings")}
        >
          <View style={styles.moreRowLeft}>
            <MaterialIcons
              name="settings"
              size={18}
              color={colors.textPrimary}
            />
            <Text style={styles.moreRowText}>Settings</Text>
          </View>
          <MaterialIcons
            name="chevron-right"
            size={20}
            color={colors.textMuted}
          />
        </Pressable>

        <Pressable
          style={styles.moreRow}
          onPress={() => setMoreSection("history")}
        >
          <View style={styles.moreRowLeft}>
            <MaterialIcons
              name="history"
              size={18}
              color={colors.textPrimary}
            />
            <Text style={styles.moreRowText}>History</Text>
          </View>
          <MaterialIcons
            name="chevron-right"
            size={20}
            color={colors.textMuted}
          />
        </Pressable>

        <Pressable
          style={styles.moreRow}
          onPress={() => setMoreSection("about")}
        >
          <View style={styles.moreRowLeft}>
            <MaterialIcons
              name="info-outline"
              size={18}
              color={colors.textPrimary}
            />
            <Text style={styles.moreRowText}>About & Version</Text>
          </View>
          <MaterialIcons
            name="chevron-right"
            size={20}
            color={colors.textMuted}
          />
        </Pressable>

        <View style={styles.moreFutureCard}>
          <Text style={styles.moreFutureTitle}>Future Pages</Text>
          <Text style={styles.moreFutureText}>
            New pages will be added under More to keep the bottom bar focused.
          </Text>
        </View>
      </ScrollView>
    );
  };

  const renderMoreSubHeader = (title: string) => (
    <View style={styles.moreSubHeader}>
      <Pressable
        onPress={() => setMoreSection("menu")}
        style={styles.moreBackBtn}
      >
        <MaterialIcons name="arrow-back" size={18} color={colors.textPrimary} />
      </Pressable>
      <Text style={styles.moreSubTitle}>{title}</Text>
      <View style={styles.moreBackBtnSpacer} />
    </View>
  );

  const renderMoreContent = () => {
    if (moreSection === "menu") {
      return renderMoreMenu();
    }

    if (moreSection === "settings") {
      return (
        <View style={styles.contentArea}>
          {renderMoreSubHeader("Settings")}
          <SettingsPanel
            language={speechLanguage}
            onChangeLanguage={setSpeechLanguage}
            audioLevel={audioLevel}
            onChangeAudioLevel={handleAudioLevelChange}
            muted={isMuted}
            onToggleMuted={handleMutedChange}
          />
        </View>
      );
    }

    if (moreSection === "history") {
      return (
        <View style={styles.contentArea}>
          {renderMoreSubHeader("History")}
          {renderHistoryContent()}
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.tabScroll}
        contentContainerStyle={styles.tabScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderMoreSubHeader("About & Version")}
        <View style={styles.moreFutureCard}>
          <Text style={styles.moreFutureTitle}>SightViz</Text>
          <Text style={styles.moreFutureText}>Version 1.0.0</Text>
          <Text style={styles.moreFutureText}>
            AI-powered accessibility assistant for object and scene awareness.
          </Text>
        </View>
      </ScrollView>
    );
  };

  const renderContent = () => {
    if (activeTab === "home") return renderHomeContent();
    if (activeTab === "engine") return renderEngineContent();
    if (activeTab === "saveFaces") return renderSaveFacesContent();
    return renderMoreContent();
  };

  return (
    <View style={styles.root}>
      <CameraComponent
        ref={cameraRef}
        isActive={appState === "running" || activeTab === "saveFaces"}
      />

      <LinearGradient
        colors={gradients.screen as any}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
          <View style={styles.contentArea}>{renderContent()}</View>

          <View style={styles.bottomBar}>
            <Pressable
              style={styles.tabItem}
              onPress={() => setActiveTab("home")}
            >
              <View
                style={[
                  styles.tabIconBg,
                  activeTab === "home" && styles.tabIconBgActive,
                ]}
              >
                <MaterialIcons
                  name="home"
                  size={22}
                  color={
                    activeTab === "home" ? colors.textPrimary : colors.textMuted
                  }
                />
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  activeTab === "home" && styles.tabLabelActive,
                ]}
              >
                Home
              </Text>
            </Pressable>

            <Pressable
              style={styles.tabItem}
              onPress={() => setActiveTab("engine")}
            >
              <View
                style={[
                  styles.tabIconBg,
                  activeTab === "engine" && styles.tabIconBgActive,
                ]}
              >
                <MaterialIcons
                  name="radar"
                  size={22}
                  color={
                    activeTab === "engine"
                      ? colors.textPrimary
                      : colors.textMuted
                  }
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

            <Pressable
              style={styles.tabItem}
              onPress={() => setActiveTab("saveFaces")}
            >
              <View
                style={[
                  styles.tabIconBg,
                  activeTab === "saveFaces" && styles.tabIconBgActive,
                ]}
              >
                <MaterialIcons
                  name="face-retouching-natural"
                  size={22}
                  color={
                    activeTab === "saveFaces"
                      ? colors.textPrimary
                      : colors.textMuted
                  }
                />
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  activeTab === "saveFaces" && styles.tabLabelActive,
                ]}
              >
                Save Faces
              </Text>
            </Pressable>

            <Pressable
              style={styles.tabItem}
              onPress={() => {
                setActiveTab("more");
                setMoreSection("menu");
              }}
            >
              <View
                style={[
                  styles.tabIconBg,
                  activeTab === "more" && styles.tabIconBgActive,
                ]}
              >
                <MaterialIcons
                  name="menu"
                  size={22}
                  color={
                    activeTab === "more" ? colors.textPrimary : colors.textMuted
                  }
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

const createStyles = () =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.bgPage,
    },
    gradient: {
      flex: 1,
    },
    safeArea: {
      flex: 1,
    },
    contentArea: {
      flex: 1,
    },
    tabScroll: {
      flex: 1,
    },
    tabScrollContent: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xl,
      gap: spacing.md,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginTop: spacing.sm,
      gap: spacing.sm,
    },
    headerTextWrap: {
      flex: 1,
      minWidth: 0,
      paddingRight: spacing.sm,
    },
    brandRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    brandLogoWrap: {
      width: 30,
      height: 30,
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      flexShrink: 0,
      borderRadius: 15,
      overflow: "hidden",
      backgroundColor: "rgba(255, 255, 255, 0.9)",
      borderWidth: 2,
      borderColor: colors.brand,
    },
    brandLogoRing: {
      position: "absolute",
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.brand,
      opacity: 0.35,
    },
    brandLogoInner: {
      width: 30,
      height: 30,
      borderRadius: 15,
    },
    brandTitle: {
      fontFamily: "Inter_700Bold",
      fontSize: 28,
      color: colors.textPrimary,
      letterSpacing: 0.4,
    },
    brandSubtitle: {
      fontFamily: "Inter_400Regular",
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 4,
      lineHeight: 18,
    },
    activeBadge: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 6,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 16,
      backgroundColor: colors.bgInactive,
    },
    activeBadgeRunning: {
      backgroundColor: "rgba(16, 185, 129, 0.15)",
    },
    activeDot: {
      width: 8,
      height: 8,
      borderRadius: 99,
      backgroundColor: colors.success,
    },
    activeText: {
      fontFamily: "Inter_700Bold",
      fontSize: 10,
      color: colors.success,
      letterSpacing: 0.3,
    },
    statsRow: {
      flexDirection: "row",
      gap: spacing.md,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.bgCard,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      ...shadows.card,
    },
    statCardLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: spacing.md,
    },
    statCardLabel: {
      fontFamily: "Inter_500Medium",
      fontSize: 12,
      color: colors.textPrimary,
      letterSpacing: 0.4,
    },
    statCardValue: {
      fontFamily: "Inter_700Bold",
      fontSize: 28,
      color: colors.textPrimary,
      marginBottom: 4,
    },
    statCardHint: {
      fontFamily: "Inter_400Regular",
      fontSize: 12,
      color: colors.textMuted,
    },
    detectionCard: {
      backgroundColor: colors.bgCard,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      ...shadows.card,
    },
    detectionHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    detectionTitle: {
      fontFamily: "Inter_700Bold",
      fontSize: 20,
      color: colors.textPrimary,
      flex: 1,
      minWidth: 0,
      marginRight: spacing.sm,
    },
    detectionAge: {
      fontFamily: "Inter_500Medium",
      fontSize: 14,
      color: colors.textPrimary,
      opacity: 0.9,
    },
    detectionText: {
      fontFamily: "Inter_400Regular",
      fontSize: 16,
      color: colors.textPrimary,
      lineHeight: 22,
    },
    liveCard: {
      backgroundColor: colors.bgCard,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      ...shadows.card,
    },
    liveHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.md,
    },
    liveTitle: {
      fontFamily: "Inter_700Bold",
      fontSize: 24,
      color: colors.textPrimary,
    },
    liveImage: {
      width: "100%",
      height: 180,
      borderRadius: radius.sm,
      marginBottom: spacing.lg,
    },
    livePlaceholder: {
      height: 180,
      borderRadius: radius.sm,
      backgroundColor: colors.bgInactive,
      justifyContent: "center",
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    livePlaceholderText: {
      fontFamily: "Inter_400Regular",
      fontSize: 14,
      color: colors.textMuted,
    },
    primaryButtonWrap: {
      borderRadius: radius.md,
      overflow: "hidden",
      ...shadows.button,
    },
    primaryButtonPressed: {
      opacity: 0.85,
      transform: [{ scale: 0.99 }],
    },
    primaryButton: {
      height: 56,
      borderRadius: radius.md,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
    },
    primaryButtonText: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 18,
      color: colors.white,
    },
    historyHeader: {
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    historyTitle: {
      fontFamily: "Inter_700Bold",
      fontSize: 26,
      color: colors.textPrimary,
    },
    historySubtitle: {
      fontFamily: "Inter_400Regular",
      fontSize: 15,
      color: colors.textMuted,
      marginTop: 4,
    },
    emptyState: {
      backgroundColor: colors.bgCard,
      borderRadius: radius.lg,
      padding: spacing.xxl,
      alignItems: "center",
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      ...shadows.card,
    },
    emptyStateTitle: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 18,
      color: colors.textPrimary,
    },
    emptyStateText: {
      fontFamily: "Inter_400Regular",
      fontSize: 14,
      color: colors.textMuted,
      textAlign: "center",
    },
    historyCard: {
      backgroundColor: colors.bgCard,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      ...shadows.card,
    },
    historyCardTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.md,
    },
    historyDate: {
      fontFamily: "Inter_500Medium",
      fontSize: 13,
      color: colors.textMuted,
      flex: 1,
      marginRight: spacing.md,
    },
    historyDuration: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 15,
      color: colors.textPrimary,
    },
    historyStatsRow: {
      flexDirection: "row",
      gap: spacing.md,
    },
    historyStatMini: {
      flex: 1,
      backgroundColor: colors.bgInactive,
      borderRadius: radius.sm,
      padding: spacing.md,
      alignItems: "center",
      gap: 2,
    },
    historyStatValue: {
      fontFamily: "Inter_700Bold",
      fontSize: 22,
      color: colors.textPrimary,
    },
    historyStatLabel: {
      fontFamily: "Inter_400Regular",
      fontSize: 12,
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    bottomBar: {
      flexDirection: "row",
      borderTopWidth: 1,
      borderTopColor: colors.borderSubtle,
      backgroundColor: colors.bgCard,
      paddingTop: 8,
      paddingBottom: 10,
      paddingHorizontal: spacing.lg,
      ...shadows.bar,
    },
    tabItem: {
      flex: 1,
      alignItems: "center",
      gap: 4,
    },
    tabIconBg: {
      width: 40,
      height: 40,
      borderRadius: radius.sm,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "transparent",
    },
    tabIconBgActive: {
      backgroundColor: colors.primary,
      opacity: 0.9,
    },
    tabLabel: {
      fontFamily: "Inter_500Medium",
      fontSize: 11,
      color: colors.textMuted,
      textAlign: "center",
    },
    tabLabelActive: {
      color: colors.textPrimary,
      fontFamily: "Inter_600SemiBold",
    },
    engineHeader: {
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
      gap: 6,
    },
    engineTitle: {
      fontFamily: "Inter_700Bold",
      fontSize: 26,
      color: colors.textPrimary,
    },
    engineSubtitle: {
      fontFamily: "Inter_400Regular",
      fontSize: 14,
      lineHeight: 20,
      color: colors.textMuted,
    },
    engineCard: {
      backgroundColor: colors.bgCard,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      ...shadows.card,
      gap: spacing.md,
    },
    engineRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    engineLabel: {
      fontFamily: "Inter_500Medium",
      fontSize: 13,
      color: colors.textMuted,
    },
    engineValue: {
      fontFamily: "Inter_700Bold",
      fontSize: 16,
      color: colors.textPrimary,
    },
    faceCard: {
      backgroundColor: colors.bgCard,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      ...shadows.card,
      gap: spacing.md,
    },
    faceLabel: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 14,
      color: colors.textPrimary,
    },
    faceInput: {
      backgroundColor: colors.bgInactive,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      color: colors.textPrimary,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      fontFamily: "Inter_400Regular",
      fontSize: 14,
    },
    faceCaptureRow: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    faceCaptureButton: {
      flex: 1,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.primary,
      borderRadius: radius.sm,
      paddingVertical: 10,
    },
    faceCaptureText: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 12,
      color: colors.white,
    },
    faceResetButton: {
      paddingHorizontal: spacing.md,
      borderRadius: radius.sm,
      justifyContent: "center",
      backgroundColor: colors.bgInactive,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    faceResetText: {
      fontFamily: "Inter_500Medium",
      fontSize: 12,
      color: colors.textPrimary,
    },
    faceProgressText: {
      fontFamily: "Inter_400Regular",
      fontSize: 13,
      color: colors.textMuted,
      lineHeight: 18,
    },
    faceShotsRow: {
      gap: spacing.sm,
    },
    faceShotThumb: {
      width: 72,
      height: 72,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      backgroundColor: colors.bgInactive,
    },
    faceSaveButton: {
      borderRadius: radius.sm,
      backgroundColor: colors.success,
      alignItems: "center",
      paddingVertical: 11,
    },
    faceSaveButtonDisabled: {
      opacity: 0.45,
    },
    faceSaveText: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 13,
      color: colors.white,
    },
    savedFaceRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderTopWidth: 1,
      borderTopColor: colors.borderSubtle,
      paddingTop: spacing.md,
    },
    savedFaceName: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 14,
      color: colors.textPrimary,
    },
    savedFaceMeta: {
      fontFamily: "Inter_400Regular",
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    moreRow: {
      backgroundColor: colors.bgCard,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    moreRowLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    moreRowText: {
      fontFamily: "Inter_500Medium",
      fontSize: 14,
      color: colors.textPrimary,
    },
    moreFutureCard: {
      backgroundColor: colors.bgCard,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      padding: spacing.lg,
      gap: 8,
      ...shadows.card,
    },
    moreFutureTitle: {
      fontFamily: "Inter_700Bold",
      fontSize: 18,
      color: colors.textPrimary,
    },
    moreFutureText: {
      fontFamily: "Inter_400Regular",
      fontSize: 14,
      lineHeight: 20,
      color: colors.textMuted,
    },
    moreSubHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    moreBackBtn: {
      width: 30,
      height: 30,
      borderRadius: 999,
      backgroundColor: colors.bgInactive,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    moreBackBtnSpacer: {
      width: 30,
      height: 30,
    },
    moreSubTitle: {
      fontFamily: "Inter_700Bold",
      fontSize: 20,
      color: colors.textPrimary,
    },
  });
