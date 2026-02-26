/**
 * Tab navigator — the four main sections of FounderOS.
 *
 * Premium tab bar: dark navy background, teal active state,
 * subtle border, balanced icon sizing. Feels like Linear.
 */

import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

import { COLORS, FONT_SIZE, FONT_WEIGHT, LAYOUT, SHADOW } from "@/constants/theme";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: COLORS.navy,
          borderTopColor: COLORS.navyMid,
          borderTopWidth: 0.5,
          height: LAYOUT.tabBarHeight,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: FONT_SIZE.caption,
          fontWeight: FONT_WEIGHT.medium,
          letterSpacing: 0.1,
        },
        headerStyle: {
          backgroundColor: COLORS.navy,
          shadowColor: "transparent",
          elevation: 0,
        },
        headerTintColor: COLORS.textInverse,
        headerTitleStyle: {
          fontWeight: FONT_WEIGHT.semibold,
          fontSize: FONT_SIZE.lg,
          letterSpacing: -0.2,
        },
      }}
    >
      <Tabs.Screen
        name="knowledge"
        options={{
          title: "Knowledge",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="library-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="milestones/index"
        options={{
          title: "Milestones",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="flag-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="diary"
        options={{
          title: "Diary",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="journal-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings/index"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
