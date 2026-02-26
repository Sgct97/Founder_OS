/**
 * Settings screen — profile, workspace, invite, sign out.
 *
 * Premium settings layout with grouped cards. Functional for Sprint 1
 * with sign-out and invite code display.
 */

import React, { useCallback, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "@/components/ui/Button";
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

export default function SettingsScreen() {
  const { user, workspace, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }, [signOut]);

  const handleCopyInvite = useCallback(() => {
    if (!workspace?.invite_code) return;
    // Clipboard API differs across platforms; simple alert for now.
    if (Platform.OS === "web") {
      navigator.clipboard.writeText(workspace.invite_code);
    }
    Alert.alert("Invite Code", workspace.invite_code, [{ text: "OK" }]);
  }, [workspace]);

  const initials = user?.display_name
    ? user.display_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Profile Card ──────────────────────────────── */}
      <View style={styles.card}>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.display_name}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
          </View>
        </View>
      </View>

      {/* ── Workspace Card ────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Workspace</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Name</Text>
          <Text style={styles.rowValue}>{workspace?.name ?? "—"}</Text>
        </View>
        <View style={styles.divider} />
        <Pressable style={styles.row} onPress={handleCopyInvite}>
          <Text style={styles.rowLabel}>Invite Code</Text>
          <View style={styles.codeBadge}>
            <Text style={styles.codeText}>
              {workspace?.invite_code ?? "—"}
            </Text>
            <Ionicons
              name="copy-outline"
              size={14}
              color={COLORS.primary}
              style={styles.copyIcon}
            />
          </View>
        </Pressable>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Daily Commitment</Text>
          <Text style={styles.rowValue}>
            {workspace?.commitment_hours
              ? `${workspace.commitment_hours}h / day`
              : "Not set"}
          </Text>
        </View>
      </View>

      {/* ── Actions ───────────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Account</Text>
        <Button
          label="Sign Out"
          onPress={handleSignOut}
          variant="danger"
          loading={signingOut}
        />
      </View>

      <Text style={styles.versionText}>FounderOS v0.1.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: LAYOUT.screenPaddingH,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOW.sm,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: SPACING.md,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.md,
  },
  avatarText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textTertiary,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: SPACING.sm,
  },
  rowLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHT.medium,
  },
  rowValue: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textPrimary,
    fontWeight: FONT_WEIGHT.semibold,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
  },
  codeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primaryMuted,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs,
  },
  codeText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
    letterSpacing: 1.2,
  },
  copyIcon: {
    marginLeft: SPACING.xs,
  },
  versionText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    textAlign: "center",
    marginTop: SPACING.lg,
  },
});
