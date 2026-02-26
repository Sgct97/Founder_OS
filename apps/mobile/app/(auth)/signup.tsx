/**
 * Signup screen — create account + workspace in one elegant flow.
 *
 * Same premium card aesthetic as login. Four fields, one tap.
 * Clear value proposition at the top.
 */

import React, { useCallback, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Link, router } from "expo-router";

import { BrandHeader } from "@/components/ui/BrandHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/use-auth";
import {
  BORDER_RADIUS,
  COLORS,
  FONT_SIZE,
  FONT_WEIGHT,
  LAYOUT,
  SHADOW,
  SPACING,
} from "@/constants/theme";

export default function SignupScreen() {
  const { signUp } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isValid =
    displayName.trim().length > 0 &&
    workspaceName.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= 6;

  const handleSignup = useCallback(async () => {
    setError(null);

    if (!isValid) {
      setError("Please fill in all fields. Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      await signUp(
        email.trim().toLowerCase(),
        password,
        displayName.trim(),
        workspaceName.trim()
      );
      router.replace("/(tabs)/milestones");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [email, password, displayName, workspaceName, isValid, signUp]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.screen}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <BrandHeader tagline="Your co-founder command center." />

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Create your workspace</Text>
            <Text style={styles.cardSubtitle}>
              Set up in 30 seconds. Invite your co-founder after.
            </Text>

            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Input
              label="Your Name"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Jane Smith"
              autoCapitalize="words"
              autoComplete="name"
            />

            <Input
              label="Workspace Name"
              value={workspaceName}
              onChangeText={setWorkspaceName}
              placeholder="Acme Labs"
              autoCapitalize="words"
            />

            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="jane@acmelabs.com"
              keyboardType="email-address"
              autoComplete="email"
              autoCapitalize="none"
            />

            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="At least 6 characters"
              secureTextEntry
              autoComplete="new-password"
            />

            <View style={styles.buttonRow}>
              <Button
                label="Create Workspace"
                onPress={handleSignup}
                loading={loading}
                disabled={!isValid}
              />
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/(auth)/login" asChild>
              <Pressable>
                <Text style={styles.footerLink}>Sign in</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: LAYOUT.screenPaddingH,
    paddingVertical: SPACING.xxl,
  },
  content: {
    width: "100%",
    maxWidth: LAYOUT.maxContentWidth,
    alignSelf: "center",
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xl,
    ...SHADOW.lg,
  },
  cardTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.regular,
    color: COLORS.textTertiary,
    marginBottom: SPACING.lg,
  },
  errorBanner: {
    backgroundColor: COLORS.errorMuted,
    borderRadius: BORDER_RADIUS.sm,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  errorText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.error,
    fontWeight: FONT_WEIGHT.medium,
  },
  buttonRow: {
    marginTop: SPACING.sm,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: SPACING.md,
  },
  footerText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textTertiary,
  },
  footerLink: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.semibold,
  },
});

