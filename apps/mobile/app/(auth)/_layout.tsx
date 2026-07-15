/**
 * Auth layout — wraps login/signup/invite screens.
 * No tab bar, no header. Clean, full-screen experience.
 */

import { Stack } from "expo-router";

import { useTheme } from "@/hooks/use-theme";

export default function AuthLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: "fade",
      }}
    />
  );
}
