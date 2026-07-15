/**
 * Brand header — the FounderOS mark used on auth screens.
 *
 * Displays the logotype with a subtle gradient-like teal accent
 * and an elegant tagline. Sets the premium tone immediately.
 */

import React from "react";
import { Text, View } from "react-native";

import type { ColorPalette } from "@/constants/theme";
import { useThemedStyles } from "@/hooks/use-themed-styles";
import { FONT_SIZE, FONT_WEIGHT, SPACING } from "@/constants/theme";

interface BrandHeaderProps {
  tagline?: string;
}

export function BrandHeader({
  tagline = "Built for founders who ship.",
}: BrandHeaderProps): React.JSX.Element {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.container}>
      <View style={styles.logoRow}>
        <View style={styles.logoMark}>
          <Text style={styles.logoMarkText}>F</Text>
        </View>
        <Text style={styles.logoType}>
          Founders<Text style={styles.logoAccent}>Forge</Text>
        </Text>
      </View>
      <Text style={styles.tagline}>{tagline}</Text>
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return {
    container: {
      alignItems: "center" as const,
      marginBottom: SPACING.xxl,
    },
    logoRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      marginBottom: SPACING.sm,
    },
    logoMark: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginRight: SPACING.sm + 2,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 4,
    },
    logoMarkText: {
      fontSize: 20,
      fontWeight: FONT_WEIGHT.heavy,
      color: colors.white,
      marginTop: -1,
    },
    logoType: {
      fontSize: FONT_SIZE.xxl,
      fontWeight: FONT_WEIGHT.bold,
      color: colors.textPrimary,
      letterSpacing: -0.5,
    },
    logoAccent: {
      color: colors.primary,
      fontWeight: FONT_WEIGHT.heavy,
    },
    tagline: {
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.medium,
      color: colors.textTertiary,
      letterSpacing: 0.3,
    },
  };
}
