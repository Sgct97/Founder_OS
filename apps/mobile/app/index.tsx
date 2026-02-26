/**
 * Root index — redirects to the correct entry point based on auth state.
 *
 * Expo Router requires an index.tsx at the app root to handle "/".
 */

import { Redirect } from "expo-router";

import { useAuth } from "@/hooks/use-auth";

export default function RootIndex() {
  const { user, isLoading } = useAuth();

  // While checking session, the _layout LoadingGate handles the spinner.
  // Once resolved, redirect to the appropriate screen.
  if (!isLoading && !user) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href="/(tabs)/milestones" />;
}

