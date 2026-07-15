/**
 * Tab navigator — main sections of FoundersForge.
 */

import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { HeaderTitle } from "@/components/ui/HeaderTitle";
import { TourProvider } from "@/components/tour/TourProvider";
import { TourOverlay } from "@/components/tour/TourOverlay";
import { useTheme } from "@/hooks/use-theme";
import { FONT_SIZE, FONT_WEIGHT, LAYOUT } from "@/constants/theme";

function TabBarBackground() {
  const { colors } = useTheme();
  return (
    <LinearGradient
      colors={[colors.navyMid, colors.navy]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={{ flex: 1 }}
    />
  );
}

function HeaderBackground() {
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

export default function TabLayout() {
  const { colors, resolved } = useTheme();
  const headerTint = resolved === "dark" ? colors.white : colors.textPrimary;

  return (
    <TourProvider>
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.navy,
          borderTopColor: colors.border,
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
          backgroundColor: colors.navy,
          shadowColor: "transparent",
          elevation: 0,
          height: 96,
        },
        headerTintColor: headerTint,
        headerTitleAlign: "center",
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
        name="projects"
        options={{
          title: "Projects",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cube-outline" size={size} color={color} />
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
          headerTitle: () => <HeaderTitle pageName="Requests" />,
          tabBarLabel: "Requests",
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
          headerTitle: () => <HeaderTitle pageName="Settings" />,
          tabBarLabel: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
    <TourOverlay />
    </View>
    </TourProvider>
  );
}
