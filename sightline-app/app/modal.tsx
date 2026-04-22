import {
    colors,
    gradients,
    radius,
    shadows,
    spacing,
} from "@/constants/design-system";
import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ModalScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={gradients.screen as any}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>SightViz Modal</Text>
          <Text style={styles.subtitle}>
            A lightweight overlay following the new design baseline.
          </Text>

          <Link href="/" dismissTo style={styles.link}>
            <Text style={styles.linkText}>Back to home</Text>
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxl,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.xxl,
    gap: spacing.md,
    ...shadows.card,
  },
  title: {
    fontSize: 24,
    fontFamily: "Inter_600SemiBold",
    color: colors.textPrimary,
    letterSpacing: 0.07,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: colors.textMuted,
    lineHeight: 20,
  },
  link: {
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignSelf: "flex-start",
  },
  linkText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: colors.textPrimary,
  },
});
