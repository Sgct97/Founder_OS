/**
 * Root layout — wraps the entire app.
 *
 * Responsibilities:
 * 1. React Query provider for server state.
 * 2. Auth provider for user session.
 * 3. Gates between (auth) and (tabs) based on login status.
 * 4. Shows a premium loading screen while session is being checked.
 */

import React, { useEffect } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { COLORS, FONT_WEIGHT, SPACING } from "@/constants/theme";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 2,
    },
  },
});

/** Loading screen shown while checking for an existing session. */
function LoadingGate(): React.JSX.Element {
  return (
    <View style={styles.loadingContainer}>
      <View style={styles.loadingMark}>
        <Text style={styles.loadingMarkText}>F</Text>
      </View>
      <ActivityIndicator
        color={COLORS.primary}
        size="small"
        style={styles.spinner}
      />
    </View>
  );
}

/**
 * Auth gate — redirects between (auth) and (tabs) groups
 * based on the current user session. This is the standard
 * Expo Router pattern for auth-protected navigation.
 */
function AuthGate({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { isLoading, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!user && !inAuthGroup) {
      // Not logged in and not on an auth screen → go to login.
      router.replace("/(auth)/login");
    } else if (user && inAuthGroup) {
      // Logged in but still on an auth screen → go to tabs.
      router.replace("/(tabs)/milestones");
    }
  }, [isLoading, user, segments, router]);

  if (isLoading) {
    return <LoadingGate />;
  }

  return <>{children}</>;
}

export default function RootLayout(): React.JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StatusBar style="dark" />
        <AuthGate>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: COLORS.background },
              animation: "fade",
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
          </Stack>
        </AuthGate>
      </AuthProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },
  loadingMark: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.lg,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 4,
  },
  loadingMarkText: {
    fontSize: 28,
    fontWeight: FONT_WEIGHT.heavy,
    color: COLORS.white,
    marginTop: -1,
  },
  spinner: {
    marginTop: SPACING.xs,
  },
});
