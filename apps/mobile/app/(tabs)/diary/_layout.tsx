/**
 * Diary stack navigator — nested inside the Diary tab.
 *
 * Provides a Stack so that `diary/new` pushes on top of the
 * main timeline while keeping the tab bar visible.
 */

import { Stack } from "expo-router";

import { COLORS, FONT_SIZE, FONT_WEIGHT } from "@/constants/theme";

export default function DiaryLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.navy,
        },
        headerTintColor: COLORS.textInverse,
        headerTitleStyle: {
          fontWeight: FONT_WEIGHT.semibold,
          fontSize: FONT_SIZE.lg,
          letterSpacing: -0.2,
        },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Diary",
        }}
      />
      <Stack.Screen
        name="new"
        options={{
          title: "New Entry",
          presentation: "modal",
        }}
      />
    </Stack>
  );
}

