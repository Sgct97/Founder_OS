/**
 * Projects list — client jobs in this workspace.
 * Create with name, brief, GitHub URL, and preview (Render) URL.
 */

import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

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
import {
  useCreateProject,
  useDeleteProject,
  useProjects,
} from "@/hooks/use-projects";
import type { Project } from "@/types/projects";
import { normalizeExternalUrl } from "@/services/projects";
import { Skeleton } from "@/components/ui/Skeleton";

function ProjectCard({
  project,
  onPress,
  onDelete,
}: {
  project: Project;
  onPress: () => void;
  onDelete: () => void;
}) {
  const styles = useThemedStyles(createCardStyles);
  const { colors } = useTheme();
  const hasPreview = !!normalizeExternalUrl(project.preview_url);

  return (
    <Pressable
      onPress={onPress}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`Open project ${project.name}`}
    >
      <View style={styles.cardTop}>
        <View style={styles.iconWrap}>
          <Ionicons name="cube-outline" size={20} color={colors.primary} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {project.name}
          </Text>
          {project.brief ? (
            <Text style={styles.cardBrief} numberOfLines={2}>
              {project.brief}
            </Text>
          ) : (
            <Text style={styles.cardMeta}>No brief yet</Text>
          )}
        </View>
        <Pressable
          onPress={onDelete}
          hitSlop={10}
          accessibilityLabel={`Delete ${project.name}`}
        >
          <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
        </Pressable>
      </View>
      <View style={styles.cardFooter}>
        <View style={styles.chip}>
          <Ionicons
            name={hasPreview ? "eye-outline" : "eye-off-outline"}
            size={12}
            color={hasPreview ? colors.success : colors.textMuted}
          />
          <Text
            style={[
              styles.chipText,
              { color: hasPreview ? colors.success : colors.textMuted },
            ]}
          >
            {hasPreview ? "Preview ready" : "No preview URL"}
          </Text>
        </View>
        {project.github_url ? (
          <View style={styles.chip}>
            <Ionicons name="logo-github" size={12} color={colors.textSecondary} />
            <Text style={styles.chipText}>GitHub</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function ProjectsScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { data: projects, isLoading, isError, refetch } = useProjects();
  const createMutation = useCreateProject();
  const deleteMutation = useDeleteProject();

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [brief, setBrief] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  const resetForm = useCallback(() => {
    setName("");
    setBrief("");
    setGithubUrl("");
    setPreviewUrl("");
  }, []);

  const handleCreate = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert("Name required", "Give this project a name.");
      return;
    }
    try {
      const created = await createMutation.mutateAsync({
        name: trimmed,
        brief: brief.trim() || null,
        github_url: normalizeExternalUrl(githubUrl),
        preview_url: normalizeExternalUrl(previewUrl),
      });
      setShowCreate(false);
      resetForm();
      router.push(`/(tabs)/projects/${created.id}`);
    } catch (e: unknown) {
      const message =
        e && typeof e === "object" && "detail" in e
          ? String((e as { detail: string }).detail)
          : e instanceof Error
            ? e.message
            : "Failed to create project";
      Alert.alert("Error", message);
    }
  }, [name, brief, githubUrl, previewUrl, createMutation, resetForm]);

  const handleDelete = useCallback(
    (project: Project) => {
      const run = () =>
        deleteMutation.mutate(project.id, {
          onError: (e: unknown) => {
            const message =
              e instanceof Error ? e.message : "Failed to delete project";
            Alert.alert("Error", message);
          },
        });

      if (Platform.OS === "web") {
        if (window.confirm(`Delete “${project.name}”? This cannot be undone.`)) {
          run();
        }
        return;
      }
      Alert.alert("Delete project", `Delete “${project.name}”?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: run },
      ]);
    },
    [deleteMutation]
  );

  return (
    <View style={styles.screen}>
      {isLoading ? (
        <View style={styles.pad}>
          <Skeleton height={88} />
          <Skeleton height={88} style={{ marginTop: SPACING.md }} />
        </View>
      ) : isError ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Couldn’t load projects</Text>
          <Pressable onPress={() => refetch()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={projects ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No projects yet</Text>
              <Text style={styles.emptyBody}>
                Add a client job with a brief, GitHub link, and Render preview URL.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <ProjectCard
              project={item}
              onPress={() => router.push(`/(tabs)/projects/${item.id}`)}
              onDelete={() => handleDelete(item)}
            />
          )}
        />
      )}

      <Pressable
        style={styles.fab}
        onPress={() => setShowCreate(true)}
        accessibilityRole="button"
        accessibilityLabel="Create project"
      >
        <Ionicons name="add" size={28} color={colors.white} />
      </Pressable>

      <Modal
        visible={showCreate}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreate(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New project</Text>
              <Pressable onPress={() => setShowCreate(false)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Acme Portal"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            <Text style={styles.fieldLabel}>Brief</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={brief}
              onChangeText={setBrief}
              placeholder="What is this project?"
              placeholderTextColor={colors.textMuted}
              multiline
            />
            <Text style={styles.fieldLabel}>GitHub URL</Text>
            <TextInput
              style={styles.input}
              value={githubUrl}
              onChangeText={setGithubUrl}
              placeholder="https://github.com/…"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.fieldLabel}>Preview URL (Render)</Text>
            <TextInput
              style={styles.input}
              value={previewUrl}
              onChangeText={setPreviewUrl}
              placeholder="https://….onrender.com"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable
              style={[
                styles.createBtn,
                (!name.trim() || createMutation.isPending) && styles.createBtnDisabled,
              ]}
              disabled={!name.trim() || createMutation.isPending}
              onPress={handleCreate}
            >
              {createMutation.isPending ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.createBtnText}>Create project</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function createCardStyles(colors: ColorPalette) {
  return {
    card: {
      backgroundColor: colors.surface,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.md,
      marginBottom: SPACING.md,
      borderWidth: 1,
      borderColor: colors.border,
      ...SHADOW.sm,
    },
    cardTop: {
      flexDirection: "row" as const,
      alignItems: "flex-start" as const,
      gap: SPACING.sm,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: colors.primaryMuted,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    cardInfo: { flex: 1 },
    cardTitle: {
      fontSize: FONT_SIZE.md,
      fontWeight: FONT_WEIGHT.semibold,
      color: colors.textPrimary,
      marginBottom: 2,
    },
    cardBrief: {
      fontSize: FONT_SIZE.sm,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    cardMeta: {
      fontSize: FONT_SIZE.sm,
      color: colors.textMuted,
    },
    cardFooter: {
      flexDirection: "row" as const,
      gap: SPACING.sm,
      marginTop: SPACING.md,
      flexWrap: "wrap" as const,
    },
    chip: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 4,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 4,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: colors.backgroundSubtle,
    },
    chipText: {
      fontSize: FONT_SIZE.caption,
      color: colors.textSecondary,
      fontWeight: FONT_WEIGHT.medium,
    },
  };
}

function createStyles(colors: ColorPalette) {
  return {
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    pad: {
      padding: LAYOUT.screenPaddingH,
    },
    list: {
      padding: LAYOUT.screenPaddingH,
      paddingBottom: 100,
      flexGrow: 1,
    },
    empty: {
      alignItems: "center" as const,
      justifyContent: "center" as const,
      paddingVertical: SPACING.xxl,
      paddingHorizontal: SPACING.lg,
      gap: SPACING.sm,
    },
    emptyTitle: {
      fontSize: FONT_SIZE.lg,
      fontWeight: FONT_WEIGHT.semibold,
      color: colors.textPrimary,
      marginTop: SPACING.sm,
    },
    emptyBody: {
      fontSize: FONT_SIZE.sm,
      color: colors.textSecondary,
      textAlign: "center" as const,
      lineHeight: 20,
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
    fab: {
      position: "absolute" as const,
      right: LAYOUT.screenPaddingH,
      bottom: SPACING.lg,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primary,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      ...SHADOW.glow,
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
      maxHeight: "92%",
    },
    modalHeader: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      marginBottom: SPACING.lg,
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
    createBtn: {
      marginTop: SPACING.lg,
      height: LAYOUT.buttonHeight,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: colors.primary,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    createBtnDisabled: {
      opacity: 0.5,
    },
    createBtnText: {
      color: colors.white,
      fontSize: FONT_SIZE.md,
      fontWeight: FONT_WEIGHT.semibold,
    },
  };
}
