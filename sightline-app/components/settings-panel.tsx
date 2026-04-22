import { colors } from "@/constants/design-system";
import { MaterialIcons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import React, { useState } from "react";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    View,
} from "react-native";

export type SpeechLanguage = "Hindi" | "English";
type Verbosity = "Minimal" | "Normal" | "Detailed";

function SectionCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        {icon}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmentedRow}>
      {options.map((opt) => (
        <Pressable
          key={opt}
          style={[
            styles.segmentButton,
            value === opt && styles.segmentButtonActive,
          ]}
          onPress={() => onChange(opt)}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === opt }}
          accessibilityLabel={opt}
        >
          <Text
            style={[
              styles.segmentText,
              value === opt && styles.segmentTextActive,
            ]}
          >
            {opt}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function SliderRow({
  min = 0,
  max = 100,
  value,
  onChange,
  disabled = false,
}: {
  min?: number;
  max?: number;
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.sliderWrapper}>
      <Slider
        minimumValue={min}
        maximumValue={max}
        value={value}
        onValueChange={onChange}
        minimumTrackTintColor={colors.primary}
        maximumTrackTintColor={colors.trackInactive}
        thumbTintColor={colors.primary}
        disabled={disabled}
      />
      <View style={styles.sliderLabels}>
        <Text style={styles.sliderLabel}>{min}</Text>
        <Text style={styles.sliderLabel}>{Math.round(value)}</Text>
        <Text style={styles.sliderLabel}>{max}</Text>
      </View>
    </View>
  );
}

function SettingRow({
  label,
  subtitle,
  value,
  onToggle,
}: {
  label: string;
  subtitle: string;
  value: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingRowText}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingSubtitle}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: colors.bgInactive, true: colors.primary }}
        thumbColor={colors.textPrimary}
        accessibilityLabel={label}
      />
    </View>
  );
}

interface SettingsPanelProps {
  language: SpeechLanguage;
  onChangeLanguage: (language: SpeechLanguage) => void;
  audioLevel: number;
  onChangeAudioLevel: (next: number) => void;
  muted: boolean;
  onToggleMuted: (next: boolean) => void;
}

export function SettingsPanel({
  language,
  onChangeLanguage,
  audioLevel,
  onChangeAudioLevel,
  muted,
  onToggleMuted,
}: SettingsPanelProps) {
  const [verbosity, setVerbosity] = useState<Verbosity>("Normal");
  const [sensitivity, setSensitivity] = useState(54);
  const [debugMode, setDebugMode] = useState(true);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Settings</Text>
        <Text style={styles.pageSubtitle}>
          Customize your navigation experience
        </Text>
      </View>

      <SectionCard>
        <SectionHeader
          icon={
            <MaterialIcons
              name="language"
              size={20}
              color={colors.textPrimary}
            />
          }
          title="Language"
          subtitle="Choose your preferred language"
        />
        <SegmentedControl<SpeechLanguage>
          options={["Hindi", "English"]}
          value={language}
          onChange={onChangeLanguage}
        />
      </SectionCard>

      <SectionCard>
        <SectionHeader
          icon={
            <MaterialIcons
              name="record-voice-over"
              size={20}
              color={colors.textPrimary}
            />
          }
          title="Verbosity"
          subtitle="Controls how much information is spoken"
        />
        <SegmentedControl<Verbosity>
          options={["Minimal", "Normal", "Detailed"]}
          value={verbosity}
          onChange={setVerbosity}
        />
      </SectionCard>

      <SectionCard>
        <SectionHeader
          icon={
            <MaterialIcons
              name="volume-up"
              size={20}
              color={colors.textPrimary}
            />
          }
          title="Audio"
        />
        <Text style={styles.settingSubtitle}>Adjust voice guidance volume</Text>
        <SliderRow
          value={audioLevel}
          onChange={onChangeAudioLevel}
          disabled={muted}
        />
        <SettingRow
          label="Mute"
          subtitle="Mute all voice instructions"
          value={muted}
          onToggle={onToggleMuted}
        />
      </SectionCard>

      <SectionCard>
        <SectionHeader
          icon={
            <MaterialIcons name="tune" size={20} color={colors.textPrimary} />
          }
          title="Sensitivity"
        />
        <SliderRow value={sensitivity} onChange={setSensitivity} />
      </SectionCard>

      <SectionCard>
        <View style={styles.settingRow}>
          <View style={styles.sectionTitleRow}>
            <MaterialIcons
              name="bug-report"
              size={20}
              color={colors.textPrimary}
            />
            <Text style={styles.sectionTitle}>Debug Mode</Text>
          </View>
          <Switch
            value={debugMode}
            onValueChange={setDebugMode}
            trackColor={{ false: colors.bgInactive, true: colors.primary }}
            thumbColor={colors.textPrimary}
            accessibilityLabel="Debug Mode"
          />
        </View>
      </SectionCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 8,
  },
  pageHeader: {
    paddingHorizontal: 8,
    paddingBottom: 4,
    gap: 4,
  },
  pageTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 24,
    color: colors.textPrimary,
    letterSpacing: 0.07,
  },
  pageSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: colors.textMuted,
    letterSpacing: -0.15,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    padding: 24,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: { gap: 6 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 20,
    color: colors.textPrimary,
  },
  sectionSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: colors.textMuted,
  },
  segmentedRow: {
    flexDirection: "row",
    gap: 12,
  },
  segmentButton: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.bgInactive,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentButtonActive: {
    backgroundColor: colors.primary,
  },
  segmentText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: colors.textMuted,
    textAlign: "center",
  },
  segmentTextActive: {
    color: colors.textPrimary,
  },
  sliderWrapper: { gap: 4 },
  sliderLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sliderLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: colors.textMuted,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  settingRowText: {
    flex: 1,
    gap: 4,
  },
  settingLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: colors.textPrimary,
  },
  settingSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: colors.textMuted,
  },
});
