/**
 * ImportModal — Ultra-premium multi-step milestone import.
 *
 * Step 1: Paste/type raw text (markdown, prose, bullets)
 * Step 2: AI-parsed preview with phase/milestone cards
 * Step 3: Confirmation with import result
 *
 * Enterprise-grade design with smooth transitions, refined typography,
 * and elegant visual hierarchy.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
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
import { useImportConfirm, useImportPreview } from "@/hooks/use-milestones";
import { useThemedStyles } from "@/hooks/use-themed-styles";
import { useTheme } from "@/hooks/use-theme";
import type {
  ImportPhaseItem,
  MilestoneImportPreview,
} from "@/types/milestones";
import type { ColorPalette } from "@/constants/theme";
import {
  ANIMATION,
  BORDER_RADIUS,
  FONT_SIZE,
  FONT_WEIGHT,
  LAYOUT,
  SHADOW,
  SPACING,
} from "@/constants/theme";

// ── Step Indicator ───────────────────────────────────────────

const STEPS = ["Paste Text", "Preview", "Done"] as const;

function StepIndicator({ current }: { current: number }): React.JSX.Element {
  const si = useThemedStyles(createStepIndicatorStyles);
  const { colors } = useTheme();
  return (
    <View style={si.container}>
      {STEPS.map((label, i) => {
        const isActive = i === current;
        const isDone = i < current;
        return (
          <React.Fragment key={label}>
            {i > 0 && (
              <View
                style={[si.connector, (isActive || isDone) && si.connectorActive]}
              />
            )}
            <View style={si.stepGroup}>
              <View
                style={[
                  si.dot,
                  isActive && si.dotActive,
                  isDone && si.dotDone,
                ]}
              >
                {isDone ? (
                  <Ionicons name="checkmark" size={10} color={colors.white} />
                ) : (
                  <Text
                    style={[
                      si.dotText,
                      (isActive || isDone) && si.dotTextActive,
                    ]}
                  >
                    {i + 1}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  si.label,
                  isActive && si.labelActive,
                  isDone && si.labelDone,
                ]}
              >
                {label}
              </Text>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

function createStepIndicatorStyles(colors: ColorPalette) {
  return {
    container: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginBottom: SPACING.lg,
    },
    connector: {
      height: 1.5,
      flex: 1,
      backgroundColor: colors.borderLight,
      marginHorizontal: SPACING.xs,
    },
    connectorActive: {
      backgroundColor: colors.primary,
    },
    stepGroup: {
      alignItems: "center" as const,
    },
    dot: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.backgroundSubtle,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginBottom: 4,
    },
    dotActive: {
      backgroundColor: colors.primaryMuted,
      borderColor: colors.primary,
    },
    dotDone: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    dotText: {
      fontSize: 10,
      fontWeight: FONT_WEIGHT.bold,
      color: colors.textMuted,
    },
    dotTextActive: {
      color: colors.primary,
    },
    label: {
      fontSize: FONT_SIZE.caption,
      fontWeight: FONT_WEIGHT.medium,
      color: colors.textMuted,
    },
    labelActive: {
      color: colors.primary,
      fontWeight: FONT_WEIGHT.semibold,
    },
    labelDone: {
      color: colors.textTertiary,
    },
  };
}

// ── Phase Preview Card ───────────────────────────────────────

function PhasePreviewCard({
  phase,
  index,
}: {
  phase: ImportPhaseItem;
  index: number;
}): React.JSX.Element {
  const pc = useThemedStyles(createPhaseCardStyles);
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 80,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        delay: index * 80,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
    ]).start();
  }, [fadeAnim, slideAnim, index]);

  return (
    <Animated.View
      style={[
        pc.card,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      {/* Phase Header */}
      <View style={pc.header}>
        <View style={pc.phaseNumber}>
          <Text style={pc.phaseNumberText}>{index + 1}</Text>
        </View>
        <View style={pc.headerText}>
          <Text style={pc.title} numberOfLines={2}>
            {phase.title}
          </Text>
          {phase.description ? (
            <Text style={pc.desc} numberOfLines={2}>
              {phase.description}
            </Text>
          ) : null}
        </View>
        <View style={pc.countBadge}>
          <Text style={pc.countText}>
            {phase.milestones.length}{" "}
            {phase.milestones.length === 1 ? "task" : "tasks"}
          </Text>
        </View>
      </View>

      {/* Milestones */}
      {phase.milestones.map((ms, j) => (
        <View key={`${ms.title}-${j}`} style={pc.milestoneRow}>
          <View style={pc.milestoneCheck}>
            <Ionicons
              name="ellipse-outline"
              size={16}
              color={colors.textMuted}
            />
          </View>
          <View style={pc.milestoneContent}>
            <Text style={pc.milestoneTitle} numberOfLines={2}>
              {ms.title}
            </Text>
            {ms.description ? (
              <Text style={pc.milestoneDesc} numberOfLines={1}>
                {ms.description}
              </Text>
            ) : null}
          </View>
        </View>
      ))}
    </Animated.View>
  );
}

function createPhaseCardStyles(colors: ColorPalette) {
  return {
    card: {
      backgroundColor: colors.surface,
      borderRadius: BORDER_RADIUS.lg,
      marginBottom: SPACING.md,
      overflow: "hidden" as const,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    header: {
      flexDirection: "row" as const,
      alignItems: "flex-start" as const,
      padding: SPACING.md,
      gap: SPACING.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    phaseNumber: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.primaryMuted,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    phaseNumberText: {
      fontSize: FONT_SIZE.xs,
      fontWeight: FONT_WEIGHT.bold,
      color: colors.primary,
    },
    headerText: {
      flex: 1,
    },
    title: {
      fontSize: FONT_SIZE.md,
      fontWeight: FONT_WEIGHT.semibold,
      color: colors.textPrimary,
      letterSpacing: -0.2,
    },
    desc: {
      fontSize: FONT_SIZE.xs,
      color: colors.textTertiary,
      marginTop: 2,
      lineHeight: 16,
    },
    countBadge: {
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xxs + 1,
      borderRadius: BORDER_RADIUS.xs,
      backgroundColor: colors.backgroundSubtle,
    },
    countText: {
      fontSize: FONT_SIZE.caption,
      fontWeight: FONT_WEIGHT.semibold,
      color: colors.textTertiary,
    },
    milestoneRow: {
      flexDirection: "row" as const,
      alignItems: "flex-start" as const,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm + 2,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
      gap: SPACING.sm,
    },
    milestoneCheck: {
      marginTop: 1,
    },
    milestoneContent: {
      flex: 1,
    },
    milestoneTitle: {
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.medium,
      color: colors.textPrimary,
      lineHeight: 20,
    },
    milestoneDesc: {
      fontSize: FONT_SIZE.xs,
      color: colors.textTertiary,
      marginTop: 1,
    },
  };
}

// ── Main Import Modal ────────────────────────────────────────

interface ImportModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function ImportModal({
  visible,
  onClose,
}: ImportModalProps): React.JSX.Element {
  const s = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const [step, setStep] = useState(0);
  const [content, setContent] = useState("");
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [preview, setPreview] = useState<MilestoneImportPreview | null>(null);
  const [importResult, setImportResult] = useState<{
    phases: number;
    milestones: number;
  } | null>(null);

  const previewMutation = useImportPreview();
  const confirmMutation = useImportConfirm();

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setTimeout(() => {
        setStep(0);
        setContent("");
        setReplaceExisting(false);
        setPreview(null);
        setImportResult(null);
        previewMutation.reset();
        confirmMutation.reset();
      }, 300);
    }
  }, [visible]);

  // ── Step 1: Parse with AI ──────────────────────────────

  const handleParse = useCallback(async () => {
    try {
      const result = await previewMutation.mutateAsync({ content });
      setPreview(result);
      setStep(1);
    } catch {
      // Error is surfaced via previewMutation.error
    }
  }, [content, previewMutation]);

  // ── Step 2: Confirm Import ─────────────────────────────

  const handleConfirm = useCallback(async () => {
    try {
      const result = await confirmMutation.mutateAsync({
        content,
        replace_existing: replaceExisting,
      });
      setImportResult({
        phases: result.phases_created,
        milestones: result.milestones_created,
      });
      setStep(2);
    } catch {
      // Error is surfaced via confirmMutation.error
    }
  }, [content, replaceExisting, confirmMutation]);

  // ── Render Step Content ────────────────────────────────

  const renderStep0 = () => (
    <>
      <View style={s.heroSection}>
        <View style={s.heroIcon}>
          <Ionicons name="sparkles" size={24} color={colors.primary} />
        </View>
        <Text style={s.heroTitle}>AI-Powered Import</Text>
        <Text style={s.heroSubtitle}>
          Paste your project roadmap, plan, or scope document. Our AI will
          extract phases and milestones automatically.
        </Text>
      </View>

      <TextInput
        style={s.textArea}
        value={content}
        onChangeText={setContent}
        placeholder={`# Phase 1: Foundation\n- Set up authentication\n- Design database schema\n- Build API scaffolding\n\n# Phase 2: Core Features\n- Build document upload\n- Implement search\n- Create dashboard`}
        placeholderTextColor={colors.textMuted}
        multiline
        textAlignVertical="top"
        autoFocus={Platform.OS !== "web"}
      />

      <View style={s.charCount}>
        <Text
          style={[
            s.charCountText,
            content.length < 10 && content.length > 0 && s.charCountWarn,
          ]}
        >
          {content.length} / 50,000 characters
        </Text>
      </View>

      {previewMutation.error ? (
        <View style={s.errorBanner}>
          <Ionicons name="alert-circle" size={16} color={colors.error} />
          <Text style={s.errorBannerText}>
            {previewMutation.error instanceof Error
              ? previewMutation.error.message
              : "Failed to parse. Please try again."}
          </Text>
        </View>
      ) : null}

      <View style={s.actions}>
        <Button label="Cancel" variant="ghost" onPress={onClose} fullWidth={false} />
        <Button
          label={previewMutation.isPending ? "Analyzing..." : "Parse with AI"}
          variant="primary"
          onPress={handleParse}
          loading={previewMutation.isPending}
          disabled={content.length < 10 || previewMutation.isPending}
          fullWidth={false}
        />
      </View>
    </>
  );

  const renderStep1 = () => (
    <>
      {/* Summary Header */}
      <View style={s.previewHeader}>
        <View style={s.previewStat}>
          <Text style={s.previewStatNumber}>{preview?.total_phases ?? 0}</Text>
          <Text style={s.previewStatLabel}>Phases</Text>
        </View>
        <View style={s.previewStatDivider} />
        <View style={s.previewStat}>
          <Text style={s.previewStatNumber}>
            {preview?.total_milestones ?? 0}
          </Text>
          <Text style={s.previewStatLabel}>Milestones</Text>
        </View>
      </View>

      {/* Preview Cards */}
      <ScrollView
        style={s.previewScroll}
        contentContainerStyle={s.previewScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {preview?.phases.map((phase, i) => (
          <PhasePreviewCard key={`${phase.title}-${i}`} phase={phase} index={i} />
        ))}
      </ScrollView>

      {/* Replace toggle */}
      <Pressable
        style={s.toggleRow}
        onPress={() => setReplaceExisting((prev) => !prev)}
      >
        <View
          style={[s.toggleBox, replaceExisting && s.toggleBoxActive]}
        >
          {replaceExisting && (
            <Ionicons name="checkmark" size={12} color={colors.white} />
          )}
        </View>
        <View style={s.toggleContent}>
          <Text style={s.toggleLabel}>Replace existing milestones</Text>
          <Text style={s.toggleDesc}>
            Delete all current phases before importing
          </Text>
        </View>
      </Pressable>

      {confirmMutation.error ? (
        <View style={s.errorBanner}>
          <Ionicons name="alert-circle" size={16} color={colors.error} />
          <Text style={s.errorBannerText}>
            {confirmMutation.error instanceof Error
              ? confirmMutation.error.message
              : "Import failed. Please try again."}
          </Text>
        </View>
      ) : null}

      <View style={s.actions}>
        <Button
          label="Back"
          variant="ghost"
          onPress={() => setStep(0)}
          fullWidth={false}
        />
        <Button
          label={confirmMutation.isPending ? "Importing..." : "Confirm Import"}
          variant="primary"
          onPress={handleConfirm}
          loading={confirmMutation.isPending}
          disabled={confirmMutation.isPending}
          fullWidth={false}
        />
      </View>
    </>
  );

  const renderStep2 = () => (
    <View style={s.successContainer}>
      <View style={s.successIconOuter}>
        <View style={s.successIconInner}>
          <Ionicons name="checkmark" size={28} color={colors.white} />
        </View>
      </View>
      <Text style={s.successTitle}>Import Complete</Text>
      <Text style={s.successSubtitle}>
        Created {importResult?.phases ?? 0} phases and{" "}
        {importResult?.milestones ?? 0} milestones
      </Text>

      <View style={s.successStats}>
        <View style={s.successStatCard}>
          <Ionicons name="layers-outline" size={20} color={colors.primary} />
          <Text style={s.successStatNumber}>
            {importResult?.phases ?? 0}
          </Text>
          <Text style={s.successStatLabel}>Phases</Text>
        </View>
        <View style={s.successStatCard}>
          <Ionicons name="flag-outline" size={20} color={colors.primary} />
          <Text style={s.successStatNumber}>
            {importResult?.milestones ?? 0}
          </Text>
          <Text style={s.successStatLabel}>Milestones</Text>
        </View>
      </View>

      <View style={{ marginTop: SPACING.lg, width: "100%" }}>
        <Button label="Done" variant="primary" onPress={onClose} />
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={s.overlay} onPress={step < 2 ? onClose : undefined}>
        <Pressable
          style={[s.modalContent, step === 1 && s.modalContentTall]}
          onPress={() => {}}
        >
          <StepIndicator current={step} />

          {step === 0 && renderStep0()}
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
        </Pressable>
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
      justifyContent: "center" as const,
      alignItems: "center" as const,
      padding: LAYOUT.screenPaddingH,
    },
    modalContent: {
      width: "100%" as const,
      maxWidth: 540,
      backgroundColor: colors.surface,
      borderRadius: BORDER_RADIUS.xl,
      padding: SPACING.lg,
      maxHeight: "80%" as const,
      ...SHADOW.lg,
    },
    modalContentTall: {
      maxHeight: "90%" as const,
    },

    // ── Hero ─────────────────────────────────────────────
    heroSection: {
      alignItems: "center" as const,
      marginBottom: SPACING.lg,
    },
    heroIcon: {
      width: 48,
      height: 48,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: colors.primaryMuted,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginBottom: SPACING.md,
    },
    heroTitle: {
      fontSize: FONT_SIZE.xl,
      fontWeight: FONT_WEIGHT.bold,
      color: colors.textPrimary,
      letterSpacing: -0.3,
      marginBottom: SPACING.xs,
    },
    heroSubtitle: {
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.regular,
      color: colors.textSecondary,
      textAlign: "center" as const,
      lineHeight: 20,
      maxWidth: 380,
    },

    // ── Text Area ────────────────────────────────────────
    textArea: {
      height: 200,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: BORDER_RADIUS.md,
      padding: SPACING.md,
      fontSize: FONT_SIZE.sm,
      color: colors.textPrimary,
      backgroundColor: colors.background,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      lineHeight: 20,
    },
    charCount: {
      alignItems: "flex-end" as const,
      marginTop: SPACING.xs,
      marginBottom: SPACING.sm,
    },
    charCountText: {
      fontSize: FONT_SIZE.caption,
      color: colors.textMuted,
    },
    charCountWarn: {
      color: colors.warning,
    },

    // ── Error Banner ─────────────────────────────────────
    errorBanner: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: SPACING.sm,
      backgroundColor: colors.errorMuted,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm + 2,
      borderRadius: BORDER_RADIUS.md,
      marginBottom: SPACING.md,
    },
    errorBannerText: {
      fontSize: FONT_SIZE.sm,
      color: colors.error,
      flex: 1,
    },

    // ── Actions ──────────────────────────────────────────
    actions: {
      flexDirection: "row" as const,
      justifyContent: "flex-end" as const,
      gap: SPACING.sm,
      marginTop: SPACING.sm,
    },

    // ── Preview ──────────────────────────────────────────
    previewHeader: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      backgroundColor: colors.backgroundSubtle,
      borderRadius: BORDER_RADIUS.md,
      paddingVertical: SPACING.md,
      marginBottom: SPACING.md,
    },
    previewStat: {
      alignItems: "center" as const,
      paddingHorizontal: SPACING.lg,
    },
    previewStatNumber: {
      fontSize: FONT_SIZE.xxl,
      fontWeight: FONT_WEIGHT.bold,
      color: colors.primary,
      letterSpacing: -0.5,
    },
    previewStatLabel: {
      fontSize: FONT_SIZE.xs,
      fontWeight: FONT_WEIGHT.medium,
      color: colors.textTertiary,
      marginTop: 2,
    },
    previewStatDivider: {
      width: 1,
      height: 36,
      backgroundColor: colors.border,
    },
    previewScroll: {
      flex: 1,
      maxHeight: 350,
    },
    previewScrollContent: {
      paddingBottom: SPACING.sm,
    },

    // ── Toggle ───────────────────────────────────────────
    toggleRow: {
      flexDirection: "row" as const,
      alignItems: "flex-start" as const,
      paddingVertical: SPACING.md,
      gap: SPACING.sm,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    toggleBox: {
      width: 20,
      height: 20,
      borderRadius: BORDER_RADIUS.xs,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.background,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginTop: 1,
    },
    toggleBoxActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    toggleContent: {
      flex: 1,
    },
    toggleLabel: {
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.medium,
      color: colors.textPrimary,
    },
    toggleDesc: {
      fontSize: FONT_SIZE.xs,
      color: colors.textTertiary,
      marginTop: 1,
    },

    // ── Success ──────────────────────────────────────────
    successContainer: {
      alignItems: "center" as const,
      paddingVertical: SPACING.lg,
    },
    successIconOuter: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primaryMuted,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginBottom: SPACING.lg,
    },
    successIconInner: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    successTitle: {
      fontSize: FONT_SIZE.xl,
      fontWeight: FONT_WEIGHT.bold,
      color: colors.textPrimary,
      letterSpacing: -0.3,
      marginBottom: SPACING.xs,
    },
    successSubtitle: {
      fontSize: FONT_SIZE.sm,
      color: colors.textSecondary,
      textAlign: "center" as const,
      marginBottom: SPACING.lg,
    },
    successStats: {
      flexDirection: "row" as const,
      gap: SPACING.md,
    },
    successStatCard: {
      alignItems: "center" as const,
      backgroundColor: colors.backgroundSubtle,
      paddingHorizontal: SPACING.xl,
      paddingVertical: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      gap: SPACING.xs,
    },
    successStatNumber: {
      fontSize: FONT_SIZE.xxl,
      fontWeight: FONT_WEIGHT.bold,
      color: colors.textPrimary,
      letterSpacing: -0.5,
    },
    successStatLabel: {
      fontSize: FONT_SIZE.xs,
      fontWeight: FONT_WEIGHT.medium,
      color: colors.textTertiary,
    },
  };
}
