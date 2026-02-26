/**
 * Milestones screen — visual project phase tracker.
 *
 * Ultra-premium milestone board: expandable phases with progress bars,
 * status toggles (not_started -> in_progress -> completed), inline
 * add/edit/delete. Designed to rival Linear and Notion.
 */

import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "@/components/ui/Button";
import {
  useCreateMilestone,
  useCreatePhase,
  useDeleteMilestone,
  useDeletePhase,
  usePhases,
  useUpdateMilestone,
  useUpdatePhase,
} from "@/hooks/use-milestones";
import type {
  MilestoneResponse,
  MilestoneStatus,
  PhaseWithMilestones,
} from "@/types/milestones";
import {
  ANIMATION,
  BORDER_RADIUS,
  COLORS,
  FONT_SIZE,
  FONT_WEIGHT,
  LAYOUT,
  SHADOW,
  SPACING,
} from "@/constants/theme";

// ── Status helpers ──────────────────────────────────────────

const STATUS_ORDER: MilestoneStatus[] = [
  "not_started",
  "in_progress",
  "completed",
];

function nextStatus(current: MilestoneStatus): MilestoneStatus {
  const idx = STATUS_ORDER.indexOf(current);
  return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
}

function statusIcon(
  status: MilestoneStatus
): { name: keyof typeof Ionicons.glyphMap; color: string } {
  switch (status) {
    case "completed":
      return { name: "checkmark-circle", color: COLORS.success };
    case "in_progress":
      return { name: "ellipse-outline", color: COLORS.warning };
    default:
      return { name: "ellipse-outline", color: COLORS.textMuted };
  }
}

function statusLabel(status: MilestoneStatus): string {
  switch (status) {
    case "completed":
      return "Done";
    case "in_progress":
      return "In Progress";
    default:
      return "Not Started";
  }
}

// ── Milestone Item ──────────────────────────────────────────

interface MilestoneItemProps {
  milestone: MilestoneResponse;
  onToggleStatus: (id: string, newStatus: MilestoneStatus) => void;
  onEdit: (milestone: MilestoneResponse) => void;
  onDelete: (id: string) => void;
}

function MilestoneItem({
  milestone,
  onToggleStatus,
  onEdit,
  onDelete,
}: MilestoneItemProps): React.JSX.Element {
  const { name: iconName, color: iconColor } = statusIcon(milestone.status);
  const isCompleted = milestone.status === "completed";

  const handleToggle = useCallback(() => {
    onToggleStatus(milestone.id, nextStatus(milestone.status));
  }, [milestone.id, milestone.status, onToggleStatus]);

  const handleLongPress = useCallback(() => {
    Alert.alert(milestone.title, undefined, [
      { text: "Edit", onPress: () => onEdit(milestone) },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => onDelete(milestone.id),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [milestone, onEdit, onDelete]);

  return (
    <Pressable
      style={styles.milestoneRow}
      onPress={handleToggle}
      onLongPress={handleLongPress}
    >
      <Ionicons name={iconName} size={22} color={iconColor} />
      <View style={styles.milestoneContent}>
        <Text
          style={[
            styles.milestoneTitle,
            isCompleted && styles.milestoneTitleDone,
          ]}
          numberOfLines={2}
        >
          {milestone.title}
        </Text>
        {milestone.description ? (
          <Text style={styles.milestoneDesc} numberOfLines={1}>
            {milestone.description}
          </Text>
        ) : null}
      </View>
      <View
        style={[
          styles.statusBadge,
          milestone.status === "completed" && styles.statusBadgeCompleted,
          milestone.status === "in_progress" && styles.statusBadgeInProgress,
        ]}
      >
        <Text
          style={[
            styles.statusBadgeText,
            milestone.status === "completed" && styles.statusBadgeTextCompleted,
            milestone.status === "in_progress" &&
              styles.statusBadgeTextInProgress,
          ]}
        >
          {statusLabel(milestone.status)}
        </Text>
      </View>
    </Pressable>
  );
}

// ── Phase Card ──────────────────────────────────────────────

interface PhaseCardProps {
  phase: PhaseWithMilestones;
  onToggleMilestoneStatus: (id: string, newStatus: MilestoneStatus) => void;
  onEditMilestone: (milestone: MilestoneResponse) => void;
  onDeleteMilestone: (id: string) => void;
  onAddMilestone: (phaseId: string) => void;
  onEditPhase: (phase: PhaseWithMilestones) => void;
  onDeletePhase: (phaseId: string) => void;
}

function PhaseCard({
  phase,
  onToggleMilestoneStatus,
  onEditMilestone,
  onDeleteMilestone,
  onAddMilestone,
  onEditPhase,
  onDeletePhase,
}: PhaseCardProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(true);

  const total = phase.milestones.length;
  const completed = phase.milestones.filter(
    (m) => m.status === "completed"
  ).length;
  const progressPct = total > 0 ? (completed / total) * 100 : 0;

  const handleHeaderPress = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const handlePhaseOptions = useCallback(() => {
    Alert.alert(phase.title, undefined, [
      { text: "Edit Phase", onPress: () => onEditPhase(phase) },
      {
        text: "Delete Phase",
        style: "destructive",
        onPress: () => onDeletePhase(phase.id),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [phase, onEditPhase, onDeletePhase]);

  return (
    <View style={styles.phaseCard}>
      {/* Phase Header */}
      <Pressable style={styles.phaseHeader} onPress={handleHeaderPress}>
        <View style={styles.phaseHeaderLeft}>
          <Ionicons
            name={expanded ? "chevron-down" : "chevron-forward"}
            size={18}
            color={COLORS.textTertiary}
          />
          <Text style={styles.phaseTitle}>{phase.title}</Text>
        </View>
        <View style={styles.phaseHeaderRight}>
          <Text style={styles.phaseCount}>
            {completed}/{total}
          </Text>
          <Pressable
            style={styles.phaseMenuBtn}
            onPress={handlePhaseOptions}
            hitSlop={8}
          >
            <Ionicons
              name="ellipsis-horizontal"
              size={18}
              color={COLORS.textTertiary}
            />
          </Pressable>
        </View>
      </Pressable>

      {/* Progress Bar */}
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarTrack}>
          <View
            style={[styles.progressBarFill, { width: `${progressPct}%` }]}
          />
        </View>
      </View>

      {/* Milestones */}
      {expanded && (
        <View style={styles.milestonesContainer}>
          {phase.milestones.map((milestone) => (
            <MilestoneItem
              key={milestone.id}
              milestone={milestone}
              onToggleStatus={onToggleMilestoneStatus}
              onEdit={onEditMilestone}
              onDelete={onDeleteMilestone}
            />
          ))}

          {/* Add Milestone Button */}
          <Pressable
            style={styles.addMilestoneBtn}
            onPress={() => onAddMilestone(phase.id)}
          >
            <Ionicons name="add" size={18} color={COLORS.primary} />
            <Text style={styles.addMilestoneBtnText}>Add milestone</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ── Add/Edit Modal ──────────────────────────────────────────

interface FormModalProps {
  visible: boolean;
  title: string;
  initialTitle: string;
  initialDescription: string;
  onClose: () => void;
  onSubmit: (title: string, description: string) => void;
  loading: boolean;
}

function FormModal({
  visible,
  title,
  initialTitle,
  initialDescription,
  onClose,
  onSubmit,
  loading,
}: FormModalProps): React.JSX.Element {
  const [formTitle, setFormTitle] = useState(initialTitle);
  const [formDesc, setFormDesc] = useState(initialDescription);

  // Reset form when modal opens with new initial values.
  React.useEffect(() => {
    setFormTitle(initialTitle);
    setFormDesc(initialDescription);
  }, [initialTitle, initialDescription, visible]);

  const handleSubmit = useCallback(() => {
    if (!formTitle.trim()) return;
    onSubmit(formTitle.trim(), formDesc.trim());
  }, [formTitle, formDesc, onSubmit]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalContent} onPress={() => {}}>
          <Text style={styles.modalTitle}>{title}</Text>

          <Text style={styles.modalLabel}>Title</Text>
          <TextInput
            style={styles.modalInput}
            value={formTitle}
            onChangeText={setFormTitle}
            placeholder="Enter title..."
            placeholderTextColor={COLORS.textMuted}
            autoFocus
          />

          <Text style={styles.modalLabel}>Description (optional)</Text>
          <TextInput
            style={[styles.modalInput, styles.modalInputMultiline]}
            value={formDesc}
            onChangeText={setFormDesc}
            placeholder="Add a description..."
            placeholderTextColor={COLORS.textMuted}
            multiline
            numberOfLines={3}
          />

          <View style={styles.modalActions}>
            <Button
              label="Cancel"
              variant="ghost"
              onPress={onClose}
              fullWidth={false}
            />
            <Button
              label="Save"
              variant="primary"
              onPress={handleSubmit}
              loading={loading}
              disabled={!formTitle.trim()}
              fullWidth={false}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Empty State ─────────────────────────────────────────────

function EmptyState({
  onAddPhase,
}: {
  onAddPhase: () => void;
}): React.JSX.Element {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="flag" size={32} color={COLORS.primary} />
      </View>
      <Text style={styles.emptyTitle}>Milestone Board</Text>
      <Text style={styles.emptyBody}>
        Organize your project into phases and milestones. Track progress
        visually and celebrate every step forward.
      </Text>
      <View style={styles.emptyProgressPreview}>
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: "0%" }]} />
        </View>
        <Text style={styles.emptyProgressLabel}>0 of 0 milestones</Text>
      </View>
      <View style={{ marginTop: SPACING.lg, width: 200 }}>
        <Button label="Add First Phase" onPress={onAddPhase} />
      </View>
    </View>
  );
}

// ── Main Screen ─────────────────────────────────────────────

export default function MilestonesScreen() {
  const { data: phases, isLoading, error } = usePhases();

  const createPhase = useCreatePhase();
  const updatePhase = useUpdatePhase();
  const deletePhase = useDeletePhase();
  const createMilestone = useCreateMilestone();
  const updateMilestone = useUpdateMilestone();
  const deleteMilestone = useDeleteMilestone();

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalInitialTitle, setModalInitialTitle] = useState("");
  const [modalInitialDesc, setModalInitialDesc] = useState("");
  const [modalMode, setModalMode] = useState<
    | { type: "add-phase" }
    | { type: "edit-phase"; phaseId: string }
    | { type: "add-milestone"; phaseId: string }
    | { type: "edit-milestone"; milestoneId: string }
  >({ type: "add-phase" });
  const [modalLoading, setModalLoading] = useState(false);

  // Summary stats
  const totalMilestones = useMemo(
    () => (phases ?? []).reduce((sum, p) => sum + p.milestones.length, 0),
    [phases]
  );
  const completedMilestones = useMemo(
    () =>
      (phases ?? []).reduce(
        (sum, p) =>
          sum + p.milestones.filter((m) => m.status === "completed").length,
        0
      ),
    [phases]
  );
  const overallProgress = useMemo(
    () => (totalMilestones > 0 ? (completedMilestones / totalMilestones) * 100 : 0),
    [completedMilestones, totalMilestones]
  );

  // ── Handlers ──────────────────────────────────────────────

  const handleAddPhase = useCallback(() => {
    setModalMode({ type: "add-phase" });
    setModalTitle("New Phase");
    setModalInitialTitle("");
    setModalInitialDesc("");
    setModalVisible(true);
  }, []);

  const handleEditPhase = useCallback((phase: PhaseWithMilestones) => {
    setModalMode({ type: "edit-phase", phaseId: phase.id });
    setModalTitle("Edit Phase");
    setModalInitialTitle(phase.title);
    setModalInitialDesc(phase.description ?? "");
    setModalVisible(true);
  }, []);

  const handleDeletePhase = useCallback(
    (phaseId: string) => {
      Alert.alert(
        "Delete Phase",
        "This will permanently delete this phase and all its milestones.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => deletePhase.mutate(phaseId),
          },
        ]
      );
    },
    [deletePhase]
  );

  const handleAddMilestone = useCallback((phaseId: string) => {
    setModalMode({ type: "add-milestone", phaseId });
    setModalTitle("New Milestone");
    setModalInitialTitle("");
    setModalInitialDesc("");
    setModalVisible(true);
  }, []);

  const handleEditMilestone = useCallback((milestone: MilestoneResponse) => {
    setModalMode({ type: "edit-milestone", milestoneId: milestone.id });
    setModalTitle("Edit Milestone");
    setModalInitialTitle(milestone.title);
    setModalInitialDesc(milestone.description ?? "");
    setModalVisible(true);
  }, []);

  const handleDeleteMilestone = useCallback(
    (milestoneId: string) => {
      Alert.alert("Delete Milestone", "This cannot be undone.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteMilestone.mutate(milestoneId),
        },
      ]);
    },
    [deleteMilestone]
  );

  const handleToggleMilestoneStatus = useCallback(
    (milestoneId: string, newStatus: MilestoneStatus) => {
      updateMilestone.mutate({
        milestoneId,
        payload: { status: newStatus },
      });
    },
    [updateMilestone]
  );

  const handleModalSubmit = useCallback(
    async (title: string, description: string) => {
      setModalLoading(true);
      try {
        switch (modalMode.type) {
          case "add-phase":
            await createPhase.mutateAsync({
              title,
              description: description || undefined,
              sort_order: (phases?.length ?? 0),
            });
            break;
          case "edit-phase":
            await updatePhase.mutateAsync({
              phaseId: modalMode.phaseId,
              payload: { title, description: description || undefined },
            });
            break;
          case "add-milestone":
            await createMilestone.mutateAsync({
              phaseId: modalMode.phaseId,
              payload: { title, description: description || undefined },
            });
            break;
          case "edit-milestone":
            await updateMilestone.mutateAsync({
              milestoneId: modalMode.milestoneId,
              payload: { title, description: description || undefined },
            });
            break;
        }
        setModalVisible(false);
      } finally {
        setModalLoading(false);
      }
    },
    [modalMode, phases, createPhase, updatePhase, createMilestone, updateMilestone]
  );

  // ── Render ────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={32} color={COLORS.error} />
        <Text style={styles.errorText}>Failed to load milestones</Text>
        <Text style={styles.errorDetail}>
          {error instanceof Error ? error.message : "Unknown error"}
        </Text>
      </View>
    );
  }

  const hasPhases = phases && phases.length > 0;

  return (
    <View style={styles.screen}>
      {hasPhases ? (
        <>
          {/* Overall Progress Header */}
          <View style={styles.overallHeader}>
            <View style={styles.overallHeaderLeft}>
              <Text style={styles.overallLabel}>Overall Progress</Text>
              <Text style={styles.overallCount}>
                {completedMilestones} of {totalMilestones} milestones
              </Text>
            </View>
            <Text style={styles.overallPct}>
              {Math.round(overallProgress)}%
            </Text>
          </View>
          <View style={styles.overallProgressBar}>
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${overallProgress}%` },
                ]}
              />
            </View>
          </View>

          {/* Phase List */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {phases.map((phase) => (
              <PhaseCard
                key={phase.id}
                phase={phase}
                onToggleMilestoneStatus={handleToggleMilestoneStatus}
                onEditMilestone={handleEditMilestone}
                onDeleteMilestone={handleDeleteMilestone}
                onAddMilestone={handleAddMilestone}
                onEditPhase={handleEditPhase}
                onDeletePhase={handleDeletePhase}
              />
            ))}

            {/* Add Phase Button */}
            <Pressable style={styles.addPhaseBtn} onPress={handleAddPhase}>
              <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} />
              <Text style={styles.addPhaseBtnText}>Add Phase</Text>
            </Pressable>
          </ScrollView>
        </>
      ) : (
        <EmptyState onAddPhase={handleAddPhase} />
      )}

      {/* Form Modal */}
      <FormModal
        visible={modalVisible}
        title={modalTitle}
        initialTitle={modalInitialTitle}
        initialDescription={modalInitialDesc}
        onClose={() => setModalVisible(false)}
        onSubmit={handleModalSubmit}
        loading={modalLoading}
      />
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
  errorText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
    marginTop: SPACING.md,
  },
  errorDetail: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textTertiary,
    marginTop: SPACING.xs,
  },

  // ── Overall Progress ──────────────────────────────────
  overallHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: LAYOUT.screenPaddingH,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  overallHeaderLeft: {},
  overallLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  overallCount: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.textSecondary,
  },
  overallPct: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
    letterSpacing: -0.5,
  },
  overallProgressBar: {
    paddingHorizontal: LAYOUT.screenPaddingH,
    paddingBottom: SPACING.md,
  },

  // ── Scroll ────────────────────────────────────────────
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: LAYOUT.screenPaddingH,
    paddingBottom: SPACING.xxxl,
  },

  // ── Phase Card ────────────────────────────────────────
  phaseCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
    ...SHADOW.sm,
    overflow: "hidden",
  },
  phaseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  phaseHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: SPACING.sm,
  },
  phaseTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
    letterSpacing: -0.2,
    flex: 1,
  },
  phaseHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  phaseCount: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textTertiary,
    backgroundColor: COLORS.backgroundSubtle,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xxs,
    borderRadius: BORDER_RADIUS.xs,
  },
  phaseMenuBtn: {
    padding: SPACING.xs,
  },

  // ── Progress Bar ──────────────────────────────────────
  progressBarContainer: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  progressBarTrack: {
    width: "100%",
    height: 4,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.borderLight,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primary,
  },

  // ── Milestones ────────────────────────────────────────
  milestonesContainer: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  milestoneRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.sm + 2,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    gap: SPACING.sm,
  },
  milestoneContent: {
    flex: 1,
  },
  milestoneTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  milestoneTitleDone: {
    textDecorationLine: "line-through",
    color: COLORS.textTertiary,
  },
  milestoneDesc: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textTertiary,
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xxs + 1,
    borderRadius: BORDER_RADIUS.xs,
    backgroundColor: COLORS.backgroundSubtle,
  },
  statusBadgeCompleted: {
    backgroundColor: COLORS.successMuted,
  },
  statusBadgeInProgress: {
    backgroundColor: COLORS.warningMuted,
  },
  statusBadgeText: {
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textTertiary,
  },
  statusBadgeTextCompleted: {
    color: COLORS.success,
  },
  statusBadgeTextInProgress: {
    color: COLORS.warning,
  },

  // ── Add buttons ───────────────────────────────────────
  addMilestoneBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.sm + 2,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    gap: SPACING.xs,
  },
  addMilestoneBtnText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.primary,
  },
  addPhaseBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  addPhaseBtnText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.primary,
  },

  // ── Empty State ───────────────────────────────────────
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
  emptyProgressPreview: {
    width: "100%",
    maxWidth: 260,
    alignItems: "center",
  },
  emptyProgressLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },

  // ── Modal ─────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.surfaceOverlay,
    justifyContent: "center",
    alignItems: "center",
    padding: LAYOUT.screenPaddingH,
  },
  modalContent: {
    width: "100%",
    maxWidth: LAYOUT.maxContentWidth,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOW.lg,
  },
  modalTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.lg,
    letterSpacing: -0.3,
  },
  modalLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: SPACING.xs,
  },
  modalInput: {
    height: LAYOUT.inputHeight,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.background,
    marginBottom: SPACING.md,
  },
  modalInputMultiline: {
    height: 88,
    paddingTop: SPACING.sm,
    textAlignVertical: "top",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
});
