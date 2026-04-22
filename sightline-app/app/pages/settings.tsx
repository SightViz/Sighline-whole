import { SettingsPanel, type SpeechLanguage } from "@/components/settings-panel";
import { gradients } from "@/constants/design-system";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Standalone settings page — manages its own state when opened outside index.tsx
export default function SettingsScreen() {
  const [language, setLanguage] = useState<SpeechLanguage>("English");
  const [audioLevel, setAudioLevel] = useState(90);
  const [muted, setMuted] = useState(false);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <LinearGradient
        colors={gradients.screen as any}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.container}>
        <SettingsPanel
          language={language}
          onChangeLanguage={setLanguage}
          audioLevel={audioLevel}
          onChangeAudioLevel={setAudioLevel}
          muted={muted}
          onToggleMuted={setMuted}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
});
