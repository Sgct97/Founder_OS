/**
 * FounderOS Design System — premium design tokens.
 *
 * Inspired by Linear, Stripe, and Notion.
 * Every value is intentional; do not add arbitrary one-offs.
 */

export const COLORS = {
  // ── Brand ──────────────────────────────────────────
  primary: "#2ec4a0",
  primaryLight: "#3dd4b0",
  primaryDark: "#25a88a",
  primaryMuted: "rgba(46, 196, 160, 0.12)",
  primaryGlow: "rgba(46, 196, 160, 0.25)",

  // ── Navy palette (dark UI surfaces) ────────────────
  navy: "#0a1628",
  navyLight: "#111d32",
  navyMid: "#1a2a40",
  navySoft: "#243650",

  // ── Neutrals ──────────────────────────────────────
  white: "#ffffff",
  background: "#f7f8fa",
  backgroundSubtle: "#f0f2f5",
  surface: "#ffffff",
  surfaceElevated: "#ffffff",
  surfaceOverlay: "rgba(10, 22, 40, 0.5)",

  // ── Text hierarchy ────────────────────────────────
  textPrimary: "#0a1628",
  textSecondary: "#525b6a",
  textTertiary: "#8e99a4",
  textMuted: "#b0b8c1",
  textInverse: "#ffffff",
  textLink: "#2ec4a0",

  // ── Borders ───────────────────────────────────────
  border: "#e5e7ec",
  borderLight: "#f0f1f4",
  borderFocus: "#2ec4a0",
  divider: "#eceef2",

  // ── Semantic ──────────────────────────────────────
  success: "#2ec4a0",
  successMuted: "rgba(46, 196, 160, 0.10)",
  error: "#e74c3c",
  errorMuted: "rgba(231, 76, 60, 0.10)",
  warning: "#f39c12",
  warningMuted: "rgba(243, 156, 18, 0.10)",
  info: "#3b82f6",
  infoMuted: "rgba(59, 130, 246, 0.10)",
} as const;

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
    shadowColor: "#0a1628",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: "#0a1628",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  lg: {
    shadowColor: "#0a1628",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },
  glow: {
    shadowColor: "#2ec4a0",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
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
