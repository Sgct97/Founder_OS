/**
 * Milestones screen — visual project phase tracker.
 *
 * Ultra-premium milestone board: expandable phases with progress bars,
 * status toggles (not_started -> in_progress -> completed), inline
 * add/edit/delete. Designed to rival Linear and Notion.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { LinearGradient } from "expo-linear-gradient";

import { Button } from "@/components/ui/Button";
import { GlowDivider } from "@/components/ui/GlowDivider";
import ImportModal from "@/components/milestones/ImportModal";
import MilestoneDetailSheet from "@/components/milestones/MilestoneDetailSheet";
import { Skeleton, SkeletonPhaseCard } from "@/components/ui/Skeleton";
import { useTour, useTourRef } from "@/components/tour/TourProvider";
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

// ── Status helpers ──────────────────────────────────────────

const STATUS_ORDER: MilestoneStatus[] = [
  "not_started",
  "in_progress",
  "completed",
];

function nextStatus(current: MilestoneStatus): MilestoneStatus {
  const idx = STATUS_ORDER.indexOf(current);
  return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length] ?? "not_started";
}

function statusIcon(
  status: MilestoneStatus,
  colors: ColorPalette
): { name: keyof typeof Ionicons.glyphMap; color: string } {
  switch (status) {
    case "completed":
      return { name: "checkmark-circle", color: colors.success };
    case "in_progress":
      return { name: "ellipse-outline", color: colors.warning };
    default:
      return { name: "ellipse-outline", color: colors.textMuted };
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

// ── Journey Node (replaces flat MilestoneItem) ─────────────

interface JourneyNodeProps {
  milestone: MilestoneResponse;
  index: number;
  isLast: boolean;
  onPress: (milestone: MilestoneResponse) => void;
  onToggleStatus: (id: string, newStatus: MilestoneStatus) => void;
}

function JourneyNode({
  milestone,
  index,
  isLast,
  onPress,
  onToggleStatus,
}: JourneyNodeProps): React.JSX.Element {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const isCompleted = milestone.status === "completed";
  const isInProgress = milestone.status === "in_progress";

  // Staggered entrance animation
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 350,
      delay: index * 80,
      easing: Easing.out(Easing.back(1.1)),
      useNativeDriver: true,
    }).start();
  }, [anim, index]);

  // Press scale feedback
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const handlePressIn = useCallback(() => {
    Animated.timing(scaleAnim, { toValue: 0.97, duration: 120, useNativeDriver: true }).start();
  }, [scaleAnim]);
  const handlePressOut = useCallback(() => {
    Animated.timing(scaleAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, [scaleAnim]);

  // Pulsing ring for in-progress
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (isInProgress) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.35, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isInProgress, pulseAnim]);

  const handleToggle = useCallback(() => {
    onToggleStatus(milestone.id, nextStatus(milestone.status));
  }, [milestone.id, milestone.status, onToggleStatus]);

  return (
    <Animated.View
      style={[
        styles.journeyNodeOuter,
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
        },
      ]}
    >
      {/* Vertical connector line */}
      <View style={styles.journeyLineColumn}>
        {/* Top line (hidden for first) */}
        <View style={[styles.journeyLineSeg, index === 0 && { backgroundColor: "transparent" }, isCompleted && { backgroundColor: colors.primary }]} />
        {/* Node circle */}
        <Pressable onPress={handleToggle} hitSlop={8} style={styles.journeyNodeCircleWrap}>
          {isInProgress && (
            <Animated.View
              style={[
                styles.journeyPulseRing,
                { transform: [{ scale: pulseAnim }] },
              ]}
            />
          )}
          <View
            style={[
              styles.journeyNodeCircle,
              isCompleted && styles.journeyNodeCircleCompleted,
              isInProgress && styles.journeyNodeCircleInProgress,
            ]}
          >
            {isCompleted && (
              <Ionicons name="checkmark" size={12} color={colors.white} />
            )}
            {isInProgress && (
              <View style={styles.journeyNodeInnerDot} />
            )}
          </View>
        </Pressable>
        {/* Bottom line (hidden for last) */}
        <View style={[styles.journeyLineSeg, isLast && { backgroundColor: "transparent" }, isCompleted && { backgroundColor: colors.primary }]} />
      </View>

      {/* Card */}
      <Animated.View style={{ flex: 1, transform: [{ scale: scaleAnim }] }}>
      <Pressable
        style={[
          styles.journeyCard,
          isCompleted && styles.journeyCardCompleted,
          isInProgress && styles.journeyCardInProgress,
        ]}
        onPress={() => onPress(milestone)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View style={styles.journeyCardHeader}>
          <Text
            style={[
              styles.journeyCardTitle,
              isCompleted && styles.journeyCardTitleDone,
            ]}
            numberOfLines={2}
          >
            {milestone.title}
          </Text>
          <View
            style={[
              styles.journeyStatusBadge,
              isCompleted && styles.journeyStatusBadgeCompleted,
              isInProgress && styles.journeyStatusBadgeInProgress,
            ]}
          >
            <Text
              style={[
                styles.journeyStatusText,
                isCompleted && styles.journeyStatusTextCompleted,
                isInProgress && styles.journeyStatusTextInProgress,
              ]}
            >
              {statusLabel(milestone.status)}
            </Text>
          </View>
        </View>
        {milestone.description ? (
          <Text style={styles.journeyCardDesc} numberOfLines={2}>
            {milestone.description}
          </Text>
        ) : null}
        {milestone.notes ? (
          <View style={styles.journeyNotesIndicator}>
            <Ionicons name="document-text-outline" size={11} color={colors.textMuted} />
            <Text style={styles.journeyNotesText}>Has notes</Text>
          </View>
        ) : null}
      </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

// ── Phase Card ──────────────────────────────────────────────

interface PhaseCardProps {
  phase: PhaseWithMilestones;
  phaseIndex: number;
  totalPhases: number;
  onToggleMilestoneStatus: (id: string, newStatus: MilestoneStatus) => void;
  onMilestonePress: (milestone: MilestoneResponse, phaseName: string) => void;
  onAddMilestone: (phaseId: string) => void;
  onEditPhase: (phase: PhaseWithMilestones) => void;
  onDeletePhase: (phaseId: string) => void;
}

function PhaseCard({
  phase,
  phaseIndex,
  totalPhases,
  onToggleMilestoneStatus,
  onMilestonePress,
  onAddMilestone,
  onEditPhase,
  onDeletePhase,
}: PhaseCardProps): React.JSX.Element {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(true);

  const total = phase.milestones.length;
  const completed = phase.milestones.filter(
    (m) => m.status === "completed"
  ).length;
  const progressPct = total > 0 ? (completed / total) * 100 : 0;
  const allDone = total > 0 && completed === total;

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
          <View style={[styles.phaseNumber, allDone && styles.phaseNumberDone]}>
            {allDone ? (
              <Ionicons name="checkmark" size={13} color={colors.white} />
            ) : (
              <Text style={styles.phaseNumberText}>{phaseIndex + 1}</Text>
            )}
          </View>
          <View style={styles.phaseTitleWrap}>
            <Text style={styles.phaseTitle} numberOfLines={1}>{phase.title}</Text>
            {phase.description ? (
              <Text style={styles.phaseSubtitle} numberOfLines={1}>{phase.description}</Text>
            ) : null}
          </View>
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
              color={colors.textTertiary}
            />
          </Pressable>
          <Ionicons
            name={expanded ? "chevron-down" : "chevron-forward"}
            size={16}
            color={colors.textTertiary}
          />
        </View>
      </Pressable>

      {/* Progress Bar */}
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarTrack}>
          <LinearGradient
            colors={["#FF6A2A", "#FFB36B"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressBarFill, { width: `${progressPct}%` }]}
          />
        </View>
      </View>

      {/* Journey Path Milestones */}
      {expanded && (
        <View style={styles.journeyContainer}>
          {phase.milestones.map((milestone, idx) => (
            <JourneyNode
              key={milestone.id}
              milestone={milestone}
              index={idx}
              isLast={idx === phase.milestones.length - 1}
              onPress={(m) => onMilestonePress(m, phase.title)}
              onToggleStatus={onToggleMilestoneStatus}
            />
          ))}

          {/* Add Milestone Button */}
          <Pressable
            style={styles.addMilestoneBtn}
            onPress={() => onAddMilestone(phase.id)}
          >
            <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
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
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
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
            placeholderTextColor={colors.textMuted}
            autoFocus
          />

          <Text style={styles.modalLabel}>Description (optional)</Text>
          <TextInput
            style={[styles.modalInput, styles.modalInputMultiline]}
            value={formDesc}
            onChangeText={setFormDesc}
            placeholder="Add a description..."
            placeholderTextColor={colors.textMuted}
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
  onImportPress,
}: {
  onAddPhase: () => void;
  onImportPress: () => void;
}): React.JSX.Element {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="flag" size={32} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>Milestone Board</Text>
      <Text style={styles.emptyBody}>
        Organize your project into phases and milestones. Track progress
        visually and celebrate every step forward.
      </Text>
      <View style={styles.emptyProgressPreview}>
        <View style={styles.progressBarTrack}>
          <LinearGradient
            colors={["#FF6A2A", "#FFB36B"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressBarFill, { width: "0%" }]}
          />
        </View>
        <Text style={styles.emptyProgressLabel}>0 of 0 milestones</Text>
      </View>
      <View style={{ marginTop: SPACING.lg, width: 220, gap: SPACING.sm }}>
        <Button label="Add First Phase" onPress={onAddPhase} />
        <Button
          label="Import with AI"
          variant="ghost"
          onPress={onImportPress}
        />
      </View>
    </View>
  );
}

// ── Main Screen ─────────────────────────────────────────────

export default function MilestonesScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    reopenMilestoneId?: string;
    reopenPhaseName?: string;
  }>();
  const { data: phases, isLoading, error, refetch } = usePhases();

  const createPhase = useCreatePhase();
  const updatePhase = useUpdatePhase();
  const deletePhase = useDeletePhase();
  const createMilestone = useCreateMilestone();
  const updateMilestone = useUpdateMilestone();
  const deleteMilestone = useDeleteMilestone();

  // Import modal state
  const [importModalVisible, setImportModalVisible] = useState(false);

  // Detail sheet state
  const [detailMilestone, setDetailMilestone] = useState<MilestoneResponse | null>(null);
  const [detailPhaseName, setDetailPhaseName] = useState("");
  const [detailVisible, setDetailVisible] = useState(false);

  // Re-open detail sheet when returning from milestone chat
  useEffect(() => {
    if (params.reopenMilestoneId && phases) {
      for (const phase of phases) {
        const ms = phase.milestones.find((m) => m.id === params.reopenMilestoneId);
        if (ms) {
          setDetailMilestone(ms);
          setDetailPhaseName(params.reopenPhaseName ?? phase.title);
          setDetailVisible(true);
          router.setParams({ reopenMilestoneId: undefined, reopenPhaseName: undefined });
          break;
        }
      }
    }
  }, [params.reopenMilestoneId, phases]);

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

  // Tour refs
  const { currentStep } = useTour();
  const journeyRef = useTourRef("milestones-journey");
  const phaseCardRef = useTourRef("milestones-phase-card");
  const statusToggleRef = useTourRef("milestones-status-toggle");
  const importRef = useTourRef("milestones-import");
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (currentStep?.targetKey === "milestones-import") {
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 150);
    }
    if (currentStep?.targetKey === "milestones-chat-demo" && phases?.length) {
      const firstMilestone = phases[0]?.milestones[0];
      if (firstMilestone) {
        setTimeout(() => {
          router.push({
            pathname: "/(tabs)/milestones/chat",
            params: {
              milestoneId: firstMilestone.id,
              milestoneTitle: firstMilestone.title,
              phaseName: phases[0]!.title,
            },
          });
        }, 200);
      }
    }
  }, [currentStep, phases, router]);

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

  const handleMilestonePress = useCallback(
    (milestone: MilestoneResponse, phaseName: string) => {
      setDetailMilestone(milestone);
      setDetailPhaseName(phaseName);
      setDetailVisible(true);
    },
    []
  );

  const handleChatMilestone = useCallback(
    (milestone: MilestoneResponse) => {
      router.push({
        pathname: "/(tabs)/milestones/chat",
        params: {
          milestoneId: milestone.id,
          milestoneTitle: milestone.title,
          phaseName: detailPhaseName,
        },
      });
    },
    [router, detailPhaseName]
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
      <View style={styles.screen}>
        {/* Skeleton overall progress header */}
        <View style={styles.overallHeader}>
          <View style={styles.overallHeaderLeft}>
            <Skeleton width={100} height={10} />
            <Skeleton width={140} height={13} style={{ marginTop: 6 }} />
          </View>
          <Skeleton width={48} height={28} />
        </View>
        <View style={styles.overallProgressBar}>
          <Skeleton width="100%" height={4} borderRadius={BORDER_RADIUS.full} />
        </View>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {[0, 1, 2].map((i) => (
            <SkeletonPhaseCard key={i} />
          ))}
        </ScrollView>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={32} color={colors.error} />
        <Text style={styles.errorText}>Failed to load milestones</Text>
        <Text style={styles.errorDetail}>
          {error instanceof Error ? error.message : "An unexpected error occurred"}
        </Text>
        <Pressable style={styles.retryButton} onPress={() => refetch()}>
          <Ionicons name="refresh" size={16} color={colors.primary} />
          <Text style={styles.retryText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  const hasPhases = phases && phases.length > 0;

  return (
    <View style={styles.screen}>
      {hasPhases ? (
        <>
          {/* Overall Progress Header */}
          <View ref={statusToggleRef} collapsable={false}>
          <View ref={journeyRef} collapsable={false} style={styles.overallHeader}>
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
              <LinearGradient
                colors={["#FF6A2A", "#FFB36B"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.progressBarFill,
                  { width: `${overallProgress}%` },
                ]}
              />
            </View>
          </View>
          </View>

          <View style={{ paddingHorizontal: LAYOUT.screenPaddingH }}>
            <GlowDivider />
          </View>

          {/* Phase List */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {phases.map((phase, idx) => (
              <View key={phase.id} ref={idx === 0 ? phaseCardRef : undefined} collapsable={false}>
                <PhaseCard
                  phase={phase}
                  phaseIndex={idx}
                  totalPhases={phases.length}
                  onToggleMilestoneStatus={handleToggleMilestoneStatus}
                  onMilestonePress={handleMilestonePress}
                  onAddMilestone={handleAddMilestone}
                  onEditPhase={handleEditPhase}
                  onDeletePhase={handleDeletePhase}
                />
              </View>
            ))}

            <GlowDivider />

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              <Pressable style={styles.addPhaseBtn} onPress={handleAddPhase}>
                <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                <Text style={styles.addPhaseBtnText}>Add Phase</Text>
              </Pressable>
              <Pressable
                ref={importRef}
                collapsable={false}
                style={styles.importBtn}
                onPress={() => setImportModalVisible(true)}
              >
                <Ionicons name="sparkles" size={18} color={colors.primary} />
                <Text style={styles.importBtnText}>Import with AI</Text>
              </Pressable>
            </View>
          </ScrollView>
        </>
      ) : (
        <EmptyState
          onAddPhase={handleAddPhase}
          onImportPress={() => setImportModalVisible(true)}
        />
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

      {/* Import Modal */}
      <ImportModal
        visible={importModalVisible}
        onClose={() => setImportModalVisible(false)}
      />

      {/* Milestone Detail Sheet */}
      <MilestoneDetailSheet
        milestone={detailMilestone}
        phaseName={detailPhaseName}
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        onEdit={handleEditMilestone}
        onDelete={handleDeleteMilestone}
        onChat={handleChatMilestone}
      />
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────

function createStyles(colors: ColorPalette) {
  return {
    screen: {
      flex: 1,
      backgroundColor: colors.background,
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
    errorText: {
      fontSize: FONT_SIZE.lg,
      fontWeight: FONT_WEIGHT.semibold,
      color: colors.textPrimary,
      marginTop: SPACING.md,
    },
    errorDetail: {
      fontSize: FONT_SIZE.sm,
      color: colors.textTertiary,
      marginTop: SPACING.xs,
      textAlign: "center" as const,
      maxWidth: 300,
    },
    retryButton: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      marginTop: SPACING.lg,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm + 2,
      borderRadius: BORDER_RADIUS.sm,
      backgroundColor: colors.primaryMuted,
      gap: SPACING.xs,
    },
    retryText: {
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.semibold,
      color: colors.primary,
    },

    // ── Overall Progress ──────────────────────────────────
    overallHeader: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "flex-end" as const,
      paddingHorizontal: LAYOUT.screenPaddingH,
      paddingTop: SPACING.lg,
      paddingBottom: SPACING.sm,
    },
    overallHeaderLeft: {},
    overallLabel: {
      fontSize: FONT_SIZE.xs,
      fontWeight: FONT_WEIGHT.semibold,
      color: colors.textTertiary,
      textTransform: "uppercase" as const,
      letterSpacing: 0.8,
      marginBottom: 2,
    },
    overallCount: {
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.medium,
      color: colors.textSecondary,
    },
    overallPct: {
      fontSize: FONT_SIZE.xxl,
      fontWeight: FONT_WEIGHT.bold,
      color: colors.primary,
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
      backgroundColor: colors.surface,
      borderRadius: BORDER_RADIUS.lg,
      marginBottom: SPACING.lg,
      ...SHADOW.sm,
      overflow: "hidden" as const,
    },
    phaseHeader: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
    },
    phaseHeaderLeft: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      flex: 1,
      gap: SPACING.sm,
    },
    phaseNumber: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.navyMid,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    phaseNumberDone: {
      backgroundColor: colors.primary,
    },
    phaseNumberText: {
      fontSize: FONT_SIZE.xs,
      fontWeight: FONT_WEIGHT.bold,
      color: colors.white,
    },
    phaseTitleWrap: {
      flex: 1,
    },
    phaseTitle: {
      fontSize: FONT_SIZE.md,
      fontWeight: FONT_WEIGHT.semibold,
      color: colors.textPrimary,
      letterSpacing: -0.2,
    },
    phaseSubtitle: {
      fontSize: FONT_SIZE.xs,
      color: colors.textTertiary,
      marginTop: 1,
    },
    phaseHeaderRight: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: SPACING.sm,
    },
    phaseCount: {
      fontSize: FONT_SIZE.xs,
      fontWeight: FONT_WEIGHT.semibold,
      color: colors.textTertiary,
      backgroundColor: colors.backgroundSubtle,
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
      width: "100%" as const,
      height: 4,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: colors.borderLight,
      overflow: "hidden" as const,
    },
    progressBarFill: {
      height: "100%" as const,
      borderRadius: BORDER_RADIUS.full,
    },

    // ── Journey Path ──────────────────────────────────────
    journeyContainer: {
      paddingHorizontal: SPACING.md,
      paddingBottom: SPACING.md,
      paddingTop: SPACING.xs,
    },
    journeyNodeOuter: {
      flexDirection: "row" as const,
      minHeight: 72,
    },
    journeyLineColumn: {
      width: 28,
      alignItems: "center" as const,
    },
    journeyLineSeg: {
      flex: 1,
      width: 2,
      backgroundColor: colors.borderLight,
    },
    journeyNodeCircleWrap: {
      width: 28,
      height: 28,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    journeyPulseRing: {
      position: "absolute" as const,
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.primary,
      opacity: 0.4,
    },
    journeyNodeCircle: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 2,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    journeyNodeCircleCompleted: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    journeyNodeCircleInProgress: {
      borderColor: colors.primary,
      backgroundColor: colors.surface,
    },
    journeyNodeInnerDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.primary,
    },

    // Journey cards
    journeyCard: {
      flex: 1,
      marginLeft: SPACING.sm,
      marginBottom: SPACING.sm,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm + 2,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    journeyCardCompleted: {
      borderColor: colors.successMuted,
      backgroundColor: "rgba(34, 197, 94, 0.06)",
    },
    journeyCardInProgress: {
      borderColor: "rgba(255, 106, 42, 0.5)",
      backgroundColor: "rgba(255, 106, 42, 0.06)",
      ...SHADOW.glow,
    },
    journeyCardHeader: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      gap: SPACING.sm,
    },
    journeyCardTitle: {
      flex: 1,
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.semibold,
      color: colors.textPrimary,
      lineHeight: 20,
    },
    journeyCardTitleDone: {
      color: colors.textTertiary,
    },
    journeyCardDesc: {
      fontSize: FONT_SIZE.xs,
      color: colors.textTertiary,
      marginTop: SPACING.xxs + 1,
      lineHeight: 18,
    },
    journeyNotesIndicator: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 4,
      marginTop: SPACING.xs,
    },
    journeyNotesText: {
      fontSize: FONT_SIZE.caption,
      color: colors.textMuted,
    },
    journeyStatusBadge: {
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xxs + 1,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: colors.backgroundSubtle,
    },
    journeyStatusBadgeCompleted: {
      backgroundColor: colors.successMuted,
    },
    journeyStatusBadgeInProgress: {
      backgroundColor: colors.warningMuted,
    },
    journeyStatusText: {
      fontSize: FONT_SIZE.caption,
      fontWeight: FONT_WEIGHT.semibold,
      color: colors.textTertiary,
    },
    journeyStatusTextCompleted: {
      color: colors.success,
    },
    journeyStatusTextInProgress: {
      color: colors.warning,
    },

    // ── Add buttons ───────────────────────────────────────
    addMilestoneBtn: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      paddingVertical: SPACING.sm + 2,
      marginTop: SPACING.xs,
      borderRadius: BORDER_RADIUS.sm,
      borderWidth: 1,
      borderStyle: "dashed" as const,
      borderColor: colors.border,
      gap: SPACING.xs,
    },
    addMilestoneBtnText: {
      fontSize: FONT_SIZE.xs,
      fontWeight: FONT_WEIGHT.semibold,
      color: colors.primary,
    },
    actionRow: {
      flexDirection: "row" as const,
      gap: SPACING.sm,
      marginBottom: SPACING.md,
    },
    addPhaseBtn: {
      flex: 1,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      paddingVertical: SPACING.md,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderStyle: "dashed" as const,
      gap: SPACING.xs,
    },
    addPhaseBtnText: {
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.semibold,
      color: colors.primary,
    },
    importBtn: {
      flex: 1,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      paddingVertical: SPACING.md,
      borderRadius: BORDER_RADIUS.lg,
      backgroundColor: colors.primaryMuted,
      gap: SPACING.xs,
    },
    importBtnText: {
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.semibold,
      color: colors.primary,
    },

    // ── Empty State ───────────────────────────────────────
    emptyState: {
      flex: 1,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      paddingHorizontal: LAYOUT.screenPaddingH,
    },
    emptyIconContainer: {
      width: 64,
      height: 64,
      borderRadius: BORDER_RADIUS.lg,
      backgroundColor: colors.primaryMuted,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginBottom: SPACING.lg,
    },
    emptyTitle: {
      fontSize: FONT_SIZE.xl,
      fontWeight: FONT_WEIGHT.bold,
      color: colors.textPrimary,
      marginBottom: SPACING.sm,
      letterSpacing: -0.3,
    },
    emptyBody: {
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.regular,
      color: colors.textSecondary,
      textAlign: "center" as const,
      lineHeight: 22,
      maxWidth: 320,
      marginBottom: SPACING.lg,
    },
    emptyProgressPreview: {
      width: "100%" as const,
      maxWidth: 260,
      alignItems: "center" as const,
    },
    emptyProgressLabel: {
      fontSize: FONT_SIZE.xs,
      fontWeight: FONT_WEIGHT.medium,
      color: colors.textMuted,
      marginTop: SPACING.xs,
    },

    // ── Modal ─────────────────────────────────────────────
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.surfaceOverlay,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      padding: LAYOUT.screenPaddingH,
    },
    modalContent: {
      width: "100%" as const,
      maxWidth: LAYOUT.maxContentWidth,
      backgroundColor: colors.surface,
      borderRadius: BORDER_RADIUS.xl,
      padding: SPACING.lg,
      ...SHADOW.lg,
    },
    modalTitle: {
      fontSize: FONT_SIZE.lg,
      fontWeight: FONT_WEIGHT.bold,
      color: colors.textPrimary,
      marginBottom: SPACING.lg,
      letterSpacing: -0.3,
    },
    modalLabel: {
      fontSize: FONT_SIZE.xs,
      fontWeight: FONT_WEIGHT.semibold,
      color: colors.textTertiary,
      textTransform: "uppercase" as const,
      letterSpacing: 0.8,
      marginBottom: SPACING.xs,
    },
    modalInput: {
      height: LAYOUT.inputHeight,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: BORDER_RADIUS.md,
      paddingHorizontal: SPACING.md,
      fontSize: FONT_SIZE.md,
      color: colors.textPrimary,
      backgroundColor: colors.background,
      marginBottom: SPACING.md,
    },
    modalInputMultiline: {
      height: 88,
      paddingTop: SPACING.sm,
      textAlignVertical: "top" as const,
    },
    modalActions: {
      flexDirection: "row" as const,
      justifyContent: "flex-end" as const,
      gap: SPACING.sm,
      marginTop: SPACING.sm,
    },
  };
}
