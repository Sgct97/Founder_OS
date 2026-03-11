/**
 * Tab navigator — the five main sections of FoundersForge.
 *
 * Premium tab bar with gradient background, orange active state,
 * subtle border. Feels like Linear meets Vercel.
 */

import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

import { COLORS, FONT_SIZE, FONT_WEIGHT, LAYOUT } from "@/constants/theme";

function TabBarBackground() {
  return (
    <LinearGradient
      colors={[COLORS.navyMid, COLORS.navy]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={{ flex: 1 }}
    />
  );
}

function HeaderBackground() {
  return (
    <LinearGradient
      colors={["#1A1000", COLORS.navy]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={{ flex: 1 }}
    />
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: COLORS.navy,
          borderTopColor: "rgba(255, 255, 255, 0.06)",
          borderTopWidth: 0.5,
          height: LAYOUT.tabBarHeight,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarBackground: () => <TabBarBackground />,
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
        headerTintColor: COLORS.white,
        headerTitleStyle: {
          fontWeight: FONT_WEIGHT.semibold,
          fontSize: FONT_SIZE.lg,
          letterSpacing: -0.2,
        },
        headerBackground: () => <HeaderBackground />,
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
        name="milestones"
        options={{
          title: "Milestones",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="flag-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="features/index"
        options={{
          title: "Requests",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bulb-outline" size={size} color={color} />
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
