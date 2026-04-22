/**
 * SightViz Design System
 *
 * Single source of truth for all visual tokens: colors, typography,
 * spacing, border radii, and shadow styles.
 *
 * Philosophy: calm clarity. The interface recedes so the world can
 * come forward. Warm sage neutrals ground the user; teal signals
 * action and confidence; typography is generous and unhurried.
 */

// ─── Color Palette ────────────────────────────────────────────────────────────

export const colors = {
  // Brand
  primary: "#5db1b6", // teal — sliders, toggles, active icons
  primaryBright: "#3dbdb3", // brighter teal — CTA button background
  brand: "#5F33E1", // purple — logo accents

  // Surfaces
  bgPage: "#e9e9df", // warm sage — page background (gradient mid)
  bgCard: "#d8dcdb", // slightly darker card surface
  bgInactive: "#ecede8", // inactive button / input surface

  // Tab
  bgTabActive: "#cad6ff", // soft periwinkle — selected nav item

  // Text
  textPrimary: "#1f1f17", // near-black — headings, body
  textMuted: "#878787", // grey — subtitles, placeholders, metadata

  // Semantic
  success: "#10b981",
  successLight: "rgba(16, 185, 129, 0.15)",
  warning: "#f59e0b",
  warningLight: "rgba(245, 158, 11, 0.15)",
  error: "#ef4444",
  errorLight: "rgba(239, 68, 68, 0.15)",

  // Utility
  white: "#ffffff",
  black: "#000000",
  borderSubtle: "#c8c9bd", // hairline borders (tab bar top)
  trackInactive: "#c8ccc8", // slider/progress track background

  // Shadows (use as shadowColor)
  shadowDefault: "rgba(0, 0, 0, 0.1)",
  shadowHeavy: "rgba(0, 0, 0, 0.25)",
  shadowTeal: "rgba(93, 177, 182, 0.3)", // coloured CTA shadow
} as const;

// Background gradients
export const gradients = {
  screen: ["#d8dcdb", "#e9e9df", "#dbe3d8"] as const, // warm sage
  splash: ["#e8f4f8", "#f8fafc", "#f0faf4"] as const, // cool mint

  // Button gradients (use for action states)
  ctaActive: ["#3dbdb3", "#5db1b6"] as const,
  ctaRunning: ["#065f46", "#059669"] as const,
  ctaError: ["#991b1b", "#dc2626"] as const,
  ctaIdle: ["#1e3a8a", "#1e40af"] as const,
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────

/**
 * All font families come from @expo-google-fonts/inter,
 * loaded once in app/_layout.tsx.
 */
export const fonts = {
  thin: "Inter_300Light",
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semiBold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extraBold: "Inter_800ExtraBold",
  black: "Inter_900Black",
} as const;

export const textStyles = {
  // Display / Logo
  displayLg: {
    fontFamily: fonts.bold,
    fontSize: 28,
    letterSpacing: 1,
    color: colors.textPrimary,
  },

  // Page headings
  h1: {
    fontFamily: fonts.semiBold,
    fontSize: 24,
    letterSpacing: 0.07,
    color: colors.textPrimary,
  },
  h1Muted: {
    fontFamily: fonts.regular,
    fontSize: 14,
    letterSpacing: -0.15,
    color: colors.textMuted,
  },

  // Section headings
  h2: {
    fontFamily: fonts.semiBold,
    fontSize: 20,
    color: colors.textPrimary,
  },
  h2Muted: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
  },

  // Large display (tab titles)
  displayMd: {
    fontFamily: fonts.extraBold,
    fontSize: 28,
    color: colors.textPrimary,
  },

  // Body
  body: {
    fontFamily: fonts.regular,
    fontSize: 14,
    letterSpacing: -0.15,
    color: colors.textPrimary,
  },
  bodyLg: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.textPrimary,
  },

  // Caption / meta
  caption: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
  },

  // Labels
  label: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  labelSm: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
  },

  // CTA
  cta: {
    fontFamily: fonts.semiBold,
    fontSize: 19,
    color: colors.white,
  },

  // Uppercase badge / tag text
  badge: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase" as const,
    color: colors.textMuted,
  },
} as const;

// ─── Spacing ──────────────────────────────────────────────────────────────────

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

// ─── Border Radius ────────────────────────────────────────────────────────────

export const radius = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
  full: 9999,
} as const;

// ─── Shadows ──────────────────────────────────────────────────────────────────

export const shadows = {
  card: {
    shadowColor: colors.shadowDefault,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  bar: {
    shadowColor: colors.shadowDefault,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 4,
  },
  button: {
    shadowColor: colors.shadowTeal,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  heavy: {
    shadowColor: colors.shadowHeavy,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
} as const;

// ─── Component presets ────────────────────────────────────────────────────────

/** Shared card surface style */
export const cardBase = {
  backgroundColor: colors.bgCard,
  borderRadius: radius.lg,
  padding: spacing.xxl,
  ...shadows.card,
} as const;

/** Shared segment button base */
export const segmentBase = {
  height: 52,
  borderRadius: radius.md,
  justifyContent: "center" as const,
  alignItems: "center" as const,
  paddingHorizontal: spacing.lg,
} as const;

/** Tab icon container */
export const tabIconBase = {
  width: 40,
  height: 40,
  borderRadius: radius.sm,
  justifyContent: "center" as const,
  alignItems: "center" as const,
} as const;
