import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
    Animated,
    Dimensions,
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width, height } = Dimensions.get("window");

const imgCharacter = require("@/assets/splash/character.png");
const imgTrafficLight = require("@/assets/splash/traffic_light.png");
const imgSmartphone = require("@/assets/splash/smartphone.png");
const imgGlasses = require("@/assets/splash/glasses.png");
const imgFilingCabinet = require("@/assets/splash/filing_cabinet.png");
const imgLogo = require("@/assets/images/logo.png");

export default function SplashScreen() {
  const router = useRouter();
  const characterFloat = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(characterFloat, {
          toValue: 1,
          duration: 2200,
          useNativeDriver: true,
        }),
        Animated.timing(characterFloat, {
          toValue: 0,
          duration: 2200,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [characterFloat]);

  const characterAnimStyle = {
    transform: [
      {
        translateY: characterFloat.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -10],
        }),
      },
      {
        rotate: characterFloat.interpolate({
          inputRange: [0, 1],
          outputRange: ["-1deg", "1deg"],
        }),
      },
    ],
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      {/* Background gradient */}
      <LinearGradient
        colors={["#e8f4f8", "#f8fafc", "#f0faf4"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Top-left colour blob */}
      <View style={styles.blobTopLeft} />
      {/* Top-right colour blob */}
      <View style={styles.blobTopRight} />
      {/* Bottom-left colour blob */}
      <View style={styles.blobBottomLeft} />

      {/* Floating 3D objects */}
      <Image
        source={imgTrafficLight}
        style={[styles.floatingItem, { left: 24, top: height * 0.28 }]}
        resizeMode="contain"
      />
      <Image
        source={imgSmartphone}
        style={[
          styles.floatingItem,
          { right: 16, top: height * 0.27, width: 62, height: 42 },
        ]}
        resizeMode="contain"
      />
      <Image
        source={imgGlasses}
        style={[
          styles.floatingItem,
          { left: 60, top: height * 0.42, width: 36, height: 36 },
        ]}
        resizeMode="contain"
      />
      <Image
        source={imgFilingCabinet}
        style={[
          styles.floatingItem,
          { right: 20, top: height * 0.35, width: 52, height: 52 },
        ]}
        resizeMode="contain"
      />

      {/* Central character */}
      <Animated.Image
        source={imgCharacter}
        style={[styles.character, characterAnimStyle]}
        resizeMode="contain"
      />

      {/* Logo + tagline */}
      <View style={styles.logoSection}>
        <View style={styles.logoRow}>
          <View style={styles.logoIconWrapper}>
            <View style={styles.logoCircle} />
            <Image
              source={imgLogo}
              style={styles.logoInner}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.logoText}>SIGHTVIZ</Text>
        </View>
        <Text style={styles.tagline}>Smart Navigation Assistance</Text>
      </View>

      {/* Get Started button */}
      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
        ]}
        onPress={() => router.replace("/")}
        accessibilityRole="button"
        accessibilityLabel="Get Started"
      >
        <Text style={styles.buttonText}>Get Started</Text>
        <View style={styles.buttonArrowWrap}>
          <MaterialIcons name="east" size={19} color="#ffffff" />
        </View>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 40,
  },

  // Background blobs
  blobTopLeft: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(100, 210, 200, 0.18)",
    top: -60,
    left: -60,
  },
  blobTopRight: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(200, 240, 160, 0.2)",
    top: -40,
    right: -50,
  },
  blobBottomLeft: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(255, 200, 180, 0.15)",
    bottom: 120,
    left: -50,
  },

  // Floating 3D objects
  floatingItem: {
    position: "absolute",
    width: 60,
    height: 60,
  },

  // Central character illustration
  character: {
    position: "absolute",
    width: width * 0.58,
    height: height * 0.42,
    top: height * 0.14,
    alignSelf: "center",
  },

  // Logo
  logoSection: {
    alignItems: "center",
    marginBottom: 32,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logoIconWrapper: {
    width: 58,
    height: 58,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 29,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderWidth: 2.6,
    borderColor: "#5F33E1",
  },
  logoCircle: {
    position: "absolute",
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.1,
    borderColor: "#5F33E1",
    opacity: 0.35,
  },
  logoInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  logoText: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: "#1f1f1f",
    letterSpacing: 1,
  },
  tagline: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: "#1f1f1f",
    marginTop: 8,
    textAlign: "center",
  },

  // Button
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3dbdb3",
    borderRadius: 50,
    width: width - 48,
    paddingVertical: 16,
    gap: 10,
    shadowColor: "#3dbdb3",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 19,
    color: "#fff",
  },
  buttonArrowWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.85)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
});
