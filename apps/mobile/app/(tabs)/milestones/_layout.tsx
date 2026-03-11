/**
 * Milestones stack navigator — nested inside the Milestones tab.
 *
 * Provides a Stack so that the milestone chat view pushes on top
 * of the main milestones screen while keeping the tab bar visible.
 */

import { Stack } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

import { COLORS, FONT_SIZE, FONT_WEIGHT } from "@/constants/theme";

function GradientHeaderBackground() {
  return (
    <LinearGradient
      colors={["#1A1000", COLORS.navy]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={{ flex: 1 }}
    />
  );
}

export default function MilestonesLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.navy,
        },
        headerTintColor: COLORS.white,
        headerTitleStyle: {
          fontWeight: FONT_WEIGHT.semibold,
          fontSize: FONT_SIZE.lg,
          letterSpacing: -0.2,
        },
        headerShadowVisible: false,
        headerBackground: () => <GradientHeaderBackground />,
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
