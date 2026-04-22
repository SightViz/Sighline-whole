import {
  colors,
  gradients,
  radius,
  shadows,
  spacing,
} from "@/constants/design-system";
import { performOCR, chatWithDocument, type OCRResult } from "@/services/ocrService";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface TextScanPanelProps {
  /** Triggers camera capture and returns the local URI of the photo, or null on failure. */
  captureImage: () => Promise<string | null>;
  /** Speak a message aloud using the app's shared TTS engine. */
  speak: (text: string) => void;
}

type ScanState = "idle" | "capturing" | "processing" | "done";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function TextScanPanel({ captureImage, speak }: TextScanPanelProps) {
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [showFullText, setShowFullText] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatScrollRef = useRef<ScrollView>(null);

  // ── Scan handler ─────────────────────────────────────────────────────────

  const handleScanDocument = async () => {
    setScanState("capturing");
    setError(null);

    let uri: string | null = null;
    try {
      uri = await captureImage();
    } catch {
      setScanState("idle");
      speak("Could not capture image. Please try again.");
      return;
    }

    if (!uri) {
      setScanState("idle");
      speak("Camera not ready. Please try again.");
      return;
    }

    setCapturedUri(uri);
    setScanState("processing");

    try {
      const result = await performOCR(uri);
      setOcrResult(result);
      setChatMessages([]);
      setShowFullText(false);
      setScanState("done");
      speak(result.summary);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Scan failed. Please try again.";
      setError(msg);
      setScanState("idle");
      speak("Document scan failed. Please check your connection and try again.");
    }
  };

  // ── Chat handler ─────────────────────────────────────────────────────────

  const handleSendChat = async () => {
    const question = chatInput.trim();
    if (!question || !ocrResult || isChatLoading) return;

    Keyboard.dismiss();
    const userMsg: ChatMessage = {
      id: `${Date.now()}-u`,
      role: "user",
      text: question,
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const answer = await chatWithDocument(ocrResult.text, question);
      setChatMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-a`, role: "assistant", text: answer },
      ]);
      speak(answer);
      setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 120);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-err`,
          role: "assistant",
          text: "Sorry, I could not answer that question. Please try again.",
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleReset = () => {
    setScanState("idle");
    setCapturedUri(null);
    setOcrResult(null);
    setChatMessages([]);
    setChatInput("");
    setError(null);
    setShowFullText(false);
  };

  // ── Render: processing spinner ────────────────────────────────────────────

  if (scanState === "processing") {
    return (
      <View style={styles.loadingOuter}>
        <View style={styles.loadingCard}>
          {capturedUri && (
            <Image
              source={{ uri: capturedUri }}
              style={styles.loadingThumb}
              resizeMode="cover"
            />
          )}
          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={{ marginTop: spacing.lg }}
          />
          <Text style={styles.loadingTitle}>Reading Document…</Text>
          <Text style={styles.loadingSubtitle}>
            AI is extracting text and generating your summary
          </Text>
        </View>
      </View>
    );
  }

  // ── Render: scan result + chat ────────────────────────────────────────────

  if (scanState === "done" && ocrResult) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <ScrollView
          ref={chatScrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.resultHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Scan Result</Text>
              <Text style={styles.subtitle}>
                Summary is spoken automatically. Ask questions below.
              </Text>
            </View>
            <Pressable onPress={handleReset} style={styles.scanAgainBtn}>
              <MaterialIcons name="refresh" size={14} color={colors.primary} />
              <Text style={styles.scanAgainText}>New Scan</Text>
            </Pressable>
          </View>

          {/* Document thumbnail */}
          {capturedUri && (
            <View style={styles.thumbCard}>
              <Image
                source={{ uri: capturedUri }}
                style={styles.docThumb}
                resizeMode="cover"
              />
            </View>
          )}

          {/* AI Summary */}
          <View style={styles.summaryCard}>
            <View style={styles.sectionLabelRow}>
              <MaterialIcons name="auto-awesome" size={16} color={colors.primary} />
              <Text style={styles.sectionLabel}>AI Summary</Text>
            </View>
            <Text style={styles.summaryText}>{ocrResult.summary}</Text>
            <Pressable
              onPress={() => speak(ocrResult.summary)}
              style={({ pressed }) => [
                styles.speakBtn,
                pressed && { opacity: 0.8 },
              ]}
            >
              <LinearGradient
                colors={[...gradients.ctaActive]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.speakBtnGradient}
              >
                <MaterialIcons name="volume-up" size={16} color={colors.white} />
                <Text style={styles.speakBtnText}>Play Summary</Text>
              </LinearGradient>
            </Pressable>
          </View>

          {/* OCR text collapsible */}
          <Pressable
            style={styles.ocrToggleRow}
            onPress={() => setShowFullText((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={
              showFullText ? "Hide extracted text" : "Show extracted text"
            }
          >
            <Text style={styles.ocrToggleText}>
              {showFullText ? "Hide Extracted Text" : "Show Extracted Text"}
            </Text>
            <MaterialIcons
              name={showFullText ? "expand-less" : "expand-more"}
              size={20}
              color={colors.textMuted}
            />
          </Pressable>

          {showFullText && (
            <View style={styles.ocrTextCard}>
              <Text style={styles.ocrText} selectable>
                {ocrResult.text || "No text could be extracted from this image."}
              </Text>
            </View>
          )}

          {/* Chat divider */}
          <View style={styles.chatDivider}>
            <View style={styles.chatDividerLine} />
            <View style={styles.chatDividerLabel}>
              <MaterialIcons name="chat" size={14} color={colors.primary} />
              <Text style={styles.chatDividerText}>Ask About This Document</Text>
            </View>
            <View style={styles.chatDividerLine} />
          </View>

          {/* Chat empty state */}
          {chatMessages.length === 0 && (
            <View style={styles.chatEmptyCard}>
              <MaterialIcons
                name="help-outline"
                size={28}
                color={colors.textMuted}
              />
              <Text style={styles.chatEmptyTitle}>Have questions?</Text>
              <Text style={styles.chatEmptyText}>
                Type a question below — answers will be spoken aloud.
              </Text>
              <View style={styles.chatSuggestionRow}>
                {["What type of document is this?", "Who is this addressed to?", "What is the date?"].map(
                  (q) => (
                    <Pressable
                      key={q}
                      style={styles.chatSuggestion}
                      onPress={() => {
                        setChatInput(q);
                      }}
                    >
                      <Text style={styles.chatSuggestionText}>{q}</Text>
                    </Pressable>
                  )
                )}
              </View>
            </View>
          )}

          {/* Chat messages */}
          {chatMessages.map((msg) => (
            <View
              key={msg.id}
              style={[
                styles.bubble,
                msg.role === "user" ? styles.bubbleUser : styles.bubbleAssistant,
              ]}
            >
              <Text
                style={[
                  styles.bubbleText,
                  msg.role === "user"
                    ? styles.bubbleTextUser
                    : styles.bubbleTextAssistant,
                ]}
              >
                {msg.text}
              </Text>
            </View>
          ))}

          {/* Typing indicator */}
          {isChatLoading && (
            <View style={[styles.bubble, styles.bubbleAssistant]}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          )}

          {/* Chat input */}
          <View style={styles.chatInputRow}>
            <TextInput
              value={chatInput}
              onChangeText={setChatInput}
              placeholder="Ask a question about the document…"
              placeholderTextColor={colors.textMuted}
              style={styles.chatInput}
              returnKeyType="send"
              onSubmitEditing={handleSendChat}
              editable={!isChatLoading}
              multiline={false}
            />
            <Pressable
              onPress={handleSendChat}
              disabled={!chatInput.trim() || isChatLoading}
              style={({ pressed }) => [
                styles.sendBtn,
                (!chatInput.trim() || isChatLoading) && styles.sendBtnDisabled,
                pressed && { opacity: 0.8 },
              ]}
            >
              <MaterialIcons name="send" size={18} color={colors.white} />
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Render: idle / capture (also shown on error, with last image) ────────

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Text Scanning</Text>
        <Text style={styles.subtitle}>
          Point your camera at any document — letter, label, book, sign — and
          tap Scan. The app will extract the text and read you a smart summary.
        </Text>
      </View>

      {error && (
        <View style={styles.errorCard}>
          <MaterialIcons name="error-outline" size={16} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Scan card — shows last captured image if available, else camera hint */}
      <View style={styles.scanCard}>
        {capturedUri ? (
          <Image
            source={{ uri: capturedUri }}
            style={styles.capturedPreview}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.livePlaceholder}>
            <MaterialIcons
              name="document-scanner"
              size={42}
              color={colors.textMuted}
            />
            <Text style={styles.livePlaceholderText}>
              Camera preview is live behind this panel.
            </Text>
            <Text style={styles.livePlaceholderHint}>
              Aim at the document you want to read.
            </Text>
          </View>
        )}

        <Pressable
          onPress={handleScanDocument}
          disabled={scanState === "capturing"}
          style={({ pressed }) => [
            styles.scanBtnWrap,
            pressed && { opacity: 0.88, transform: [{ scale: 0.99 }] },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Scan document"
        >
          <LinearGradient
            colors={[...gradients.ctaActive]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.scanBtn}
          >
            {scanState === "capturing" ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <MaterialIcons
                name="document-scanner"
                size={20}
                color={colors.white}
              />
            )}
            <Text style={styles.scanBtnText}>
              {scanState === "capturing"
                ? "Capturing…"
                : capturedUri
                ? "Scan Again"
                : "Scan Document"}
            </Text>
          </LinearGradient>
        </Pressable>
      </View>

      {/* Tips */}
      <View style={styles.tipsCard}>
        <Text style={styles.tipsTitle}>Tips for Best Results</Text>
        {[
          { icon: "light-mode" as const, text: "Use good, even lighting" },
          {
            icon: "crop-free" as const,
            text: "Fill the frame with the document",
          },
          {
            icon: "straighten" as const,
            text: "Hold the phone flat and steady",
          },
          {
            icon: "text-fields" as const,
            text: "Works with printed & handwritten text",
          },
        ].map(({ icon, text }) => (
          <View key={text} style={styles.tipRow}>
            <MaterialIcons name={icon} size={15} color={colors.primary} />
            <Text style={styles.tipText}>{text}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl + spacing.xl,
    gap: spacing.md,
  },

  // Header (idle)
  header: { marginTop: spacing.sm, gap: 6 },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    color: colors.textPrimary,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },

  // Error banner
  errorCard: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
    backgroundColor: colors.errorLight,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.error,
    padding: spacing.md,
  },
  errorText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: colors.error,
    lineHeight: 18,
  },

  // Scan card (idle state main card)
  scanCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  capturedPreview: {
    width: "100%",
    height: 220,
    borderRadius: radius.sm,
  },
  livePlaceholder: {
    height: 170,
    borderRadius: radius.sm,
    backgroundColor: colors.bgInactive,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.sm,
  },
  livePlaceholderText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    paddingHorizontal: spacing.lg,
  },
  livePlaceholderHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
  },
  scanBtnWrap: {
    borderRadius: radius.md,
    overflow: "hidden",
    ...shadows.button,
  },
  scanBtn: {
    height: 54,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    borderRadius: radius.md,
  },
  scanBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    color: colors.white,
  },

  // Tips card
  tipsCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.card,
  },
  tipsTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  tipText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },

  // Processing state
  loadingOuter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  loadingCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.xxl,
    alignItems: "center",
    gap: spacing.md,
    width: "100%",
    ...shadows.card,
  },
  loadingThumb: {
    width: "100%",
    height: 140,
    borderRadius: radius.sm,
  },
  loadingTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: colors.textPrimary,
  },
  loadingSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },

  // Result header
  resultHeaderRow: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  scanAgainBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.bgInactive,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  scanAgainText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: colors.primary,
  },

  // Document thumbnail
  thumbCard: {
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.card,
  },
  docThumb: {
    width: "100%",
    height: 200,
  },

  // Summary card
  summaryCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: colors.primary,
    letterSpacing: 0.3,
  },
  summaryText: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  speakBtn: {
    borderRadius: radius.sm,
    overflow: "hidden",
  },
  speakBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
  speakBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: colors.white,
  },

  // OCR text toggle
  ocrToggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.bgCard,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  ocrToggleText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: colors.textMuted,
  },
  ocrTextCard: {
    backgroundColor: colors.bgInactive,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.lg,
  },
  ocrText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 20,
    color: colors.textPrimary,
  },

  // Chat divider
  chatDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  chatDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderSubtle,
  },
  chatDividerLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  chatDividerText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: colors.primary,
    letterSpacing: 0.3,
  },

  // Chat empty state
  chatEmptyCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
    ...shadows.card,
  },
  chatEmptyTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: colors.textPrimary,
  },
  chatEmptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 18,
  },
  chatSuggestionRow: {
    width: "100%",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  chatSuggestion: {
    backgroundColor: colors.bgInactive,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  chatSuggestionText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: colors.textPrimary,
  },

  // Chat bubbles
  bubble: {
    maxWidth: "85%",
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bubbleUser: {
    alignSelf: "flex-end",
    backgroundColor: colors.primary,
  },
  bubbleAssistant: {
    alignSelf: "flex-start",
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  bubbleTextUser: {
    fontFamily: "Inter_400Regular",
    color: colors.white,
  },
  bubbleTextAssistant: {
    fontFamily: "Inter_400Regular",
    color: colors.textPrimary,
  },

  // Chat input row
  chatInputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  chatInput: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: colors.textPrimary,
    minHeight: 44,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
});
