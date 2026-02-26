/**
 * Diary screen — accountability timeline.
 *
 * Ultra-premium timeline with reverse-chronological feed,
 * author color indicators, streak cards, linked milestones,
 * and a FAB to add new entries. Designed to rival Linear.
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

import { useAuth } from "@/hooks/use-auth";
import {
  useDeleteDiaryEntry,
  useDiaryEntries,
  useStreaks,
} from "@/hooks/use-diary";
import type { DiaryEntryResponse, StreakInfo } from "@/types/diary";
import {
  BORDER_RADIUS,
  COLORS,
  FONT_SIZE,
  FONT_WEIGHT,
  LAYOUT,
  SHADOW,
  SPACING,
} from "@/constants/theme";

// ── Author color assignment ─────────────────────────────────

const AUTHOR_COLORS = [
  { bg: "rgba(46, 196, 160, 0.12)", text: COLORS.primary, dot: COLORS.primary },
  { bg: "rgba(59, 130, 246, 0.12)", text: COLORS.info, dot: COLORS.info },
] as const;

function getAuthorColor(authorId: string, currentUserId: string | undefined) {
  if (authorId === currentUserId) return AUTHOR_COLORS[0];
  return AUTHOR_COLORS[1];
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
  const colors = isCurrentUser ? AUTHOR_COLORS[0] : AUTHOR_COLORS[1];

  return (
    <View style={[styles.streakCard, { borderLeftColor: colors.dot }]}>
      <View style={styles.streakCardTop}>
        <View style={[styles.streakAvatar, { backgroundColor: colors.bg }]}>
          <Text style={[styles.streakAvatarText, { color: colors.text }]}>
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
                color={COLORS.success}
              />
            ) : (
              <Ionicons name="close-circle" size={14} color={COLORS.error} />
            )}
            <Text
              style={[
                styles.streakStatusText,
                { color: streak.logged_today ? COLORS.success : COLORS.error },
              ]}
            >
              {streak.logged_today ? "Logged today" : "Not logged today"}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.streakBadge}>
        <Ionicons name="flame" size={16} color={COLORS.warning} />
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
  const colors = isCurrentUser ? AUTHOR_COLORS[0] : AUTHOR_COLORS[1];

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
        <View style={[styles.timelineDot, { backgroundColor: colors.dot }]} />
        <View style={styles.timelineLine} />
      </View>

      {/* Content */}
      <View style={styles.entryContent}>
        {/* Header */}
        <View style={styles.entryHeader}>
          <View style={[styles.entryAvatar, { backgroundColor: colors.bg }]}>
            <Text style={[styles.entryAvatarText, { color: colors.text }]}>
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
                color={COLORS.textTertiary}
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
            <Ionicons name="flag" size={12} color={COLORS.primary} />
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
  const router = useRouter();

  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="journal" size={32} color={COLORS.primary} />
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  if (entriesError) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={32} color={COLORS.error} />
        <Text style={styles.errorText}>Failed to load diary entries</Text>
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
              tintColor={COLORS.primary}
            />
          }
        >
          {/* Streaks Section */}
          {streaksData && streaksData.streaks.length > 0 && (
            <View style={styles.streaksSection}>
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
          <Text style={styles.sectionTitle}>Timeline</Text>
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
      <Pressable style={styles.fab} onPress={handleNewEntry}>
        <Ionicons name="add" size={28} color={COLORS.white} />
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
  errorText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
    marginTop: SPACING.md,
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
    color: COLORS.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: SPACING.md,
  },
  dateSectionHeader: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
  },

  // ── Streaks ───────────────────────────────────────────
  streaksSection: {
    marginBottom: SPACING.lg,
  },
  streaksRow: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  streakCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderLeftWidth: 3,
    ...SHADOW.sm,
  },
  streakCardTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  streakAvatar: {
    width: 32,
    height: 32,
    borderRadius: BORDER_RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
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
    color: COLORS.textPrimary,
    marginBottom: 1,
  },
  streakStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xxs,
  },
  streakStatusText: {
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.medium,
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xxs,
  },
  streakCount: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
  },
  streakDaysLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textTertiary,
    fontWeight: FONT_WEIGHT.medium,
  },

  // ── Timeline Entry ────────────────────────────────────
  entryCard: {
    flexDirection: "row",
    marginBottom: SPACING.xs,
  },
  timelineDotCol: {
    alignItems: "center",
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
    backgroundColor: COLORS.borderLight,
    marginTop: SPACING.xxs,
  },
  entryContent: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOW.sm,
  },
  entryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  entryAvatar: {
    width: 28,
    height: 28,
    borderRadius: BORDER_RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
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
    color: COLORS.textPrimary,
  },
  entryDate: {
    fontSize: FONT_SIZE.caption,
    color: COLORS.textTertiary,
    fontWeight: FONT_WEIGHT.medium,
  },
  hoursBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.backgroundSubtle,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xxs,
    borderRadius: BORDER_RADIUS.xs,
    gap: SPACING.xxs,
  },
  hoursText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textTertiary,
  },
  entryDescription: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.regular,
    color: COLORS.textPrimary,
    lineHeight: 21,
  },
  linkedMilestone: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    gap: SPACING.xs,
  },
  linkedMilestoneText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.primary,
    flex: 1,
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
  emptyStreakRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  emptyStreakDot: {
    width: 28,
    height: 28,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.primary,
    opacity: 0.25,
  },
  emptyStreakDotEmpty: {
    width: 28,
    height: 28,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.borderLight,
  },
  emptyStreakLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.textMuted,
  },

  // ── FAB ───────────────────────────────────────────────
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
