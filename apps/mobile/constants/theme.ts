/**
 * FoundersForge Design System — premium dark theme.
 *
 * Inspired by Linear, Stripe, and Vercel.
 * Forge-inspired palette: deep charcoal + molten orange accents.
 * Every value is intentional; do not add arbitrary one-offs.
 */

export const COLORS = {
  // ── Brand (molten orange) ──────────────────────────
  primary: "#FF6A2A",
  primaryLight: "#FF8650",
  primaryDark: "#E55A1B",
  primaryMuted: "rgba(255, 106, 42, 0.12)",
  primaryGlow: "rgba(255, 106, 42, 0.25)",

  // ── Secondary accents ─────────────────────────────
  accent: "#FFB36B",
  accentMuted: "rgba(255, 179, 107, 0.12)",
  highlight: "#FFD7A3",
  indigo: "#4F46E5",

  // ── Dark surfaces ─────────────────────────────────
  navy: "#0B0B0C",
  navyLight: "#111114",
  navyMid: "#151518",
  navySoft: "#1E1E22",

  // ── Neutrals ──────────────────────────────────────
  white: "#ffffff",
  background: "#0B0B0C",
  backgroundSubtle: "#151518",
  surface: "#151518",
  surfaceElevated: "#1E1E22",
  surfaceOverlay: "rgba(0, 0, 0, 0.65)",

  // ── Text hierarchy ────────────────────────────────
  textPrimary: "#F5F5F5",
  textSecondary: "#9A9A9A",
  textTertiary: "#6B6B6B",
  textMuted: "#636363",
  textInverse: "#0B0B0C",
  textLink: "#FF6A2A",

  // ── Borders ───────────────────────────────────────
  border: "rgba(255, 255, 255, 0.08)",
  borderLight: "rgba(255, 255, 255, 0.04)",
  borderFocus: "#FF6A2A",
  divider: "rgba(255, 255, 255, 0.06)",

  // ── Semantic ──────────────────────────────────────
  success: "#22C55E",
  successMuted: "rgba(34, 197, 94, 0.12)",
  error: "#EF4444",
  errorMuted: "rgba(239, 68, 68, 0.12)",
  warning: "#F59E0B",
  warningMuted: "rgba(245, 158, 11, 0.12)",
  info: "#3B82F6",
  infoMuted: "rgba(59, 130, 246, 0.12)",
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
