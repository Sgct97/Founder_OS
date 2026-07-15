/**
 * Diary screen — accountability timeline.
 *
 * Ultra-premium timeline with reverse-chronological feed,
 * author color indicators, streak cards, linked milestones,
 * and a FAB to add new entries. Designed to rival Linear.
 */

import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useAuth } from "@/hooks/use-auth";
import {
  useDeleteDiaryEntry,
  useDiaryEntries,
  useStreaks,
} from "@/hooks/use-diary";
import {
  SkeletonStreakRow,
  SkeletonTimelineEntry,
} from "@/components/ui/Skeleton";
import { useTourRef } from "@/components/tour/TourProvider";
import type { DiaryEntryResponse, StreakInfo } from "@/types/diary";
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

// ── Author color assignment ─────────────────────────────────

function getAuthorColors(colors: ColorPalette) {
  return [
    { bg: colors.primaryMuted, text: colors.primary, dot: colors.primary },
    { bg: colors.infoMuted, text: colors.info, dot: colors.info },
  ] as const;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// ── Streak Card ─────────────────────────────────────────────

interface StreakCardProps {
  streak: StreakInfo;
  isCurrentUser: boolean;
}

function StreakCard({
  streak,
  isCurrentUser,
}: StreakCardProps): React.JSX.Element {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const authorColors = getAuthorColors(colors);
  const author = isCurrentUser ? authorColors[0] : authorColors[1];

  return (
    <View style={[styles.streakCard, { borderLeftColor: author.dot }]}>
      <View style={styles.streakCardTop}>
        <View style={[styles.streakAvatar, { backgroundColor: author.bg }]}>
          <Text style={[styles.streakAvatarText, { color: author.text }]}>
            {getInitials(streak.display_name)}
          </Text>
        </View>
        <View style={styles.streakInfo}>
          <Text style={styles.streakName} numberOfLines={1}>
            {streak.display_name}
            {isCurrentUser ? " (you)" : ""}
          </Text>
          <View style={styles.streakStatusRow}>
            {streak.logged_today ? (
              <Ionicons
                name="checkmark-circle"
                size={14}
                color={colors.success}
              />
            ) : (
              <Ionicons name="close-circle" size={14} color={colors.error} />
            )}
            <Text
              style={[
                styles.streakStatusText,
                { color: streak.logged_today ? colors.success : colors.error },
              ]}
            >
              {streak.logged_today ? "Logged today" : "Not logged today"}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.streakBadge}>
        <Ionicons name="flame" size={16} color={colors.warning} />
        <Text style={styles.streakCount}>{streak.current_streak}</Text>
        <Text style={styles.streakDaysLabel}>day streak</Text>
      </View>
    </View>
  );
}

// ── Timeline Entry ──────────────────────────────────────────

interface EntryCardProps {
  entry: DiaryEntryResponse;
  isCurrentUser: boolean;
  onDelete: (id: string) => void;
}

function EntryCard({
  entry,
  isCurrentUser,
  onDelete,
}: EntryCardProps): React.JSX.Element {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const authorColors = getAuthorColors(colors);
  const author = isCurrentUser ? authorColors[0] : authorColors[1];

  const handleLongPress = useCallback(() => {
    if (!isCurrentUser) return;
    Alert.alert("Diary Entry", undefined, [
      {
        text: "Delete",
        style: "destructive",
        onPress: () => onDelete(entry.id),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [entry.id, isCurrentUser, onDelete]);

  return (
    <Pressable
      style={styles.entryCard}
      onLongPress={handleLongPress}
      delayLongPress={400}
    >
      {/* Timeline dot + line */}
      <View style={styles.timelineDotCol}>
        <View style={[styles.timelineDot, { backgroundColor: author.dot }]} />
        <View style={styles.timelineLine} />
      </View>

      {/* Content */}
      <View style={styles.entryContent}>
        {/* Header */}
        <View style={styles.entryHeader}>
          <View style={[styles.entryAvatar, { backgroundColor: author.bg }]}>
            <Text style={[styles.entryAvatarText, { color: author.text }]}>
              {getInitials(entry.author.display_name)}
            </Text>
          </View>
          <View style={styles.entryMeta}>
            <Text style={styles.entryAuthor}>
              {entry.author.display_name}
            </Text>
            <Text style={styles.entryDate}>
              {formatDate(entry.entry_date)}
            </Text>
          </View>
          {entry.hours_worked != null && entry.hours_worked > 0 ? (
            <View style={styles.hoursBadge}>
              <Ionicons
                name="time-outline"
                size={12}
                color={colors.textTertiary}
              />
              <Text style={styles.hoursText}>{entry.hours_worked}h</Text>
            </View>
          ) : null}
        </View>

        {/* Description */}
        <Text style={styles.entryDescription}>{entry.description}</Text>

        {/* Linked Milestone */}
        {entry.milestone ? (
          <View style={styles.linkedMilestone}>
            <Ionicons name="flag" size={12} color={colors.primary} />
            <Text style={styles.linkedMilestoneText} numberOfLines={1}>
              {entry.milestone.title}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

// ── Empty State ─────────────────────────────────────────────

function EmptyState(): React.JSX.Element {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();

  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="journal" size={32} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>Accountability Diary</Text>
      <Text style={styles.emptyBody}>
        Log what you worked on every day. Stay accountable with your co-founder
        and build a streak you can be proud of.
      </Text>
      <View style={styles.emptyStreakRow}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.emptyStreakDot} />
        ))}
        {[3, 4, 5, 6].map((i) => (
          <View key={i} style={styles.emptyStreakDotEmpty} />
        ))}
      </View>
      <Text style={styles.emptyStreakLabel}>Start your streak today</Text>
    </View>
  );
}

// ── Main Screen ─────────────────────────────────────────────

export default function DiaryScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const {
    data: entries,
    isLoading: entriesLoading,
    error: entriesError,
    refetch: refetchEntries,
  } = useDiaryEntries();
  const { data: streaksData, isLoading: streaksLoading } = useStreaks();
  const deleteEntry = useDeleteDiaryEntry();

  const timelineRef = useTourRef("diary-timeline");
  const streakRef = useTourRef("diary-streak");
  const addRef = useTourRef("diary-add");

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetchEntries();
    setRefreshing(false);
  }, [refetchEntries]);

  const handleDeleteEntry = useCallback(
    (entryId: string) => {
      Alert.alert(
        "Delete Entry",
        "This will permanently delete this diary entry.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => deleteEntry.mutate(entryId),
          },
        ]
      );
    },
    [deleteEntry]
  );

  const handleNewEntry = useCallback(() => {
    router.push("/(tabs)/diary/new");
  }, [router]);

  // Group entries by date for section headers
  const groupedEntries = useMemo(() => {
    if (!entries) return [];
    const groups: { date: string; label: string; entries: DiaryEntryResponse[] }[] = [];
    let currentDate = "";

    for (const entry of entries) {
      if (entry.entry_date !== currentDate) {
        currentDate = entry.entry_date;
        groups.push({
          date: currentDate,
          label: formatDate(currentDate),
          entries: [],
        });
      }
      groups[groups.length - 1].entries.push(entry);
    }

    return groups;
  }, [entries]);

  if (entriesLoading && !entries) {
    return (
      <View style={styles.screen}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <SkeletonStreakRow />
          {[0, 1, 2, 3].map((i) => (
            <SkeletonTimelineEntry key={i} />
          ))}
        </ScrollView>
      </View>
    );
  }

  if (entriesError) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={32} color={colors.error} />
        <Text style={styles.errorText}>Failed to load diary entries</Text>
        <Text style={styles.errorDetail}>
          {entriesError instanceof Error
            ? entriesError.message
            : "An unexpected error occurred"}
        </Text>
        <Pressable style={styles.retryButton} onPress={() => refetchEntries()}>
          <Ionicons name="refresh" size={16} color={colors.primary} />
          <Text style={styles.retryText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  const hasEntries = entries && entries.length > 0;

  return (
    <View style={styles.screen}>
      {hasEntries ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {/* Streaks Section */}
          {streaksData && streaksData.streaks.length > 0 && (
            <View ref={streakRef} collapsable={false} style={styles.streaksSection}>
              <Text style={styles.sectionTitle}>Streaks</Text>
              <View style={styles.streaksRow}>
                {streaksData.streaks.map((streak) => (
                  <StreakCard
                    key={streak.user_id}
                    streak={streak}
                    isCurrentUser={streak.user_id === user?.id}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Timeline */}
          <View ref={timelineRef} collapsable={false}>
          <Text style={styles.sectionTitle}>Timeline</Text>
          </View>
          {groupedEntries.map((group) => (
            <View key={group.date}>
              <Text style={styles.dateSectionHeader}>{group.label}</Text>
              {group.entries.map((entry) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  isCurrentUser={entry.author.id === user?.id}
                  onDelete={handleDeleteEntry}
                />
              ))}
            </View>
          ))}
        </ScrollView>
      ) : (
        <EmptyState />
      )}

      {/* FAB — New Entry */}
      <Pressable ref={addRef} collapsable={false} style={styles.fab} onPress={handleNewEntry}>
        <Ionicons name="add" size={28} color={colors.white} />
      </Pressable>
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
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: LAYOUT.screenPaddingH,
      paddingTop: SPACING.lg,
      paddingBottom: 100,
    },

    // ── Section headers ───────────────────────────────────
    sectionTitle: {
      fontSize: FONT_SIZE.xs,
      fontWeight: FONT_WEIGHT.semibold,
      color: colors.textTertiary,
      textTransform: "uppercase" as const,
      letterSpacing: 0.8,
      marginBottom: SPACING.md,
    },
    dateSectionHeader: {
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.semibold,
      color: colors.textSecondary,
      marginBottom: SPACING.sm,
      marginTop: SPACING.sm,
    },

    // ── Streaks ───────────────────────────────────────────
    streaksSection: {
      marginBottom: SPACING.lg,
    },
    streaksRow: {
      flexDirection: "row" as const,
      gap: SPACING.sm,
    },
    streakCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.md,
      borderLeftWidth: 3,
      ...SHADOW.sm,
    },
    streakCardTop: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      marginBottom: SPACING.sm,
    },
    streakAvatar: {
      width: 32,
      height: 32,
      borderRadius: BORDER_RADIUS.full,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginRight: SPACING.sm,
    },
    streakAvatarText: {
      fontSize: FONT_SIZE.xs,
      fontWeight: FONT_WEIGHT.bold,
    },
    streakInfo: {
      flex: 1,
    },
    streakName: {
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.semibold,
      color: colors.textPrimary,
      marginBottom: 1,
    },
    streakStatusRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: SPACING.xxs,
    },
    streakStatusText: {
      fontSize: FONT_SIZE.caption,
      fontWeight: FONT_WEIGHT.medium,
    },
    streakBadge: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: SPACING.xxs,
    },
    streakCount: {
      fontSize: FONT_SIZE.lg,
      fontWeight: FONT_WEIGHT.bold,
      color: colors.textPrimary,
    },
    streakDaysLabel: {
      fontSize: FONT_SIZE.xs,
      color: colors.textTertiary,
      fontWeight: FONT_WEIGHT.medium,
    },

    // ── Timeline Entry ────────────────────────────────────
    entryCard: {
      flexDirection: "row" as const,
      marginBottom: SPACING.xs,
    },
    timelineDotCol: {
      alignItems: "center" as const,
      width: 20,
      marginRight: SPACING.sm,
    },
    timelineDot: {
      width: 10,
      height: 10,
      borderRadius: BORDER_RADIUS.full,
      marginTop: 6,
    },
    timelineLine: {
      flex: 1,
      width: 2,
      backgroundColor: colors.borderLight,
      marginTop: SPACING.xxs,
    },
    entryContent: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: BORDER_RADIUS.md,
      padding: SPACING.md,
      marginBottom: SPACING.sm,
      ...SHADOW.sm,
    },
    entryHeader: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      marginBottom: SPACING.sm,
    },
    entryAvatar: {
      width: 28,
      height: 28,
      borderRadius: BORDER_RADIUS.full,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginRight: SPACING.sm,
    },
    entryAvatarText: {
      fontSize: FONT_SIZE.caption,
      fontWeight: FONT_WEIGHT.bold,
    },
    entryMeta: {
      flex: 1,
    },
    entryAuthor: {
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.semibold,
      color: colors.textPrimary,
    },
    entryDate: {
      fontSize: FONT_SIZE.caption,
      color: colors.textTertiary,
      fontWeight: FONT_WEIGHT.medium,
    },
    hoursBadge: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: colors.backgroundSubtle,
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xxs,
      borderRadius: BORDER_RADIUS.xs,
      gap: SPACING.xxs,
    },
    hoursText: {
      fontSize: FONT_SIZE.xs,
      fontWeight: FONT_WEIGHT.semibold,
      color: colors.textTertiary,
    },
    entryDescription: {
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.regular,
      color: colors.textPrimary,
      lineHeight: 21,
    },
    linkedMilestone: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      marginTop: SPACING.sm,
      paddingTop: SPACING.sm,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
      gap: SPACING.xs,
    },
    linkedMilestoneText: {
      fontSize: FONT_SIZE.xs,
      fontWeight: FONT_WEIGHT.medium,
      color: colors.primary,
      flex: 1,
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
    emptyStreakRow: {
      flexDirection: "row" as const,
      gap: SPACING.sm,
      marginBottom: SPACING.sm,
    },
    emptyStreakDot: {
      width: 28,
      height: 28,
      borderRadius: BORDER_RADIUS.sm,
      backgroundColor: colors.primary,
      opacity: 0.25,
    },
    emptyStreakDotEmpty: {
      width: 28,
      height: 28,
      borderRadius: BORDER_RADIUS.sm,
      backgroundColor: colors.borderLight,
    },
    emptyStreakLabel: {
      fontSize: FONT_SIZE.xs,
      fontWeight: FONT_WEIGHT.medium,
      color: colors.textMuted,
    },

    // ── FAB ───────────────────────────────────────────────
    fab: {
      position: "absolute" as const,
      bottom: 24,
      right: LAYOUT.screenPaddingH,
      width: 56,
      height: 56,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: colors.primary,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      ...SHADOW.glow,
    },
  };
}
