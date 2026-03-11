/**
 * Glowing section divider — a thin gradient line that fades
 * from transparent through a warm orange glow back to transparent.
 * Replaces boring solid borders between sections.
 */

import React from "react";
import { type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { SPACING } from "@/constants/theme";

interface GlowDividerProps {
  style?: ViewStyle;
}

export function GlowDivider({ style }: GlowDividerProps): React.JSX.Element {
  return (
    <LinearGradient
      colors={["transparent", "rgba(255, 106, 42, 0.22)", "transparent"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={[{ height: 1, marginVertical: SPACING.md }, style]}
    />
  );
}
