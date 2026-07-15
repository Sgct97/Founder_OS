/**
 * Build StyleSheets from the active theme palette (recomputes on light/dark swap).
 * Same idea as market-opportunity-mapper: components read tokens, never bake a palette.
 */

import { useMemo } from "react";
import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from "react-native";

import type { ColorPalette } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

export function useThemedStyles<T extends NamedStyles<T> | NamedStyles<any>>(
  factory: (colors: ColorPalette) => T
): T {
  const { colors } = useTheme();
  return useMemo(() => StyleSheet.create(factory(colors)) as T, [colors, factory]);
}
