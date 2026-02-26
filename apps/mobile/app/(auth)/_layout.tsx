/**
 * Auth layout — wraps login/signup/invite screens.
 * No tab bar, no header. Clean, full-screen experience.
 */

import { Stack } from "expo-router";

import { COLORS } from "@/constants/theme";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.background },
        animation: "fade",
      }}
    />
  );
}

