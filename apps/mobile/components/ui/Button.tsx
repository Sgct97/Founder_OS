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
  StyleSheet,
  Text,
  type ViewStyle,
} from "react-native";

import {
  BORDER_RADIUS,
  COLORS,
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

  const spinnerColor =
    variant === "primary" ? COLORS.white : COLORS.primary;

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

const styles = StyleSheet.create({
  base: {
    height: LAYOUT.buttonHeight,
    borderRadius: BORDER_RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.lg,
  },
  fullWidth: {
    width: "100%",
  },
  primary: {
    backgroundColor: COLORS.primary,
  },
  secondary: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  ghost: {
    backgroundColor: "transparent",
  },
  danger: {
    backgroundColor: COLORS.errorMuted,
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
    color: COLORS.white,
  },
  labelSecondary: {
    color: COLORS.textPrimary,
  },
  labelGhost: {
    color: COLORS.primary,
  },
  labelDanger: {
    color: COLORS.error,
  },
  labelDisabled: {
    color: COLORS.textMuted,
  },
});

