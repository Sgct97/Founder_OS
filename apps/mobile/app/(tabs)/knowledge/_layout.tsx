/**
 * Knowledge stack navigator — nested inside the Knowledge tab.
 *
 * Provides a Stack so that document detail and chat views
 * push on top of the main document list while keeping the tab bar visible.
 */

import { Stack } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

import { HeaderTitle } from "@/components/ui/HeaderTitle";
import { useTheme } from "@/hooks/use-theme";
import { FONT_SIZE, FONT_WEIGHT } from "@/constants/theme";

function GradientHeaderBackground() {
  const { colors, resolved } = useTheme();
  const top = resolved === "dark" ? "#1A1000" : colors.navyMid;
  return (
    <LinearGradient
      colors={[top, colors.navy]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={{ flex: 1 }}
    />
  );
}

export default function KnowledgeLayout() {
  const { colors, resolved } = useTheme();
  const headerTint = resolved === "dark" ? colors.white : colors.textPrimary;

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.navy,
          height: 96,
        },
        headerTintColor: headerTint,
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
