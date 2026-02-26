/**
 * Knowledge stack navigator — nested inside the Knowledge tab.
 *
 * Provides a Stack so that document detail and chat views
 * push on top of the main document list while keeping the tab bar visible.
 */

import { Stack } from "expo-router";

import { COLORS, FONT_SIZE, FONT_WEIGHT } from "@/constants/theme";

export default function KnowledgeLayout() {
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
          title: "Knowledge",
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: "Document",
        }}
      />
      <Stack.Screen
        name="chat"
        options={{
          title: "AI Assistant",
          presentation: "modal",
        }}
      />
    </Stack>
  );
}

