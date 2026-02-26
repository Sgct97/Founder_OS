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
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";

import {
  BORDER_RADIUS,
  COLORS,
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

const STATUS_CONFIG: Record<
  DocumentStatus,
  {
    label: string;
    description: string;
    color: string;
    bg: string;
    icon: keyof typeof Ionicons.glyphMap;
  }
> = {
  queued: {
    label: "Queued",
    description: "Waiting to be processed…",
    color: COLORS.textTertiary,
    bg: COLORS.backgroundSubtle,
    icon: "time-outline",
  },
  processing: {
    label: "Processing",
    description: "Parsing, chunking, and generating embeddings…",
    color: COLORS.info,
    bg: COLORS.infoMuted,
    icon: "sync-outline",
  },
  ready: {
    label: "Ready",
    description: "Document is indexed and available for AI search.",
    color: COLORS.success,
    bg: COLORS.successMuted,
    icon: "checkmark-circle",
  },
  failed: {
    label: "Failed",
    description: "An error occurred during processing.",
    color: COLORS.error,
    bg: COLORS.errorMuted,
    icon: "alert-circle",
  },
};

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
  return (
    <View style={styles.metaRow}>
      <View style={styles.metaIconContainer}>
        <Ionicons name={icon} size={16} color={COLORS.textTertiary} />
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

  const handleDelete = useCallback(() => {
    if (!id) return;
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
  }, [id, deleteDocument, router]);

  // Use polled status if available, falling back to the document's status.
  const currentStatus: DocumentStatus =
    (statusData?.status as DocumentStatus) ??
    (document?.status as DocumentStatus) ??
    "queued";
  const statusConfig = STATUS_CONFIG[currentStatus];
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
        <View style={[styles.statusCard, { borderLeftColor: COLORS.borderLight }]}>
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
        <Ionicons name="alert-circle" size={32} color={COLORS.error} />
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
          <Ionicons name="trash-outline" size={18} color={COLORS.error} />
          <Text style={[styles.actionButtonText, { color: COLORS.error }]}>
            Delete Document
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

// ── Styles ──────────────────────────────────────────────────

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
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
    paddingHorizontal: LAYOUT.screenPaddingH,
  },
  errorTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
  },
  backButton: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.primaryMuted,
  },
  backButtonText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.primary,
  },

  // ── Status Hero Card ───────────────────────────────────
  statusCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderLeftWidth: 4,
    marginBottom: SPACING.lg,
    ...SHADOW.md,
  },
  statusCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  statusIconBg: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
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
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  progressIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
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
    color: COLORS.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: SPACING.md,
  },
  metaCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    ...SHADOW.sm,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.sm,
  },
  metaIconContainer: {
    width: 32,
    height: 32,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.backgroundSubtle,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.md,
  },
  metaContent: {
    flex: 1,
  },
  metaLabel: {
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.textTertiary,
    marginBottom: 1,
  },
  metaValue: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
  },
  metaDivider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
  },

  // ── Actions ────────────────────────────────────────────
  actionsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.sm,
    marginBottom: SPACING.lg,
    ...SHADOW.sm,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
  },
  actionButtonDanger: {
    backgroundColor: COLORS.errorMuted,
  },
  actionButtonText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
  },
});

