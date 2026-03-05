/**
 * Milestones stack navigator — nested inside the Milestones tab.
 *
 * Provides a Stack so that the milestone chat view pushes on top
 * of the main milestones screen while keeping the tab bar visible.
 */

import { Stack } from "expo-router";

import { COLORS, FONT_SIZE, FONT_WEIGHT } from "@/constants/theme";

export default function MilestonesLayout() {
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
          title: "Milestones",
        }}
      />
      <Stack.Screen
        name="chat"
        options={{
          title: "Milestone Chat",
          presentation: "modal",
        }}
      />
    </Stack>
  );
}
