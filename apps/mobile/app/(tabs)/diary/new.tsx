/**
 * New Diary Entry screen — modal form.
 *
 * Ultra-premium entry form with date picker, optional milestone
 * linking, hours tracking, and rich description input.
 * Designed to feel snappy and enterprise-grade.
 */

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useCreateDiaryEntry } from "@/hooks/use-diary";
import { usePhases } from "@/hooks/use-milestones";
import type { DiaryEntryCreatePayload } from "@/types/diary";
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

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// ── Milestone Picker ────────────────────────────────────────

interface MilestonePickerProps {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

function MilestonePicker({
  selectedId,
  onSelect,
}: MilestonePickerProps): React.JSX.Element {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { data: phases } = usePhases();
  const [expanded, setExpanded] = useState(false);

  const allMilestones = useMemo(() => {
    if (!phases) return [];
    return phases.flatMap((p) =>
      p.milestones.map((m) => ({
        id: m.id,
        title: m.title,
        phaseTitle: p.title,
        status: m.status,
      }))
    );
  }, [phases]);

  const selectedMilestone = allMilestones.find((m) => m.id === selectedId);

  if (!expanded) {
    return (
      <Pressable
        style={styles.pickerButton}
        onPress={() => setExpanded(true)}
      >
        <Ionicons
          name="flag"
          size={16}
          color={selectedId ? colors.primary : colors.textTertiary}
        />
        <Text
          style={[
            styles.pickerButtonText,
            selectedId ? styles.pickerButtonTextActive : null,
          ]}
          numberOfLines={1}
        >
          {selectedMilestone
            ? selectedMilestone.title
            : "Link to a milestone (optional)"}
        </Text>
        <Ionicons
          name="chevron-down"
          size={16}
          color={colors.textTertiary}
        />
      </Pressable>
    );
  }

  return (
    <View style={styles.pickerDropdown}>
      <View style={styles.pickerDropdownHeader}>
        <Text style={styles.pickerDropdownTitle}>Link Milestone</Text>
        <Pressable onPress={() => setExpanded(false)}>
          <Ionicons name="close" size={20} color={colors.textTertiary} />
        </Pressable>
      </View>

      {/* None option */}
      <Pressable
        style={[
          styles.pickerOption,
          selectedId === null ? styles.pickerOptionActive : null,
        ]}
        onPress={() => {
          onSelect(null);
          setExpanded(false);
        }}
      >
        <Text style={styles.pickerOptionText}>No milestone</Text>
        {selectedId === null && (
          <Ionicons
            name="checkmark"
            size={16}
            color={colors.primary}
          />
        )}
      </Pressable>

      {allMilestones.map((m) => (
        <Pressable
          key={m.id}
          style={[
            styles.pickerOption,
            m.id === selectedId ? styles.pickerOptionActive : null,
          ]}
          onPress={() => {
            onSelect(m.id);
            setExpanded(false);
          }}
        >
          <View style={styles.pickerOptionContent}>
            <Text style={styles.pickerOptionText} numberOfLines={1}>
              {m.title}
            </Text>
            <Text style={styles.pickerOptionSub}>{m.phaseTitle}</Text>
          </View>
          {m.id === selectedId && (
            <Ionicons
              name="checkmark"
              size={16}
              color={colors.primary}
            />
          )}
        </Pressable>
      ))}
    </View>
  );
}

// ── Date Quick-Picks ────────────────────────────────────────

const DATE_OPTIONS = (() => {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  return [
    { label: "Today", value: today.toISOString().split("T")[0] },
    { label: "Yesterday", value: yesterday.toISOString().split("T")[0] },
    {
      label: twoDaysAgo.toLocaleDateString("en-US", { weekday: "short" }),
      value: twoDaysAgo.toISOString().split("T")[0],
    },
  ];
})();

// ── Main Form ───────────────────────────────────────────────

export default function NewDiaryEntryScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const router = useRouter();
  const createEntry = useCreateDiaryEntry();

  const [entryDate, setEntryDate] = useState(todayISO());
  const [milestoneId, setMilestoneId] = useState<string | null>(null);
  const [hoursWorked, setHoursWorked] = useState("");
  const [description, setDescription] = useState("");

  const canSubmit =
    description.trim().length > 0 && !createEntry.isPending;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;

    const payload: DiaryEntryCreatePayload = {
      entry_date: entryDate,
      description: description.trim(),
      milestone_id: milestoneId,
      hours_worked: hoursWorked ? parseFloat(hoursWorked) : null,
    };

    try {
      await createEntry.mutateAsync(payload);
      router.back();
    } catch {
      Alert.alert("Error", "Failed to save your diary entry. Try again.");
    }
  }, [canSubmit, entryDate, description, milestoneId, hoursWorked, createEntry, router]);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={100}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Date Picker ──────────────────────────────── */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Date</Text>
          <View style={styles.dateRow}>
            {DATE_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                style={[
                  styles.dateChip,
                  opt.value === entryDate ? styles.dateChipActive : null,
                ]}
                onPress={() => setEntryDate(opt.value)}
              >
                <Text
                  style={[
                    styles.dateChipText,
                    opt.value === entryDate
                      ? styles.dateChipTextActive
                      : null,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.dateDisplay}>{formatDateDisplay(entryDate)}</Text>
        </View>

        {/* ── Milestone Link ───────────────────────────── */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Milestone</Text>
          <MilestonePicker
            selectedId={milestoneId}
            onSelect={setMilestoneId}
          />
        </View>

        {/* ── Hours Worked ─────────────────────────────── */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Hours worked (optional)</Text>
          <View style={styles.hoursInputWrapper}>
            <Ionicons
              name="time-outline"
              size={18}
              color={colors.textTertiary}
            />
            <TextInput
              style={styles.hoursInput}
              value={hoursWorked}
              onChangeText={setHoursWorked}
              placeholder="e.g. 4.5"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              returnKeyType="next"
              maxLength={5}
            />
            <Text style={styles.hoursUnit}>hours</Text>
          </View>
        </View>

        {/* ── Description ──────────────────────────────── */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>What did you work on?</Text>
          <TextInput
            style={styles.descriptionInput}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe what you worked on today…"
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
            returnKeyType="default"
            autoFocus
          />
          <Text style={styles.charCount}>
            {description.length} characters
          </Text>
        </View>
      </ScrollView>

      {/* ── Submit Button ──────────────────────────────── */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.cancelButton]}
          onPress={() => router.back()}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[
            styles.submitButton,
            !canSubmit ? styles.submitButtonDisabled : null,
          ]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          {createEntry.isPending ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <>
              <Ionicons name="checkmark" size={20} color={colors.white} />
              <Text style={styles.submitButtonText}>Log Entry</Text>
            </>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Styles ──────────────────────────────────────────────────

function createStyles(colors: ColorPalette) {
  return {
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: LAYOUT.screenPaddingH,
      paddingTop: SPACING.lg,
      paddingBottom: SPACING.xxl,
    },

    // ── Field groups ──────────────────────────────────────
    fieldGroup: {
      marginBottom: SPACING.lg,
    },
    fieldLabel: {
      fontSize: FONT_SIZE.xs,
      fontWeight: FONT_WEIGHT.semibold,
      color: colors.textTertiary,
      textTransform: "uppercase" as const,
      letterSpacing: 0.8,
      marginBottom: SPACING.sm,
    },

    // ── Date picker ───────────────────────────────────────
    dateRow: {
      flexDirection: "row" as const,
      gap: SPACING.sm,
      marginBottom: SPACING.sm,
    },
    dateChip: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: BORDER_RADIUS.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    dateChipActive: {
      backgroundColor: colors.primaryMuted,
      borderColor: colors.primary,
    },
    dateChipText: {
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.medium,
      color: colors.textSecondary,
    },
    dateChipTextActive: {
      color: colors.primary,
      fontWeight: FONT_WEIGHT.semibold,
    },
    dateDisplay: {
      fontSize: FONT_SIZE.caption,
      fontWeight: FONT_WEIGHT.medium,
      color: colors.textMuted,
    },

    // ── Milestone picker ──────────────────────────────────
    pickerButton: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: colors.surface,
      borderRadius: BORDER_RADIUS.md,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
      gap: SPACING.sm,
    },
    pickerButtonText: {
      flex: 1,
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.regular,
      color: colors.textMuted,
    },
    pickerButtonTextActive: {
      color: colors.textPrimary,
      fontWeight: FONT_WEIGHT.medium,
    },
    pickerDropdown: {
      backgroundColor: colors.surface,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
      overflow: "hidden" as const,
      ...SHADOW.md,
    },
    pickerDropdownHeader: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    pickerDropdownTitle: {
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.semibold,
      color: colors.textPrimary,
    },
    pickerOption: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm + 2,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
    },
    pickerOptionActive: {
      backgroundColor: colors.primaryMuted,
    },
    pickerOptionContent: {
      flex: 1,
    },
    pickerOptionText: {
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.medium,
      color: colors.textPrimary,
    },
    pickerOptionSub: {
      fontSize: FONT_SIZE.caption,
      fontWeight: FONT_WEIGHT.regular,
      color: colors.textTertiary,
      marginTop: 1,
    },

    // ── Hours input ───────────────────────────────────────
    hoursInputWrapper: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: colors.surface,
      borderRadius: BORDER_RADIUS.md,
      paddingHorizontal: SPACING.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
      gap: SPACING.sm,
    },
    hoursInput: {
      flex: 1,
      fontSize: FONT_SIZE.md,
      fontWeight: FONT_WEIGHT.medium,
      color: colors.textPrimary,
      paddingVertical: SPACING.md,
    },
    hoursUnit: {
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.medium,
      color: colors.textTertiary,
    },

    // ── Description ───────────────────────────────────────
    descriptionInput: {
      backgroundColor: colors.surface,
      borderRadius: BORDER_RADIUS.md,
      paddingHorizontal: SPACING.md,
      paddingTop: SPACING.md,
      paddingBottom: SPACING.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.regular,
      color: colors.textPrimary,
      lineHeight: 22,
      minHeight: 160,
    },
    charCount: {
      fontSize: FONT_SIZE.caption,
      fontWeight: FONT_WEIGHT.medium,
      color: colors.textMuted,
      textAlign: "right" as const,
      marginTop: SPACING.xs,
    },

    // ── Footer ────────────────────────────────────────────
    footer: {
      flexDirection: "row" as const,
      paddingHorizontal: LAYOUT.screenPaddingH,
      paddingVertical: SPACING.md,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
      gap: SPACING.sm,
      ...SHADOW.sm,
    },
    cancelButton: {
      flex: 1,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      height: LAYOUT.buttonHeight,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: colors.backgroundSubtle,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    cancelButtonText: {
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.semibold,
      color: colors.textSecondary,
    },
    submitButton: {
      flex: 2,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      height: LAYOUT.buttonHeight,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: colors.primary,
      gap: SPACING.xs,
      ...SHADOW.glow,
    },
    submitButtonDisabled: {
      opacity: 0.5,
    },
    submitButtonText: {
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.bold,
      color: colors.white,
      letterSpacing: 0.2,
    },
  };
}
