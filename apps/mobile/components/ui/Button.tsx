/**
 * Premium button component — the primary interactive element across FounderOS.
 *
 * Supports: primary (filled + glow), secondary (outlined), ghost (text-only),
 * danger (destructive). Includes press animation and loading state.
 */

import React, { useCallback, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  Text,
  type ViewStyle,
} from "react-native";

import type { ColorPalette } from "@/constants/theme";
import { useThemedStyles } from "@/hooks/use-themed-styles";
import { useTheme } from "@/hooks/use-theme";
import {
  BORDER_RADIUS,
  FONT_SIZE,
  FONT_WEIGHT,
  LAYOUT,
  SHADOW,
  SPACING,
} from "@/constants/theme";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  fullWidth = true,
  style,
}: ButtonProps): React.JSX.Element {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scale]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();
  }, [scale]);

  const isDisabled = disabled || loading;

  const containerStyle = [
    styles.base,
    styles[variant],
    fullWidth && styles.fullWidth,
    variant === "primary" && SHADOW.glow,
    isDisabled && styles.disabled,
    style,
  ];

  const textStyle = [
    styles.label,
    variant === "primary" && styles.labelPrimary,
    variant === "secondary" && styles.labelSecondary,
    variant === "ghost" && styles.labelGhost,
    variant === "danger" && styles.labelDanger,
    isDisabled && styles.labelDisabled,
  ];

  const spinnerColor = variant === "primary" ? colors.white : colors.primary;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        style={containerStyle}
      >
        {loading ? (
          <ActivityIndicator color={spinnerColor} size="small" />
        ) : (
          <Text style={textStyle}>{label}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

function createStyles(colors: ColorPalette) {
  return {
    base: {
      height: LAYOUT.buttonHeight,
      borderRadius: BORDER_RADIUS.md,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      paddingHorizontal: SPACING.lg,
    },
    fullWidth: {
      width: "100%" as const,
    },
    primary: {
      backgroundColor: colors.primary,
    },
    secondary: {
      backgroundColor: "transparent",
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    ghost: {
      backgroundColor: "transparent",
    },
    danger: {
      backgroundColor: colors.errorMuted,
    },
    disabled: {
      opacity: 0.5,
    },
    label: {
      fontSize: FONT_SIZE.md,
      fontWeight: FONT_WEIGHT.semibold,
      letterSpacing: 0.2,
    },
    labelPrimary: {
      color: colors.white,
    },
    labelSecondary: {
      color: colors.textPrimary,
    },
    labelGhost: {
      color: colors.primary,
    },
    labelDanger: {
      color: colors.error,
    },
    labelDisabled: {
      color: colors.textMuted,
    },
  };
}
