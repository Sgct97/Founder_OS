/**
 * Knowledge Base screen — document list + upload entry point.
 *
 * Ultra-premium document management with status indicators,
 * file type badges, upload flow via expo-document-picker,
 * and a FAB to open the AI chat assistant.
 */

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";

import {
  BORDER_RADIUS,
  COLORS,
  FONT_SIZE,
  FONT_WEIGHT,
  LAYOUT,
  SHADOW,
  SPACING,
} from "@/constants/theme";
import {
  SkeletonDocumentCard,
  SkeletonStatsRow,
} from "@/components/ui/Skeleton";
import {
  useDeleteDocument,
  useDocuments,
  useUploadDocument,
} from "@/hooks/use-documents";
import type { DocumentResponse, DocumentStatus } from "@/types/documents";

// ── Helpers ──────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const STATUS_CONFIG: Record<
  DocumentStatus,
  { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  queued: {
    label: "Queued",
    color: COLORS.textTertiary,
    bg: COLORS.backgroundSubtle,
    icon: "time-outline",
  },
  processing: {
    label: "Processing",
    color: COLORS.info,
    bg: COLORS.infoMuted,
    icon: "sync-outline",
  },
  ready: {
    label: "Ready",
    color: COLORS.success,
    bg: COLORS.successMuted,
    icon: "checkmark-circle",
  },
  failed: {
    label: "Failed",
    color: COLORS.error,
    bg: COLORS.errorMuted,
    icon: "alert-circle",
  },
};

const FILE_TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  pdf: "document-text",
  md: "code-slash",
  txt: "reader",
  csv: "grid",
  json: "code",
  html: "globe",
  htm: "globe",
  yaml: "settings",
  yml: "settings",
  xml: "code-working",
  log: "terminal",
  rst: "reader",
};

// ── Status Badge ────────────────────────────────────────────

function StatusBadge({ status }: { status: DocumentStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
      <Ionicons name={config.icon} size={12} color={config.color} />
      <Text style={[styles.statusText, { color: config.color }]}>
        {config.label}
      </Text>
    </View>
  );
}

// ── Document Card ───────────────────────────────────────────

interface DocumentCardProps {
  document: DocumentResponse;
  onPress: (id: string) => void;
  onDelete: (id: string) => void;
}

function DocumentCard({ document, onPress, onDelete }: DocumentCardProps) {
  const iconName = FILE_TYPE_ICONS[document.file_type] ?? "document";

  const handleLongPress = useCallback(() => {
    Alert.alert("Document", undefined, [
      {
        text: "Delete",
        style: "destructive",
        onPress: () => onDelete(document.id),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [document.id, onDelete]);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => onPress(document.id)}
      onLongPress={handleLongPress}
      delayLongPress={500}
    >
      {/* File type icon */}
      <View style={styles.cardIconContainer}>
        <Ionicons name={iconName} size={22} color={COLORS.primary} />
      </View>

      {/* Content */}
      <View style={styles.cardContent}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {document.title}
          </Text>
          <StatusBadge status={document.status} />
        </View>

        <View style={styles.cardMeta}>
          <Text style={styles.cardMetaText}>
            .{document.file_type.toUpperCase()}
          </Text>
          <View style={styles.metaDot} />
          <Text style={styles.cardMetaText}>
            {formatFileSize(document.file_size_bytes)}
          </Text>
          {document.chunk_count != null && (
            <>
              <View style={styles.metaDot} />
              <Text style={styles.cardMetaText}>
                {document.chunk_count} chunks
              </Text>
            </>
          )}
          <View style={styles.metaDot} />
          <Text style={styles.cardMetaText}>
            {formatRelativeTime(document.created_at)}
          </Text>
        </View>

        {document.error_message && (
          <Text style={styles.errorMessage} numberOfLines={2}>
            {document.error_message}
          </Text>
        )}
      </View>

      {/* Chevron */}
      <Ionicons
        name="chevron-forward"
        size={18}
        color={COLORS.textMuted}
        style={styles.cardChevron}
      />
    </Pressable>
  );
}

// ── Upload Button ───────────────────────────────────────────

function UploadButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.uploadButton,
        pressed && styles.uploadButtonPressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.uploadIconContainer}>
        <Ionicons name="cloud-upload" size={20} color={COLORS.primary} />
      </View>
      <View style={styles.uploadTextContainer}>
        <Text style={styles.uploadTitle}>Upload Document</Text>
        <Text style={styles.uploadSubtitle}>PDF, Markdown, CSV, HTML, JSON, and more</Text>
      </View>
      <Ionicons name="add-circle" size={24} color={COLORS.primary} />
    </Pressable>
  );
}

// ── Empty State ─────────────────────────────────────────────

function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="library" size={32} color={COLORS.primary} />
      </View>
      <Text style={styles.emptyTitle}>Your Knowledge Base</Text>
      <Text style={styles.emptyBody}>
        Upload documents to build a private, searchable knowledge base. Ask your
        AI assistant anything — it answers only from your data.
      </Text>
      <Pressable
        style={({ pressed }) => [
          styles.emptyUploadBtn,
          pressed && { opacity: 0.85 },
        ]}
        onPress={onUpload}
      >
        <Ionicons name="cloud-upload" size={18} color={COLORS.white} />
        <Text style={styles.emptyUploadText}>Upload Your First Document</Text>
      </Pressable>
      <View style={styles.chip}>
        <Ionicons
          name="document-outline"
          size={14}
          color={COLORS.textTertiary}
        />
        <Text style={styles.chipText}>
          PDF, CSV, HTML, JSON, Markdown, and more
        </Text>
      </View>
    </View>
  );
}

// ── Main Screen ─────────────────────────────────────────────

export default function KnowledgeScreen() {
  const router = useRouter();
  const {
    data: documents,
    isLoading,
    error,
    refetch,
  } = useDocuments();
  const uploadDocument = useUploadDocument();
  const deleteDocument = useDeleteDocument();
  const [refreshing, setRefreshing] = useState(false);

  const sortedDocuments = useMemo(() => {
    if (!documents) return [];
    return [...documents].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [documents]);

  const stats = useMemo(() => {
    if (!documents) return { total: 0, ready: 0, processing: 0 };
    return {
      total: documents.length,
      ready: documents.filter((d) => d.status === "ready").length,
      processing: documents.filter(
        (d) => d.status === "queued" || d.status === "processing"
      ).length,
    };
  }, [documents]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleUpload = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "text/plain",
          "text/markdown",
          "text/x-markdown",
          "text/csv",
          "application/json",
          "text/html",
          "text/yaml",
          "text/xml",
          "application/xml",
          "application/x-yaml",
          "text/x-rst",
          "text/restructuredtext",
          "text/x-log",
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0)
        return;

      const asset = result.assets[0];
      await uploadDocument.mutateAsync({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? "application/octet-stream",
        // On web, expo-document-picker provides a File object.
        file: (asset as unknown as { file?: File }).file,
      });
    } catch (err) {
      Alert.alert(
        "Upload Failed",
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
    }
  }, [uploadDocument]);

  const handleDocumentPress = useCallback(
    (documentId: string) => {
      router.push(`/(tabs)/knowledge/${documentId}`);
    },
    [router]
  );

  const handleDeleteDocument = useCallback(
    (documentId: string) => {
      Alert.alert(
        "Delete Document",
        "This will permanently delete this document and all its processed data.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => deleteDocument.mutate(documentId),
          },
        ]
      );
    },
    [deleteDocument]
  );

  const handleOpenChat = useCallback(() => {
    router.push("/(tabs)/knowledge/chat");
  }, [router]);

  // ── Loading state (skeleton)
  if (isLoading && !documents) {
    return (
      <View style={styles.screen}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <SkeletonStatsRow />
          {[0, 1, 2, 3].map((i) => (
            <SkeletonDocumentCard key={i} />
          ))}
        </ScrollView>
      </View>
    );
  }

  // ── Error state
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={32} color={COLORS.error} />
        <Text style={styles.errorTitle}>Failed to load documents</Text>
        <Pressable style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  const hasDocuments = sortedDocuments.length > 0;

  return (
    <View style={styles.screen}>
      {hasDocuments ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.primary}
            />
          }
        >
          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.total}</Text>
              <Text style={styles.statLabel}>Documents</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: COLORS.success }]}>
                {stats.ready}
              </Text>
              <Text style={styles.statLabel}>Ready</Text>
            </View>
            {stats.processing > 0 && (
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: COLORS.info }]}>
                  {stats.processing}
                </Text>
                <Text style={styles.statLabel}>Processing</Text>
              </View>
            )}
          </View>

          {/* Upload Button */}
          <UploadButton onPress={handleUpload} />

          {/* Uploading indicator */}
          {uploadDocument.isPending && (
            <View style={styles.uploadingBanner}>
              <ActivityIndicator color={COLORS.primary} size="small" />
              <Text style={styles.uploadingText}>
                Uploading document…
              </Text>
            </View>
          )}

          {/* Document List */}
          <Text style={styles.sectionTitle}>Documents</Text>
          {sortedDocuments.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              onPress={handleDocumentPress}
              onDelete={handleDeleteDocument}
            />
          ))}
        </ScrollView>
      ) : (
        <EmptyState onUpload={handleUpload} />
      )}

      {/* FAB — AI Chat */}
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
        onPress={handleOpenChat}
      >
        <Ionicons name="chatbubble-ellipses" size={26} color={COLORS.white} />
      </Pressable>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
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
  retryButton: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.primaryMuted,
  },
  retryText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: LAYOUT.screenPaddingH,
    paddingTop: SPACING.lg,
    paddingBottom: 100,
  },

  // ── Stats Row ──────────────────────────────────────────
  statsRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: "center",
    ...SHADOW.sm,
  },
  statValue: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.textTertiary,
    marginTop: SPACING.xxs,
  },

  // ── Upload Button ──────────────────────────────────────
  uploadButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "dashed",
  },
  uploadButtonPressed: {
    opacity: 0.7,
  },
  uploadIconContainer: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.md,
  },
  uploadTextContainer: {
    flex: 1,
  },
  uploadTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  uploadSubtitle: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.regular,
    color: COLORS.textTertiary,
  },

  // ── Uploading Banner ───────────────────────────────────
  uploadingBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primaryMuted,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  uploadingText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.primary,
  },

  // ── Section Title ──────────────────────────────────────
  sectionTitle: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: SPACING.md,
  },

  // ── Document Card ──────────────────────────────────────
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOW.sm,
  },
  cardPressed: {
    opacity: 0.7,
  },
  cardIconContainer: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.md,
  },
  cardContent: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.xxs,
  },
  cardTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
    flex: 1,
    marginRight: SPACING.sm,
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  cardMetaText: {
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.textTertiary,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.textMuted,
  },
  cardChevron: {
    marginLeft: SPACING.sm,
  },
  errorMessage: {
    fontSize: FONT_SIZE.caption,
    color: COLORS.error,
    fontWeight: FONT_WEIGHT.regular,
    marginTop: SPACING.xxs,
  },

  // ── Status Badge ───────────────────────────────────────
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.xxs,
  },
  statusText: {
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.semibold,
  },

  // ── Empty State ────────────────────────────────────────
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: LAYOUT.screenPaddingH,
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
    letterSpacing: -0.3,
  },
  emptyBody: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.regular,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 320,
    marginBottom: SPACING.lg,
  },
  emptyUploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
    ...SHADOW.glow,
  },
  emptyUploadText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.white,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: BORDER_RADIUS.full,
    paddingVertical: SPACING.xs + 2,
    paddingHorizontal: SPACING.md,
    ...SHADOW.sm,
  },
  chipText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textTertiary,
    fontWeight: FONT_WEIGHT.medium,
    marginLeft: SPACING.xs,
  },

  // ── FAB ────────────────────────────────────────────────
  fab: {
    position: "absolute",
    bottom: 24,
    right: LAYOUT.screenPaddingH,
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOW.glow,
  },
});
