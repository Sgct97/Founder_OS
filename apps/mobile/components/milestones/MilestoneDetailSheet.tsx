/**
 * MilestoneDetailSheet — Premium slide-up detail card for a milestone.
 *
 * Shows full title, description, status toggle, notes editor,
 * attachments section, timestamps, and quick actions (edit, delete).
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
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
import * as DocumentPicker from "expo-document-picker";

import { API_BASE_URL } from "@/constants/api";
import { getAccessToken } from "@/services/api";

import {
  useDeleteAttachment,
  useMilestoneAttachments,
  useUpdateMilestone,
  useUploadAttachment,
} from "@/hooks/use-milestones";
import type { MilestoneAttachment, MilestoneResponse, MilestoneStatus } from "@/types/milestones";
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

// ── Status Helpers ───────────────────────────────────────────

function getStatusMeta(
  colors: ColorPalette
): Record<
  MilestoneStatus,
  {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    bg: string;
  }
> {
  return {
    not_started: {
      label: "Not Started",
      icon: "ellipse-outline",
      color: colors.textMuted,
      bg: colors.backgroundSubtle,
    },
    in_progress: {
      label: "In Progress",
      icon: "time-outline",
      color: colors.warning,
      bg: colors.warningMuted,
    },
    completed: {
      label: "Completed",
      icon: "checkmark-circle",
      color: colors.success,
      bg: colors.successMuted,
    },
  };
}

const STATUS_ORDER: MilestoneStatus[] = [
  "not_started",
  "in_progress",
  "completed",
];

// ── File type icon mapping ───────────────────────────────────

const FILE_TYPE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  pdf: "document-text-outline",
  doc: "document-text-outline",
  docx: "document-text-outline",
  xls: "grid-outline",
  xlsx: "grid-outline",
  ppt: "easel-outline",
  pptx: "easel-outline",
  png: "image-outline",
  jpg: "image-outline",
  jpeg: "image-outline",
  gif: "image-outline",
  webp: "image-outline",
  svg: "image-outline",
  csv: "grid-outline",
  json: "code-slash-outline",
  html: "code-slash-outline",
  htm: "code-slash-outline",
  md: "reader-outline",
  txt: "reader-outline",
  yaml: "code-slash-outline",
  yml: "code-slash-outline",
  xml: "code-slash-outline",
  rst: "reader-outline",
  log: "terminal-outline",
};

function getFileIcon(fileType: string): keyof typeof Ionicons.glyphMap {
  return FILE_TYPE_ICON[fileType] || "document-outline";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ── Component ────────────────────────────────────────────────

interface MilestoneDetailSheetProps {
  milestone: MilestoneResponse | null;
  phaseName: string;
  visible: boolean;
  onClose: () => void;
  onEdit: (milestone: MilestoneResponse) => void;
  onDelete: (id: string) => void;
  onChat?: (milestone: MilestoneResponse) => void;
}

export default function MilestoneDetailSheet({
  milestone,
  phaseName,
  visible,
  onClose,
  onEdit,
  onDelete,
  onChat,
}: MilestoneDetailSheetProps): React.JSX.Element {
  const s = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const STATUS_META = getStatusMeta(colors);
  const updateMilestone = useUpdateMilestone();
  const uploadAttachment = useUploadAttachment();
  const deleteAttachment = useDeleteAttachment();
  const { data: attachments = [], isLoading: loadingAttachments } =
    useMilestoneAttachments(milestone?.id);

  const [notes, setNotes] = useState(milestone?.notes ?? "");
  const [notesDirty, setNotesDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const slideAnim = useRef(new Animated.Value(400)).current;

  // Sync notes when milestone changes
  useEffect(() => {
    setNotes(milestone?.notes ?? "");
    setNotesDirty(false);
  }, [milestone?.id, milestone?.notes]);

  // Slide in/out
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      slideAnim.setValue(400);
    }
  }, [visible, slideAnim]);

  const handleStatusChange = useCallback(
    (newStatus: MilestoneStatus) => {
      if (!milestone || newStatus === milestone.status) return;
      updateMilestone.mutate({
        milestoneId: milestone.id,
        payload: { status: newStatus },
      });
    },
    [milestone, updateMilestone]
  );

  const handleSaveNotes = useCallback(async () => {
    if (!milestone || !notesDirty) return;
    setSaving(true);
    try {
      await updateMilestone.mutateAsync({
        milestoneId: milestone.id,
        payload: { notes: notes || null },
      });
      setNotesDirty(false);
    } finally {
      setSaving(false);
    }
  }, [milestone, notes, notesDirty, updateMilestone]);

  const handleClose = useCallback(() => {
    if (notesDirty && milestone) {
      // Auto-save notes on close
      updateMilestone.mutate({
        milestoneId: milestone.id,
        payload: { notes: notes || null },
      });
    }
    onClose();
  }, [notesDirty, milestone, notes, updateMilestone, onClose]);

  const handlePickFile = useCallback(async () => {
    if (!milestone) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || result.assets.length === 0) return;

      const asset = result.assets[0];
      if (!asset) return;

      // On web, asset.file is the real File object — use it directly.
      // On native, FormData polyfill understands the { uri, name, type } shape.
      const file: File | { uri: string; name: string; type: string } =
        Platform.OS === "web" && (asset as unknown as { file?: File }).file
          ? (asset as unknown as { file: File }).file
          : {
              uri: asset.uri,
              name: asset.name,
              type: asset.mimeType || "application/octet-stream",
            };

      uploadAttachment.mutate({
        milestoneId: milestone.id,
        file,
      });
    } catch (err) {
      console.error("File pick failed:", err);
    }
  }, [milestone, uploadAttachment]);

  const handleDeleteAttachment = useCallback(
    (attachment: MilestoneAttachment) => {
      if (!milestone) return;

      const doDelete = () => {
        deleteAttachment.mutate({
          milestoneId: milestone.id,
          attachmentId: attachment.id,
        });
      };

      if (Platform.OS === "web") {
        if (window.confirm(`Delete "${attachment.filename}"?`)) {
          doDelete();
        }
      } else {
        Alert.alert(
          "Delete Attachment",
          `Are you sure you want to delete "${attachment.filename}"?`,
          [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: doDelete },
          ]
        );
      }
    },
    [milestone, deleteAttachment]
  );

  const handleDownloadAttachment = useCallback(
    async (attachment: MilestoneAttachment) => {
      if (!milestone) return;
      const url = `${API_BASE_URL}/api/v1/milestones/${milestone.id}/attachments/${attachment.id}/download`;

      if (Platform.OS === "web") {
        try {
          const token = await getAccessToken();
          const resp = await fetch(url, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (!resp.ok) throw new Error("Download failed");
          const blob = await resp.blob();
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = blobUrl;
          a.download = attachment.filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
        } catch (err) {
          console.error("Download failed:", err);
          window.alert("Failed to download file.");
        }
      } else {
        Linking.openURL(url).catch(() =>
          Alert.alert("Error", "Could not open download link.")
        );
      }
    },
    [milestone]
  );

  if (!milestone) return <></>;

  const meta = STATUS_META[milestone.status as MilestoneStatus];
  const created = new Date(milestone.created_at);
  const updated = new Date(milestone.updated_at);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable style={s.overlay} onPress={handleClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={s.keyboardAvoid}
        >
          <Animated.View
            style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}
          >
            <Pressable onPress={() => {}} style={s.sheetInner}>
              {/* Header row with handle bar and close button */}
              <View style={s.sheetHeaderRow}>
                <View style={s.handleBar} />
                <Pressable
                  style={s.closeButton}
                  onPress={handleClose}
                  hitSlop={12}
                >
                  <Ionicons name="close" size={20} color={colors.textSecondary} />
                </Pressable>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={s.scrollContent}
                keyboardShouldPersistTaps="handled"
              >
                {/* Phase badge */}
                <View style={s.phaseBadge}>
                  <Ionicons
                    name="layers-outline"
                    size={12}
                    color={colors.primary}
                  />
                  <Text style={s.phaseBadgeText}>{phaseName}</Text>
                </View>

                {/* Title */}
                <Text style={s.title}>{milestone.title}</Text>

                {/* Description */}
                {milestone.description ? (
                  <Text style={s.description}>{milestone.description}</Text>
                ) : null}

                {/* Status Selector */}
                <Text style={s.sectionLabel}>Status</Text>
                <View style={s.statusRow}>
                  {STATUS_ORDER.map((st) => {
                    const m = STATUS_META[st];
                    const isActive = milestone.status === st;
                    return (
                      <Pressable
                        key={st}
                        style={[
                          s.statusChip,
                          isActive && { backgroundColor: m.bg, borderColor: m.color },
                        ]}
                        onPress={() => handleStatusChange(st)}
                      >
                        <Ionicons
                          name={m.icon}
                          size={14}
                          color={isActive ? m.color : colors.textMuted}
                        />
                        <Text
                          style={[
                            s.statusChipText,
                            isActive && { color: m.color },
                          ]}
                        >
                          {m.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Notes */}
                <View style={s.notesHeader}>
                  <Text style={s.sectionLabel}>Notes</Text>
                  {notesDirty && (
                    <Pressable style={s.saveBtn} onPress={handleSaveNotes}>
                      <Text style={s.saveBtnText}>
                        {saving ? "Saving..." : "Save"}
                      </Text>
                    </Pressable>
                  )}
                </View>
                <TextInput
                  style={s.notesInput}
                  value={notes}
                  onChangeText={(t) => {
                    setNotes(t);
                    setNotesDirty(true);
                  }}
                  placeholder="Add notes, blockers, links, thoughts..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  textAlignVertical="top"
                />

                {/* ── Attachments Section ─────────────────────── */}
                <View style={s.attachmentHeader}>
                  <Text style={s.sectionLabel}>Supporting Documents</Text>
                  <Pressable
                    style={s.uploadBtn}
                    onPress={handlePickFile}
                    disabled={uploadAttachment.isPending}
                  >
                    {uploadAttachment.isPending ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        <Ionicons
                          name="cloud-upload-outline"
                          size={14}
                          color={colors.primary}
                        />
                        <Text style={s.uploadBtnText}>Upload</Text>
                      </>
                    )}
                  </Pressable>
                </View>

                {uploadAttachment.isError && (
                  <View style={s.errorBanner}>
                    <Ionicons name="alert-circle" size={14} color={colors.error} />
                    <Text style={s.errorBannerText}>
                      Upload failed. Please try again.
                    </Text>
                  </View>
                )}

                {loadingAttachments ? (
                  <View style={s.attachmentLoading}>
                    <ActivityIndicator size="small" color={colors.textMuted} />
                    <Text style={s.attachmentLoadingText}>
                      Loading attachments...
                    </Text>
                  </View>
                ) : attachments.length === 0 ? (
                  <View style={s.emptyAttachments}>
                    <Ionicons
                      name="folder-open-outline"
                      size={28}
                      color={colors.borderLight}
                    />
                    <Text style={s.emptyAttachmentsText}>
                      No documents attached yet
                    </Text>
                    <Text style={s.emptyAttachmentsSubtext}>
                      Upload PDFs, images, spreadsheets, or any supporting files
                    </Text>
                  </View>
                ) : (
                  <View style={s.attachmentList}>
                    {attachments.map((att) => (
                      <View key={att.id} style={s.attachmentCard}>
                        <Pressable
                          style={s.attachmentTappable}
                          onPress={() => handleDownloadAttachment(att)}
                        >
                          <View style={s.attachmentIconWrap}>
                            <Ionicons
                              name={getFileIcon(att.file_type)}
                              size={18}
                              color={colors.primary}
                            />
                          </View>
                          <View style={s.attachmentInfo}>
                            <Text style={s.attachmentName} numberOfLines={1}>
                              {att.filename}
                            </Text>
                            <Text style={s.attachmentMeta}>
                              {att.file_type.toUpperCase()} · {formatFileSize(att.file_size_bytes)}
                            </Text>
                          </View>
                          <Ionicons
                            name="download-outline"
                            size={16}
                            color={colors.primary}
                          />
                        </Pressable>
                        <Pressable
                          style={s.attachmentDeleteBtn}
                          onPress={() => handleDeleteAttachment(att)}
                          hitSlop={8}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={16}
                            color={colors.textMuted}
                          />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}

                {/* Metadata */}
                <View style={s.metaRow}>
                  <View style={s.metaItem}>
                    <Ionicons
                      name="calendar-outline"
                      size={13}
                      color={colors.textMuted}
                    />
                    <Text style={s.metaText}>
                      Created{" "}
                      {created.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </Text>
                  </View>
                  <View style={s.metaItem}>
                    <Ionicons
                      name="time-outline"
                      size={13}
                      color={colors.textMuted}
                    />
                    <Text style={s.metaText}>
                      Updated{" "}
                      {updated.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </Text>
                  </View>
                </View>

                {/* AI Chat Button */}
                {onChat && (
                  <Pressable
                    style={s.chatBtn}
                    onPress={() => {
                      onClose();
                      setTimeout(() => onChat(milestone), 200);
                    }}
                  >
                    <View style={s.chatBtnIconWrap}>
                      <Ionicons name="sparkles" size={16} color={colors.white} />
                    </View>
                    <View style={s.chatBtnTextWrap}>
                      <Text style={s.chatBtnTitle}>Chat about this milestone</Text>
                      <Text style={s.chatBtnSubtitle}>
                        Get AI help with implementation, blockers & strategy
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                  </Pressable>
                )}

                {/* Actions */}
                <View style={s.actionRow}>
                  <Pressable
                    style={s.actionBtn}
                    onPress={() => {
                      onClose();
                      setTimeout(() => onEdit(milestone), 200);
                    }}
                  >
                    <Ionicons
                      name="pencil-outline"
                      size={16}
                      color={colors.textSecondary}
                    />
                    <Text style={s.actionBtnText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    style={[s.actionBtn, s.actionBtnDanger]}
                    onPress={() => {
                      onClose();
                      setTimeout(() => onDelete(milestone.id), 200);
                    }}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={16}
                      color={colors.error}
                    />
                    <Text style={[s.actionBtnText, s.actionBtnTextDanger]}>
                      Delete
                    </Text>
                  </Pressable>
                </View>
              </ScrollView>
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

// ── Styles ───────────────────────────────────────────────────

function createStyles(colors: ColorPalette) {
  return {
    overlay: {
      flex: 1,
      backgroundColor: colors.surfaceOverlay,
      justifyContent: "flex-end" as const,
    },
    keyboardAvoid: {
      justifyContent: "flex-end" as const,
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: BORDER_RADIUS.xxl,
      borderTopRightRadius: BORDER_RADIUS.xxl,
      maxHeight: "85%" as const,
      ...SHADOW.lg,
    },
    sheetInner: {
      flex: 1,
    },
    sheetHeaderRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      paddingTop: SPACING.sm + 4,
      paddingBottom: SPACING.sm,
      paddingHorizontal: SPACING.md,
      position: "relative" as const,
    },
    handleBar: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.borderLight,
    },
    closeButton: {
      position: "absolute" as const,
      right: SPACING.md,
      top: SPACING.sm,
      width: 32,
      height: 32,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: colors.backgroundSubtle,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    scrollContent: {
      paddingHorizontal: LAYOUT.screenPaddingH,
      paddingBottom: SPACING.xxxl,
    },

    // Phase badge
    phaseBadge: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      alignSelf: "flex-start" as const,
      gap: SPACING.xs,
      backgroundColor: colors.primaryMuted,
      paddingHorizontal: SPACING.sm + 2,
      paddingVertical: SPACING.xxs + 2,
      borderRadius: BORDER_RADIUS.full,
      marginBottom: SPACING.md,
    },
    phaseBadgeText: {
      fontSize: FONT_SIZE.xs,
      fontWeight: FONT_WEIGHT.semibold,
      color: colors.primary,
    },

    // Title & desc
    title: {
      fontSize: FONT_SIZE.xl,
      fontWeight: FONT_WEIGHT.bold,
      color: colors.textPrimary,
      letterSpacing: -0.3,
      marginBottom: SPACING.xs,
      lineHeight: 28,
    },
    description: {
      fontSize: FONT_SIZE.sm,
      color: colors.textSecondary,
      lineHeight: 22,
      marginBottom: SPACING.lg,
    },

    // Section label
    sectionLabel: {
      fontSize: FONT_SIZE.xs,
      fontWeight: FONT_WEIGHT.semibold,
      color: colors.textTertiary,
      textTransform: "uppercase" as const,
      letterSpacing: 0.8,
      marginBottom: SPACING.sm,
      marginTop: SPACING.lg,
    },

    // Status selector
    statusRow: {
      flexDirection: "row" as const,
      gap: SPACING.sm,
    },
    statusChip: {
      flex: 1,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: SPACING.xs,
      paddingVertical: SPACING.sm + 2,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: colors.backgroundSubtle,
      borderWidth: 1.5,
      borderColor: "transparent",
    },
    statusChipText: {
      fontSize: FONT_SIZE.xs,
      fontWeight: FONT_WEIGHT.semibold,
      color: colors.textMuted,
    },

    // Notes
    notesHeader: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
    },
    notesInput: {
      minHeight: 120,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: BORDER_RADIUS.md,
      padding: SPACING.md,
      fontSize: FONT_SIZE.sm,
      color: colors.textPrimary,
      backgroundColor: colors.background,
      lineHeight: 22,
    },
    saveBtn: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs + 2,
      borderRadius: BORDER_RADIUS.sm,
      backgroundColor: colors.primary,
      marginBottom: SPACING.sm,
      marginTop: SPACING.lg,
    },
    saveBtnText: {
      fontSize: FONT_SIZE.xs,
      fontWeight: FONT_WEIGHT.semibold,
      color: colors.white,
    },

    // ── Attachments ────────────────────────────────────────────
    attachmentHeader: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
    },
    uploadBtn: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: SPACING.xs,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs + 2,
      borderRadius: BORDER_RADIUS.sm,
      backgroundColor: colors.primaryMuted,
      marginBottom: SPACING.sm,
      marginTop: SPACING.lg,
    },
    uploadBtnText: {
      fontSize: FONT_SIZE.xs,
      fontWeight: FONT_WEIGHT.semibold,
      color: colors.primary,
    },

    errorBanner: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: SPACING.xs,
      backgroundColor: colors.errorMuted,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: BORDER_RADIUS.sm,
      marginBottom: SPACING.sm,
    },
    errorBannerText: {
      fontSize: FONT_SIZE.xs,
      color: colors.error,
      fontWeight: FONT_WEIGHT.medium,
    },

    attachmentLoading: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: SPACING.sm,
      paddingVertical: SPACING.lg,
    },
    attachmentLoadingText: {
      fontSize: FONT_SIZE.xs,
      color: colors.textMuted,
    },

    emptyAttachments: {
      alignItems: "center" as const,
      paddingVertical: SPACING.lg,
      paddingHorizontal: SPACING.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: BORDER_RADIUS.md,
      borderStyle: "dashed" as const,
      backgroundColor: colors.background,
    },
    emptyAttachmentsText: {
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.medium,
      color: colors.textTertiary,
      marginTop: SPACING.sm,
    },
    emptyAttachmentsSubtext: {
      fontSize: FONT_SIZE.xs,
      color: colors.textMuted,
      marginTop: SPACING.xxs,
      textAlign: "center" as const,
    },

    attachmentList: {
      gap: SPACING.sm,
    },
    attachmentCard: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingRight: SPACING.xs,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: colors.surface,
    },
    attachmentTappable: {
      flex: 1,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: SPACING.md,
      paddingVertical: SPACING.sm + 2,
      paddingHorizontal: SPACING.md,
    },
    attachmentIconWrap: {
      width: 36,
      height: 36,
      borderRadius: BORDER_RADIUS.sm,
      backgroundColor: colors.primaryMuted,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    attachmentInfo: {
      flex: 1,
    },
    attachmentName: {
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.medium,
      color: colors.textPrimary,
      lineHeight: 20,
    },
    attachmentMeta: {
      fontSize: FONT_SIZE.caption,
      color: colors.textMuted,
      marginTop: 1,
    },
    attachmentDeleteBtn: {
      padding: SPACING.xs,
      borderRadius: BORDER_RADIUS.sm,
    },

    // Chat button
    chatBtn: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: SPACING.md,
      marginTop: SPACING.lg,
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: colors.primaryMuted,
      borderWidth: 1,
      borderColor: colors.primary + "30",
    },
    chatBtnIconWrap: {
      width: 36,
      height: 36,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: colors.primary,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    chatBtnTextWrap: {
      flex: 1,
    },
    chatBtnTitle: {
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.semibold,
      color: colors.primary,
      marginBottom: 2,
    },
    chatBtnSubtitle: {
      fontSize: FONT_SIZE.caption,
      color: colors.textTertiary,
      lineHeight: 16,
    },

    // Metadata
    metaRow: {
      flexDirection: "row" as const,
      gap: SPACING.lg,
      marginTop: SPACING.lg,
      paddingTop: SPACING.md,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    metaItem: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: SPACING.xs,
    },
    metaText: {
      fontSize: FONT_SIZE.xs,
      color: colors.textMuted,
    },

    // Actions
    actionRow: {
      flexDirection: "row" as const,
      gap: SPACING.sm,
      marginTop: SPACING.lg,
    },
    actionBtn: {
      flex: 1,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: SPACING.xs,
      paddingVertical: SPACING.sm + 4,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: colors.backgroundSubtle,
    },
    actionBtnDanger: {
      backgroundColor: colors.errorMuted,
    },
    actionBtnText: {
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.semibold,
      color: colors.textSecondary,
    },
    actionBtnTextDanger: {
      color: colors.error,
    },
  };
}
