/**
 * Brand header — the FounderOS mark used on auth screens.
 *
 * Displays the logotype with a subtle gradient-like teal accent
 * and an elegant tagline. Sets the premium tone immediately.
 */

import React from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  COLORS,
  FONT_SIZE,
  FONT_WEIGHT,
  SPACING,
} from "@/constants/theme";

interface BrandHeaderProps {
  tagline?: string;
}

export function BrandHeader({
  tagline = "Built for founders who ship.",
}: BrandHeaderProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <View style={styles.logoRow}>
        <View style={styles.logoMark}>
          <Text style={styles.logoMarkText}>F</Text>
        </View>
        <Text style={styles.logoType}>
          Founder<Text style={styles.logoAccent}>OS</Text>
        </Text>
      </View>
      <Text style={styles.tagline}>{tagline}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginBottom: SPACING.xxl,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  logoMark: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.sm + 2,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 4,
  },
  logoMarkText: {
    fontSize: 20,
    fontWeight: FONT_WEIGHT.heavy,
    color: COLORS.white,
    marginTop: -1,
  },
  logoType: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.navy,
    letterSpacing: -0.5,
  },
  logoAccent: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.heavy,
  },
  tagline: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.textTertiary,
    letterSpacing: 0.3,
  },
});

