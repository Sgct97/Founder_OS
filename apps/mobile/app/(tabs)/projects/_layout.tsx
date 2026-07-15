/**
 * Projects stack — list + project preview detail.
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

export default function ProjectsLayout() {
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
          headerTitle: () => <HeaderTitle pageName="Projects" />,
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: "Preview",
        }}
      />
    </Stack>
  );
}
