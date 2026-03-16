/**
 * Knowledge stack navigator — nested inside the Knowledge tab.
 *
 * Provides a Stack so that document detail and chat views
 * push on top of the main document list while keeping the tab bar visible.
 */

import { Stack } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

import { HeaderTitle } from "@/components/ui/HeaderTitle";
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

export default function KnowledgeLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.navy,
          height: 96,
        },
        headerTintColor: COLORS.white,
        headerTitleAlign: "center",
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
          headerTitle: () => <HeaderTitle pageName="Knowledge" />,
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
