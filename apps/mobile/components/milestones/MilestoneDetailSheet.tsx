/**
 * MilestoneDetailSheet — Premium slide-up detail card for a milestone.
 *
 * Shows full title, description, status toggle, notes editor,
 * timestamps, and quick actions (edit, delete).
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "@/components/ui/Button";
import { useUpdateMilestone } from "@/hooks/use-milestones";
import type { MilestoneResponse, MilestoneStatus } from "@/types/milestones";
import {
  BORDER_RADIUS,
  COLORS,
  FONT_SIZE,
  FONT_WEIGHT,
  LAYOUT,
  SHADOW,
  SPACING,
} from "@/constants/theme";

// ── Status Helpers ───────────────────────────────────────────

const STATUS_META: Record<
  MilestoneStatus,
  {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    bg: string;
  }
> = {
  not_started: {
    label: "Not Started",
    icon: "ellipse-outline",
    color: COLORS.textMuted,
    bg: COLORS.backgroundSubtle,
  },
  in_progress: {
    label: "In Progress",
    icon: "time-outline",
    color: COLORS.warning,
    bg: COLORS.warningMuted,
  },
  completed: {
    label: "Completed",
    icon: "checkmark-circle",
    color: COLORS.success,
    bg: COLORS.successMuted,
  },
};

const STATUS_ORDER: MilestoneStatus[] = [
  "not_started",
  "in_progress",
  "completed",
];

// ── Component ────────────────────────────────────────────────

interface MilestoneDetailSheetProps {
  milestone: MilestoneResponse | null;
  phaseName: string;
  visible: boolean;
  onClose: () => void;
  onEdit: (milestone: MilestoneResponse) => void;
  onDelete: (id: string) => void;
}

export default function MilestoneDetailSheet({
  milestone,
  phaseName,
  visible,
  onClose,
  onEdit,
  onDelete,
}: MilestoneDetailSheetProps): React.JSX.Element {
  const updateMilestone = useUpdateMilestone();
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
              {/* Handle bar */}
              <View style={s.handleBar} />

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
                    color={COLORS.primary}
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
                          color={isActive ? m.color : COLORS.textMuted}
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
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                  textAlignVertical="top"
                />

                {/* Metadata */}
                <View style={s.metaRow}>
                  <View style={s.metaItem}>
                    <Ionicons
                      name="calendar-outline"
                      size={13}
                      color={COLORS.textMuted}
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
                      color={COLORS.textMuted}
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
                      color={COLORS.textSecondary}
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
                      color={COLORS.error}
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

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.surfaceOverlay,
    justifyContent: "flex-end",
  },
  keyboardAvoid: {
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl,
    maxHeight: "85%",
    ...SHADOW.lg,
  },
  sheetInner: {
    flex: 1,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.borderLight,
    alignSelf: "center",
    marginTop: SPACING.sm + 4,
    marginBottom: SPACING.sm,
  },
  scrollContent: {
    paddingHorizontal: LAYOUT.screenPaddingH,
    paddingBottom: SPACING.xxxl,
  },

  // Phase badge
  phaseBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: SPACING.xs,
    backgroundColor: COLORS.primaryMuted,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xxs + 2,
    borderRadius: BORDER_RADIUS.full,
    marginBottom: SPACING.md,
  },
  phaseBadgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.primary,
  },

  // Title & desc
  title: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
    marginBottom: SPACING.xs,
    lineHeight: 28,
  },
  description: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },

  // Section label
  sectionLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: SPACING.sm,
    marginTop: SPACING.lg,
  },

  // Status selector
  statusRow: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  statusChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
    paddingVertical: SPACING.sm + 2,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.backgroundSubtle,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  statusChipText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textMuted,
  },

  // Notes
  notesHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  notesInput: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.background,
    lineHeight: 22,
  },
  saveBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.primary,
    marginBottom: SPACING.sm,
    marginTop: SPACING.lg,
  },
  saveBtnText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.white,
  },

  // Metadata
  metaRow: {
    flexDirection: "row",
    gap: SPACING.lg,
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  metaText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },

  // Actions
  actionRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
    paddingVertical: SPACING.sm + 4,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.backgroundSubtle,
  },
  actionBtnDanger: {
    backgroundColor: COLORS.errorMuted,
  },
  actionBtnText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textSecondary,
  },
  actionBtnTextDanger: {
    color: COLORS.error,
  },
});

