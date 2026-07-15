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
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Link, router } from "expo-router";

import { BrandHeader } from "@/components/ui/BrandHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/use-auth";
import { useThemedStyles } from "@/hooks/use-themed-styles";
import type { ColorPalette } from "@/constants/theme";
import {
  BORDER_RADIUS,
  FONT_SIZE,
  FONT_WEIGHT,
  LAYOUT,
  SHADOW,
  SPACING,
} from "@/constants/theme";

export default function SignupScreen() {
  const styles = useThemedStyles(createStyles);
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
          <View style={styles.glowOrbWrap}>
            <LinearGradient
              colors={["rgba(255, 106, 42, 0.13)", "rgba(255, 106, 42, 0.04)", "transparent"]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.glowOrb}
            />
          </View>

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

function createStyles(colors: ColorPalette) {
  return {
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: "center" as const,
      paddingHorizontal: LAYOUT.screenPaddingH,
      paddingVertical: SPACING.xxl,
    },
    content: {
      width: "100%" as const,
      maxWidth: LAYOUT.maxContentWidth,
      position: "relative" as const,
    },
    glowOrbWrap: {
      position: "absolute" as const,
      top: -80,
      left: "50%" as const,
      marginLeft: -220,
      width: 440,
      height: 440,
      zIndex: 0,
      pointerEvents: "none" as const,
    },
    glowOrb: {
      width: "100%" as const,
      height: "100%" as const,
      borderRadius: 220,
      alignSelf: "center" as const,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: BORDER_RADIUS.xl,
      padding: SPACING.lg,
      paddingTop: SPACING.xl,
      paddingBottom: SPACING.xl,
      ...SHADOW.lg,
    },
    cardTitle: {
      fontSize: FONT_SIZE.xl,
      fontWeight: FONT_WEIGHT.bold,
      color: colors.textPrimary,
      marginBottom: SPACING.xs,
      letterSpacing: -0.3,
    },
    cardSubtitle: {
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.regular,
      color: colors.textTertiary,
      marginBottom: SPACING.lg,
    },
    errorBanner: {
      backgroundColor: colors.errorMuted,
      borderRadius: BORDER_RADIUS.sm,
      paddingVertical: SPACING.sm + 2,
      paddingHorizontal: SPACING.md,
      marginBottom: SPACING.md,
    },
    errorText: {
      fontSize: FONT_SIZE.sm,
      color: colors.error,
      fontWeight: FONT_WEIGHT.medium,
    },
    buttonRow: {
      marginTop: SPACING.sm,
    },
    footer: {
      flexDirection: "row" as const,
      justifyContent: "center" as const,
      marginTop: SPACING.md,
    },
    footerText: {
      fontSize: FONT_SIZE.sm,
      color: colors.textTertiary,
    },
    footerLink: {
      fontSize: FONT_SIZE.sm,
      color: colors.primary,
      fontWeight: FONT_WEIGHT.semibold,
    },
  };
}
