/**
 * Document detail screen — shows metadata, processing status,
 * and actions for a single uploaded document.
 *
 * Premium design with animated status indicator, metadata grid,
 * and contextual actions. Polls status while processing.
 */

import React, { useCallback, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";

import type { ColorPalette } from "@/constants/theme";
import { useThemedStyles } from "@/hooks/use-themed-styles";
import { useTheme } from "@/hooks/use-theme";
import {
  BORDER_RADIUS,
  FONT_SIZE,
  FONT_WEIGHT,
  LAYOUT,
  SHADOW,
  SPACING,
} from "@/constants/theme";
import { Skeleton, SkeletonMetadataCard } from "@/components/ui/Skeleton";
import {
  useDeleteDocument,
  useDocument,
  useDocumentStatus,
} from "@/hooks/use-documents";
import type { DocumentStatus } from "@/types/documents";

// ── Helpers ──────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getStatusConfig(
  colors: ColorPalette
): Record<
  DocumentStatus,
  {
    label: string;
    description: string;
    color: string;
    bg: string;
    icon: keyof typeof Ionicons.glyphMap;
  }
> {
  return {
    queued: {
      label: "Queued",
      description: "Waiting to be processed…",
      color: colors.textTertiary,
      bg: colors.backgroundSubtle,
      icon: "time-outline",
    },
    processing: {
      label: "Processing",
      description: "Parsing, chunking, and generating embeddings…",
      color: colors.info,
      bg: colors.infoMuted,
      icon: "sync-outline",
    },
    ready: {
      label: "Ready",
      description: "Document is indexed and available for AI search.",
      color: colors.success,
      bg: colors.successMuted,
      icon: "checkmark-circle",
    },
    failed: {
      label: "Failed",
      description: "An error occurred during processing.",
      color: colors.error,
      bg: colors.errorMuted,
      icon: "alert-circle",
    },
  };
}

const FILE_TYPE_LABELS: Record<string, string> = {
  pdf: "PDF Document",
  md: "Markdown",
  txt: "Plain Text",
  csv: "CSV Spreadsheet",
  json: "JSON Data",
  html: "HTML Page",
  htm: "HTML Page",
  yaml: "YAML Config",
  yml: "YAML Config",
  xml: "XML Document",
  log: "Log File",
  rst: "reStructuredText",
};

// ── Metadata Row ────────────────────────────────────────────

function MetadataRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.metaRow}>
      <View style={styles.metaIconContainer}>
        <Ionicons name={icon} size={16} color={colors.textTertiary} />
      </View>
      <View style={styles.metaContent}>
        <Text style={styles.metaLabel}>{label}</Text>
        <Text style={styles.metaValue}>{value}</Text>
      </View>
    </View>
  );
}

// ── Main Screen ─────────────────────────────────────────────

export default function DocumentDetailScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { data: document, isLoading, error } = useDocument(id);
  const { data: statusData } = useDocumentStatus(id);
  const deleteDocument = useDeleteDocument();

  // Update header title when document loads.
  useEffect(() => {
    if (document?.title) {
      navigation.setOptions({ title: document.title });
    }
  }, [document?.title, navigation]);

  const handleDelete = useCallback(async () => {
    if (!id) return;

    if (Platform.OS === "web") {
      if (window.confirm("This will permanently delete this document and all its processed data. This cannot be undone.")) {
        await deleteDocument.mutateAsync(id);
        router.back();
      }
    } else {
      Alert.alert(
        "Delete Document",
        "This will permanently delete this document and all its processed data. This cannot be undone.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              await deleteDocument.mutateAsync(id);
              router.back();
            },
          },
        ]
      );
    }
  }, [id, deleteDocument, router]);

  // Use polled status if available, falling back to the document's status.
  const currentStatus: DocumentStatus =
    (statusData?.status as DocumentStatus) ??
    (document?.status as DocumentStatus) ??
    "queued";
  const statusConfig = getStatusConfig(colors)[currentStatus];
  const effectiveChunkCount =
    statusData?.chunk_count ?? document?.chunk_count ?? null;

  if (isLoading || !document) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Status hero card skeleton */}
        <View style={[styles.statusCard, { borderLeftColor: colors.borderLight }]}>
          <View style={styles.statusCardTop}>
            <Skeleton width={48} height={48} borderRadius={BORDER_RADIUS.md} />
            <View style={{ flex: 1, marginLeft: SPACING.md }}>
              <Skeleton width="40%" height={16} />
              <Skeleton width="70%" height={12} style={{ marginTop: 8 }} />
            </View>
          </View>
        </View>

        {/* Metadata skeleton */}
        <Skeleton width={60} height={10} style={{ marginBottom: SPACING.md }} />
        <SkeletonMetadataCard />
      </ScrollView>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={32} color={colors.error} />
        <Text style={styles.errorTitle}>Document Not Found</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Status Hero Card */}
      <View style={[styles.statusCard, { borderLeftColor: statusConfig.color }]}>
        <View style={styles.statusCardTop}>
          <View
            style={[styles.statusIconBg, { backgroundColor: statusConfig.bg }]}
          >
            <Ionicons
              name={statusConfig.icon}
              size={24}
              color={statusConfig.color}
            />
          </View>
          <View style={styles.statusCardContent}>
            <Text
              style={[styles.statusLabel, { color: statusConfig.color }]}
            >
              {statusConfig.label}
            </Text>
            <Text style={styles.statusDescription}>
              {currentStatus === "failed" && statusData?.error_message
                ? statusData.error_message
                : statusConfig.description}
            </Text>
          </View>
        </View>
        {(currentStatus === "queued" || currentStatus === "processing") && (
          <View style={styles.progressIndicator}>
            <ActivityIndicator color={statusConfig.color} size="small" />
            <Text style={[styles.progressText, { color: statusConfig.color }]}>
              {currentStatus === "queued"
                ? "Waiting in queue…"
                : "Processing document…"}
            </Text>
          </View>
        )}
      </View>

      {/* Metadata Section */}
      <Text style={styles.sectionTitle}>Details</Text>
      <View style={styles.metaCard}>
        <MetadataRow
          icon="document-text-outline"
          label="File Type"
          value={FILE_TYPE_LABELS[document.file_type] ?? document.file_type}
        />
        <View style={styles.metaDivider} />
        <MetadataRow
          icon="folder-outline"
          label="File Size"
          value={formatFileSize(document.file_size_bytes)}
        />
        <View style={styles.metaDivider} />
        <MetadataRow
          icon="layers-outline"
          label="Chunks"
          value={
            effectiveChunkCount != null
              ? `${effectiveChunkCount} text chunks`
              : "—"
          }
        />
        <View style={styles.metaDivider} />
        <MetadataRow
          icon="person-outline"
          label="Uploaded by"
          value={document.uploader.display_name}
        />
        <View style={styles.metaDivider} />
        <MetadataRow
          icon="calendar-outline"
          label="Uploaded"
          value={formatDateTime(document.created_at)}
        />
        <View style={styles.metaDivider} />
        <MetadataRow
          icon="refresh-outline"
          label="Last Updated"
          value={formatDateTime(document.updated_at)}
        />
      </View>

      {/* Actions Section */}
      <Text style={styles.sectionTitle}>Actions</Text>
      <View style={styles.actionsCard}>
        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            styles.actionButtonDanger,
            pressed && { opacity: 0.7 },
          ]}
          onPress={handleDelete}
        >
          <Ionicons name="trash-outline" size={18} color={colors.error} />
          <Text style={[styles.actionButtonText, { color: colors.error }]}>
            Delete Document
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

// ── Styles ──────────────────────────────────────────────────

function createStyles(colors: ColorPalette) {
  return {
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      paddingHorizontal: LAYOUT.screenPaddingH,
      paddingTop: SPACING.lg,
      paddingBottom: SPACING.xxxl,
    },
    loadingContainer: {
      flex: 1,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      backgroundColor: colors.background,
    },
    errorContainer: {
      flex: 1,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      backgroundColor: colors.background,
      paddingHorizontal: LAYOUT.screenPaddingH,
    },
    errorTitle: {
      fontSize: FONT_SIZE.lg,
      fontWeight: FONT_WEIGHT.semibold,
      color: colors.textPrimary,
      marginTop: SPACING.md,
      marginBottom: SPACING.md,
    },
    backButton: {
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
      borderRadius: BORDER_RADIUS.sm,
      backgroundColor: colors.primaryMuted,
    },
    backButtonText: {
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.semibold,
      color: colors.primary,
    },

    // ── Status Hero Card ───────────────────────────────────
    statusCard: {
      backgroundColor: colors.surface,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.lg,
      borderLeftWidth: 4,
      marginBottom: SPACING.lg,
      ...SHADOW.md,
    },
    statusCardTop: {
      flexDirection: "row" as const,
      alignItems: "flex-start" as const,
    },
    statusIconBg: {
      width: 48,
      height: 48,
      borderRadius: BORDER_RADIUS.md,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginRight: SPACING.md,
    },
    statusCardContent: {
      flex: 1,
    },
    statusLabel: {
      fontSize: FONT_SIZE.lg,
      fontWeight: FONT_WEIGHT.bold,
      letterSpacing: -0.2,
      marginBottom: SPACING.xxs,
    },
    statusDescription: {
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.regular,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    progressIndicator: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      marginTop: SPACING.md,
      paddingTop: SPACING.md,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
      gap: SPACING.sm,
    },
    progressText: {
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.medium,
    },

    // ── Metadata ───────────────────────────────────────────
    sectionTitle: {
      fontSize: FONT_SIZE.xs,
      fontWeight: FONT_WEIGHT.semibold,
      color: colors.textTertiary,
      textTransform: "uppercase" as const,
      letterSpacing: 0.8,
      marginBottom: SPACING.md,
    },
    metaCard: {
      backgroundColor: colors.surface,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.md,
      marginBottom: SPACING.lg,
      ...SHADOW.sm,
    },
    metaRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingVertical: SPACING.sm,
    },
    metaIconContainer: {
      width: 32,
      height: 32,
      borderRadius: BORDER_RADIUS.sm,
      backgroundColor: colors.backgroundSubtle,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginRight: SPACING.md,
    },
    metaContent: {
      flex: 1,
    },
    metaLabel: {
      fontSize: FONT_SIZE.caption,
      fontWeight: FONT_WEIGHT.medium,
      color: colors.textTertiary,
      marginBottom: 1,
    },
    metaValue: {
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.semibold,
      color: colors.textPrimary,
    },
    metaDivider: {
      height: 1,
      backgroundColor: colors.borderLight,
    },

    // ── Actions ────────────────────────────────────────────
    actionsCard: {
      backgroundColor: colors.surface,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.sm,
      marginBottom: SPACING.lg,
      ...SHADOW.sm,
    },
    actionButton: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      gap: SPACING.sm,
    },
    actionButtonDanger: {
      backgroundColor: colors.errorMuted,
    },
    actionButtonText: {
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.semibold,
    },
  };
}
