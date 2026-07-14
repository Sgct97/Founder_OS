/**
 * FoundersForge Design System — light + dark palettes.
 *
 * Dark is the default (forge charcoal + molten orange).
 * Prefer `useTheme().colors` in components so the toggle works.
 * `COLORS` remains the dark palette for gradual migration.
 */

export type ColorPalette = {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  primaryMuted: string;
  primaryGlow: string;
  accent: string;
  accentMuted: string;
  highlight: string;
  indigo: string;
  navy: string;
  navyLight: string;
  navyMid: string;
  navySoft: string;
  white: string;
  background: string;
  backgroundSubtle: string;
  surface: string;
  surfaceElevated: string;
  surfaceOverlay: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textMuted: string;
  textInverse: string;
  textLink: string;
  border: string;
  borderLight: string;
  borderFocus: string;
  divider: string;
  success: string;
  successMuted: string;
  error: string;
  errorMuted: string;
  warning: string;
  warningMuted: string;
  info: string;
  infoMuted: string;
};

export const DARK_COLORS: ColorPalette = {
  primary: "#FF6A2A",
  primaryLight: "#FF8650",
  primaryDark: "#E55A1B",
  primaryMuted: "rgba(255, 106, 42, 0.12)",
  primaryGlow: "rgba(255, 106, 42, 0.25)",
  accent: "#FFB36B",
  accentMuted: "rgba(255, 179, 107, 0.12)",
  highlight: "#FFD7A3",
  indigo: "#4F46E5",
  navy: "#0B0B0C",
  navyLight: "#111114",
  navyMid: "#151518",
  navySoft: "#1E1E22",
  white: "#ffffff",
  background: "#0B0B0C",
  backgroundSubtle: "#151518",
  surface: "#151518",
  surfaceElevated: "#1E1E22",
  surfaceOverlay: "rgba(0, 0, 0, 0.65)",
  textPrimary: "#F5F5F5",
  textSecondary: "#9A9A9A",
  textTertiary: "#6B6B6B",
  textMuted: "#636363",
  textInverse: "#0B0B0C",
  textLink: "#FF6A2A",
  border: "rgba(255, 255, 255, 0.08)",
  borderLight: "rgba(255, 255, 255, 0.04)",
  borderFocus: "#FF6A2A",
  divider: "rgba(255, 255, 255, 0.06)",
  success: "#22C55E",
  successMuted: "rgba(34, 197, 94, 0.12)",
  error: "#EF4444",
  errorMuted: "rgba(239, 68, 68, 0.12)",
  warning: "#F59E0B",
  warningMuted: "rgba(245, 158, 11, 0.12)",
  info: "#3B82F6",
  infoMuted: "rgba(59, 130, 246, 0.12)",
};

export const LIGHT_COLORS: ColorPalette = {
  primary: "#E55A1B",
  primaryLight: "#FF6A2A",
  primaryDark: "#C44A14",
  primaryMuted: "rgba(229, 90, 27, 0.12)",
  primaryGlow: "rgba(229, 90, 27, 0.2)",
  accent: "#D97706",
  accentMuted: "rgba(217, 119, 6, 0.12)",
  highlight: "#F59E0B",
  indigo: "#4F46E5",
  navy: "#F4F2EF",
  navyLight: "#FFFFFF",
  navyMid: "#EDEAE6",
  navySoft: "#E5E1DB",
  white: "#ffffff",
  background: "#F7F5F2",
  backgroundSubtle: "#EDEAE6",
  surface: "#FFFFFF",
  surfaceElevated: "#FFFFFF",
  surfaceOverlay: "rgba(15, 15, 15, 0.45)",
  textPrimary: "#141414",
  textSecondary: "#5C5C5C",
  textTertiary: "#7A7A7A",
  textMuted: "#8A8A8A",
  textInverse: "#FFFFFF",
  textLink: "#E55A1B",
  border: "rgba(0, 0, 0, 0.1)",
  borderLight: "rgba(0, 0, 0, 0.05)",
  borderFocus: "#E55A1B",
  divider: "rgba(0, 0, 0, 0.08)",
  success: "#16A34A",
  successMuted: "rgba(22, 163, 74, 0.12)",
  error: "#DC2626",
  errorMuted: "rgba(220, 38, 38, 0.12)",
  warning: "#D97706",
  warningMuted: "rgba(217, 119, 6, 0.12)",
  info: "#2563EB",
  infoMuted: "rgba(37, 99, 235, 0.12)",
};

/** @deprecated Prefer useTheme().colors — static dark palette for legacy screens. */
export const COLORS = DARK_COLORS;

export function colorsForScheme(scheme: "light" | "dark"): ColorPalette {
  return scheme === "light" ? LIGHT_COLORS : DARK_COLORS;
}

export type ThemeMode = "light" | "dark" | "system";

export const SPACING = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const FONT_SIZE = {
  caption: 11,
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  xxxl: 34,
  display: 42,
} as const;

export const FONT_WEIGHT = {
  regular: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
  heavy: "800" as const,
};

export const LINE_HEIGHT = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.65,
} as const;

export const BORDER_RADIUS = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
} as const;

export const SHADOW = {
  sm: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 3,
  },
  lg: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 6,
  },
  glow: {
    shadowColor: "#FF6A2A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 4,
  },
} as const;

export const ANIMATION = {
  fast: 150,
  normal: 250,
  slow: 400,
} as const;

export const LAYOUT = {
  screenPaddingH: 20,
  maxContentWidth: 480,
  inputHeight: 52,
  buttonHeight: 52,
  headerHeight: 56,
  tabBarHeight: 64,
} as const;
