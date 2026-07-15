/**
 * Invite screen — join an existing workspace with a code.
 *
 * The second founder uses this after signing up on Supabase.
 * Tight, focused form. One code field + account details.
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

export default function InviteScreen() {
  const styles = useThemedStyles(createStyles);
  const { joinWithInvite } = useAuth();
  const [inviteCode, setInviteCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isValid =
    inviteCode.trim().length > 0 &&
    displayName.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= 6;

  const handleJoin = useCallback(async () => {
    setError(null);

    if (!isValid) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    try {
      await joinWithInvite(
        inviteCode.trim().toUpperCase(),
        email.trim().toLowerCase(),
        password,
        displayName.trim()
      );
      router.replace("/(tabs)/milestones");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [inviteCode, displayName, email, password, isValid, joinWithInvite]);

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
          <BrandHeader tagline="Your co-founder is waiting." />

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Join a workspace</Text>
            <Text style={styles.cardSubtitle}>
              Enter the invite code from your co-founder to get started.
            </Text>

            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Input
              label="Invite Code"
              value={inviteCode}
              onChangeText={(text) => setInviteCode(text.toUpperCase())}
              placeholder="e.g. A7KX3BN2"
              autoCapitalize="characters"
            />

            <Input
              label="Your Name"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="John Smith"
              autoCapitalize="words"
              autoComplete="name"
            />

            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="john@acmelabs.com"
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
                label="Join Workspace"
                onPress={handleJoin}
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
