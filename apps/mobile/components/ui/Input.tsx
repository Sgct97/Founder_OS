/**
 * Premium text input — refined, accessible, with floating label feel.
 *
 * Focus state shows a teal border glow. Error state shows red.
 * Consistent height and spacing across the app.
 */

import React, { useCallback, useRef, useState } from "react";
import {
  Animated,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
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

interface InputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps["autoCapitalize"];
  autoComplete?: TextInputProps["autoComplete"];
  error?: string;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize = "none",
  autoComplete,
  error,
  disabled = false,
  style,
}: InputProps): React.JSX.Element {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    Animated.timing(borderAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [borderAnim]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    Animated.timing(borderAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [borderAnim]);

  const borderColor = error
    ? colors.error
    : borderAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [colors.border, colors.borderFocus],
      });

  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.label, error && styles.labelError]}>{label}</Text>
      <Animated.View
        style={[
          styles.inputWrapper,
          { borderColor },
          isFocused && !error && styles.inputFocused,
          error && styles.inputError,
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          editable={!disabled}
          style={[styles.input, disabled && styles.inputDisabled]}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      </Animated.View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return {
    container: {
      width: "100%" as const,
      marginBottom: SPACING.md,
    },
    label: {
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.medium,
      color: colors.textSecondary,
      marginBottom: SPACING.xs + 2,
      letterSpacing: 0.1,
    },
    labelError: {
      color: colors.error,
    },
    inputWrapper: {
      height: LAYOUT.inputHeight,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      ...SHADOW.sm,
    },
    inputFocused: {
      ...SHADOW.md,
    },
    inputError: {
      borderColor: colors.error,
    },
    input: {
      flex: 1,
      paddingHorizontal: SPACING.md,
      fontSize: FONT_SIZE.md,
      color: colors.textPrimary,
      fontWeight: FONT_WEIGHT.regular,
    },
    inputDisabled: {
      opacity: 0.5,
      color: colors.textMuted,
    },
    errorText: {
      fontSize: FONT_SIZE.xs,
      color: colors.error,
      marginTop: SPACING.xs,
      fontWeight: FONT_WEIGHT.medium,
    },
  };
}
