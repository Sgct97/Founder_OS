/**
 * Project detail — Preview is the home.
 * Embeds the Render/deployed URL when possible; always offers open + GitHub.
 */

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, Stack } from "expo-router";

import type { ColorPalette } from "@/constants/theme";
import {
  BORDER_RADIUS,
  FONT_SIZE,
  FONT_WEIGHT,
  LAYOUT,
  SHADOW,
  SPACING,
} from "@/constants/theme";
import { useThemedStyles } from "@/hooks/use-themed-styles";
import { useTheme } from "@/hooks/use-theme";
import { useProject, useUpdateProject } from "@/hooks/use-projects";
import { normalizeExternalUrl } from "@/services/projects";
import { HeaderTitle } from "@/components/ui/HeaderTitle";
import { Skeleton } from "@/components/ui/Skeleton";

function PreviewFrame({
  url,
  colors,
}: {
  url: string;
  colors: ColorPalette;
}) {
  const styles = useThemedStyles(createPreviewStyles);

  if (Platform.OS === "web") {
    return (
      <View style={styles.frameShell}>
        <View style={styles.frameChrome}>
          <View style={styles.dots}>
            <View style={[styles.dot, { backgroundColor: "#FF5F57" }]} />
            <View style={[styles.dot, { backgroundColor: "#FEBC2E" }]} />
            <View style={[styles.dot, { backgroundColor: "#28C840" }]} />
          </View>
          <Text style={styles.frameUrl} numberOfLines={1}>
            {url}
          </Text>
        </View>
        {React.createElement("iframe", {
          src: url,
          title: "Project preview",
          style: {
            width: "100%",
            height: "100%",
            border: "none",
            background: colors.backgroundSubtle,
            flex: 1,
            minHeight: 480,
          },
          allow: "fullscreen",
        })}
      </View>
    );
  }

  return (
    <View style={styles.nativeFallback}>
      <Ionicons name="phone-portrait-outline" size={36} color={colors.primary} />
      <Text style={styles.nativeTitle}>Preview ready</Text>
      <Text style={styles.nativeBody}>
        Open the live deploy in your browser to review this build.
      </Text>
      <Pressable
        style={styles.openBtn}
        onPress={() => Linking.openURL(url)}
      >
        <Text style={styles.openBtnText}>Open preview</Text>
      </Pressable>
    </View>
  );
}

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { data: project, isLoading, isError, refetch } = useProject(id);
  const updateMutation = useUpdateProject();

  const [showEdit, setShowEdit] = useState(false);
  const [name, setName] = useState("");
  const [brief, setBrief] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  const previewHref = useMemo(
    () => normalizeExternalUrl(project?.preview_url),
    [project?.preview_url]
  );
  const githubHref = useMemo(
    () => normalizeExternalUrl(project?.github_url),
    [project?.github_url]
  );

  const openEdit = useCallback(() => {
    if (!project) return;
    setName(project.name);
    setBrief(project.brief ?? "");
    setGithubUrl(project.github_url ?? "");
    setPreviewUrl(project.preview_url ?? "");
    setShowEdit(true);
  }, [project]);

  const saveEdit = useCallback(async () => {
    if (!id || !name.trim()) return;
    try {
      await updateMutation.mutateAsync({
        id,
        payload: {
          name: name.trim(),
          brief: brief.trim() || null,
          github_url: normalizeExternalUrl(githubUrl),
          preview_url: normalizeExternalUrl(previewUrl),
        },
      });
      setShowEdit(false);
    } catch (e: unknown) {
      Alert.alert(
        "Error",
        e instanceof Error ? e.message : "Failed to update project"
      );
    }
  }, [id, name, brief, githubUrl, previewUrl, updateMutation]);

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <HeaderTitle pageName={project?.name ?? "Preview"} />
          ),
          headerRight: () => (
            <Pressable onPress={openEdit} hitSlop={12} style={{ marginRight: 8 }}>
              <Ionicons name="create-outline" size={22} color={colors.primary} />
            </Pressable>
          ),
        }}
      />

      {isLoading ? (
        <View style={styles.pad}>
          <Skeleton height={320} />
        </View>
      ) : isError || !project ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Project not found</Text>
          <Pressable onPress={() => refetch()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.actions}>
            {previewHref ? (
              <Pressable
                style={styles.actionBtn}
                onPress={() => Linking.openURL(previewHref)}
              >
                <Ionicons name="open-outline" size={16} color={colors.primary} />
                <Text style={styles.actionText}>Open live</Text>
              </Pressable>
            ) : null}
            {githubHref ? (
              <Pressable
                style={styles.actionBtn}
                onPress={() => Linking.openURL(githubHref)}
              >
                <Ionicons name="logo-github" size={16} color={colors.primary} />
                <Text style={styles.actionText}>GitHub</Text>
              </Pressable>
            ) : null}
          </View>

          {previewHref ? (
            <PreviewFrame url={previewHref} colors={colors} />
          ) : (
            <View style={styles.noPreview}>
              <Ionicons name="globe-outline" size={36} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No preview URL</Text>
              <Text style={styles.emptyBody}>
                Add your Render (or other) deploy URL to show a live preview here.
              </Text>
              <Pressable style={styles.openBtn} onPress={openEdit}>
                <Text style={styles.openBtnText}>Add preview URL</Text>
              </Pressable>
            </View>
          )}

          {project.brief ? (
            <View style={styles.briefCard}>
              <Text style={styles.briefLabel}>Brief</Text>
              <Text style={styles.briefBody}>{project.brief}</Text>
            </View>
          ) : null}
        </ScrollView>
      )}

      <Modal
        visible={showEdit}
        animationType="slide"
        transparent
        onRequestClose={() => setShowEdit(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit project</Text>
              <Pressable onPress={() => setShowEdit(false)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.fieldLabel}>Brief</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={brief}
              onChangeText={setBrief}
              multiline
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.fieldLabel}>GitHub URL</Text>
            <TextInput
              style={styles.input}
              value={githubUrl}
              onChangeText={setGithubUrl}
              autoCapitalize="none"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.fieldLabel}>Preview URL</Text>
            <TextInput
              style={styles.input}
              value={previewUrl}
              onChangeText={setPreviewUrl}
              autoCapitalize="none"
              placeholderTextColor={colors.textMuted}
            />
            <Pressable
              style={[
                styles.saveBtn,
                updateMutation.isPending && { opacity: 0.5 },
              ]}
              disabled={updateMutation.isPending || !name.trim()}
              onPress={saveEdit}
            >
              {updateMutation.isPending ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.saveBtnText}>Save</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function createPreviewStyles(colors: ColorPalette) {
  return {
    frameShell: {
      flex: 1,
      minHeight: 520,
      borderRadius: BORDER_RADIUS.lg,
      overflow: "hidden" as const,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      ...SHADOW.md,
    },
    frameChrome: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: SPACING.sm,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      backgroundColor: colors.backgroundSubtle,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    dots: {
      flexDirection: "row" as const,
      gap: 6,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    frameUrl: {
      flex: 1,
      fontSize: FONT_SIZE.xs,
      color: colors.textSecondary,
    },
    nativeFallback: {
      alignItems: "center" as const,
      justifyContent: "center" as const,
      padding: SPACING.xl,
      borderRadius: BORDER_RADIUS.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: SPACING.sm,
      minHeight: 280,
    },
    nativeTitle: {
      fontSize: FONT_SIZE.lg,
      fontWeight: FONT_WEIGHT.semibold,
      color: colors.textPrimary,
    },
    nativeBody: {
      fontSize: FONT_SIZE.sm,
      color: colors.textSecondary,
      textAlign: "center" as const,
    },
    openBtn: {
      marginTop: SPACING.md,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm + 2,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: colors.primary,
    },
    openBtnText: {
      color: colors.white,
      fontWeight: FONT_WEIGHT.semibold,
      fontSize: FONT_SIZE.sm,
    },
  };
}

function createStyles(colors: ColorPalette) {
  return {
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    pad: { padding: LAYOUT.screenPaddingH },
    content: {
      padding: LAYOUT.screenPaddingH,
      paddingBottom: SPACING.xxl,
      gap: SPACING.md,
    },
    actions: {
      flexDirection: "row" as const,
      gap: SPACING.sm,
      flexWrap: "wrap" as const,
    },
    actionBtn: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 6,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: colors.primaryMuted,
    },
    actionText: {
      color: colors.primary,
      fontWeight: FONT_WEIGHT.semibold,
      fontSize: FONT_SIZE.sm,
    },
    noPreview: {
      alignItems: "center" as const,
      padding: SPACING.xl,
      borderRadius: BORDER_RADIUS.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: SPACING.sm,
    },
    empty: {
      flex: 1,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      padding: SPACING.xl,
      gap: SPACING.sm,
    },
    emptyTitle: {
      fontSize: FONT_SIZE.lg,
      fontWeight: FONT_WEIGHT.semibold,
      color: colors.textPrimary,
    },
    emptyBody: {
      fontSize: FONT_SIZE.sm,
      color: colors.textSecondary,
      textAlign: "center" as const,
    },
    retryBtn: {
      marginTop: SPACING.md,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: colors.primaryMuted,
    },
    retryText: {
      color: colors.primary,
      fontWeight: FONT_WEIGHT.semibold,
    },
    openBtn: {
      marginTop: SPACING.md,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm + 2,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: colors.primary,
    },
    openBtnText: {
      color: colors.white,
      fontWeight: FONT_WEIGHT.semibold,
      fontSize: FONT_SIZE.sm,
    },
    briefCard: {
      backgroundColor: colors.surface,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    briefLabel: {
      fontSize: FONT_SIZE.xs,
      fontWeight: FONT_WEIGHT.semibold,
      color: colors.textTertiary,
      textTransform: "uppercase" as const,
      letterSpacing: 0.6,
      marginBottom: SPACING.xs,
    },
    briefBody: {
      fontSize: FONT_SIZE.sm,
      color: colors.textSecondary,
      lineHeight: 22,
    },
    modalOverlay: {
      flex: 1,
      justifyContent: "flex-end" as const,
      backgroundColor: colors.surfaceOverlay,
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: BORDER_RADIUS.xl,
      borderTopRightRadius: BORDER_RADIUS.xl,
      padding: SPACING.lg,
      paddingBottom: SPACING.xxl,
    },
    modalHeader: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      marginBottom: SPACING.md,
    },
    modalTitle: {
      fontSize: FONT_SIZE.xl,
      fontWeight: FONT_WEIGHT.bold,
      color: colors.textPrimary,
    },
    fieldLabel: {
      fontSize: FONT_SIZE.xs,
      fontWeight: FONT_WEIGHT.semibold,
      color: colors.textTertiary,
      textTransform: "uppercase" as const,
      letterSpacing: 0.6,
      marginBottom: SPACING.xs,
      marginTop: SPACING.sm,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: BORDER_RADIUS.md,
      paddingHorizontal: SPACING.md,
      paddingVertical: Platform.OS === "web" ? 12 : 10,
      fontSize: FONT_SIZE.md,
      color: colors.textPrimary,
      backgroundColor: colors.backgroundSubtle,
    },
    inputMultiline: {
      minHeight: 88,
      textAlignVertical: "top" as const,
    },
    saveBtn: {
      marginTop: SPACING.lg,
      height: LAYOUT.buttonHeight,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: colors.primary,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    saveBtnText: {
      color: colors.white,
      fontWeight: FONT_WEIGHT.semibold,
      fontSize: FONT_SIZE.md,
    },
  };
}
