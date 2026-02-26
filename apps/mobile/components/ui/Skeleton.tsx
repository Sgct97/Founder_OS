/**
 * Skeleton — premium shimmer loading placeholder.
 *
 * Renders a pulsing placeholder shape to indicate content is loading.
 * Uses native Animated API for smooth, performant animation.
 * Supports arbitrary shapes via width, height, and borderRadius props.
 */

import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, type ViewStyle } from "react-native";

import { BORDER_RADIUS, COLORS } from "@/constants/theme";

interface SkeletonProps {
  /** Width of the skeleton element. */
  width: number | `${number}%`;
  /** Height of the skeleton element. */
  height: number;
  /** Border radius — defaults to BORDER_RADIUS.sm (8). */
  borderRadius?: number;
  /** Additional styles applied to the outer wrapper. */
  style?: ViewStyle;
}

export function Skeleton({
  width,
  height,
  borderRadius = BORDER_RADIUS.sm,
  style,
}: SkeletonProps): React.JSX.Element {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width, height, borderRadius, opacity },
        style,
      ]}
    />
  );
}

// ── Compound skeleton patterns ──────────────────────────────

interface SkeletonRowProps {
  /** Number of skeleton rows to render. */
  count?: number;
  /** Additional styles for the container. */
  style?: ViewStyle;
}

/** A card-shaped skeleton with an icon, title, and subtitle line. */
export function SkeletonCard({
  style,
}: {
  style?: ViewStyle;
}): React.JSX.Element {
  return (
    <View style={[styles.card, style]}>
      <Skeleton width={44} height={44} borderRadius={BORDER_RADIUS.md} />
      <View style={styles.cardContent}>
        <Skeleton width="70%" height={14} />
        <Skeleton
          width="50%"
          height={10}
          style={styles.cardSubtitle}
        />
      </View>
    </View>
  );
}

/** A row of two side-by-side skeleton cards (streak-style). */
export function SkeletonStreakRow(): React.JSX.Element {
  return (
    <View style={styles.streakRow}>
      <View style={styles.streakCard}>
        <View style={styles.streakCardTop}>
          <Skeleton width={32} height={32} borderRadius={BORDER_RADIUS.full} />
          <View style={styles.streakCardInfo}>
            <Skeleton width="60%" height={12} />
            <Skeleton width="40%" height={10} style={{ marginTop: 6 }} />
          </View>
        </View>
        <Skeleton width="45%" height={16} style={{ marginTop: 8 }} />
      </View>
      <View style={styles.streakCard}>
        <View style={styles.streakCardTop}>
          <Skeleton width={32} height={32} borderRadius={BORDER_RADIUS.full} />
          <View style={styles.streakCardInfo}>
            <Skeleton width="60%" height={12} />
            <Skeleton width="40%" height={10} style={{ marginTop: 6 }} />
          </View>
        </View>
        <Skeleton width="45%" height={16} style={{ marginTop: 8 }} />
      </View>
    </View>
  );
}

/** Timeline entry skeleton for the diary screen. */
export function SkeletonTimelineEntry(): React.JSX.Element {
  return (
    <View style={styles.timelineEntry}>
      <View style={styles.timelineDotCol}>
        <Skeleton width={10} height={10} borderRadius={BORDER_RADIUS.full} />
        <View style={styles.timelineLine} />
      </View>
      <View style={styles.timelineContent}>
        <View style={styles.timelineHeader}>
          <Skeleton
            width={28}
            height={28}
            borderRadius={BORDER_RADIUS.full}
          />
          <View style={styles.timelineHeaderText}>
            <Skeleton width="50%" height={12} />
            <Skeleton width="30%" height={10} style={{ marginTop: 4 }} />
          </View>
        </View>
        <Skeleton width="90%" height={12} style={{ marginTop: 10 }} />
        <Skeleton width="60%" height={12} style={{ marginTop: 6 }} />
      </View>
    </View>
  );
}

/** Phase card skeleton for the milestones screen. */
export function SkeletonPhaseCard(): React.JSX.Element {
  return (
    <View style={styles.phaseCard}>
      <View style={styles.phaseHeader}>
        <View style={styles.phaseHeaderLeft}>
          <Skeleton width={18} height={18} borderRadius={4} />
          <Skeleton width="55%" height={14} />
        </View>
        <Skeleton width={40} height={20} borderRadius={BORDER_RADIUS.xs} />
      </View>
      <Skeleton
        width="100%"
        height={4}
        borderRadius={BORDER_RADIUS.full}
        style={{ marginTop: 8, marginBottom: 10 }}
      />
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.milestoneRow}>
          <Skeleton
            width={22}
            height={22}
            borderRadius={BORDER_RADIUS.full}
          />
          <Skeleton width="65%" height={12} />
          <Skeleton
            width={56}
            height={20}
            borderRadius={BORDER_RADIUS.xs}
          />
        </View>
      ))}
    </View>
  );
}

/** Document card skeleton for the knowledge base screen. */
export function SkeletonDocumentCard(): React.JSX.Element {
  return (
    <View style={styles.docCard}>
      <Skeleton width={44} height={44} borderRadius={BORDER_RADIUS.md} />
      <View style={styles.docCardContent}>
        <View style={styles.docCardTitleRow}>
          <Skeleton width="60%" height={14} />
          <Skeleton
            width={56}
            height={20}
            borderRadius={BORDER_RADIUS.full}
          />
        </View>
        <View style={styles.docCardMeta}>
          <Skeleton width={36} height={10} />
          <Skeleton width={48} height={10} />
          <Skeleton width={40} height={10} />
        </View>
      </View>
    </View>
  );
}

/** Stats row skeleton for knowledge base. */
export function SkeletonStatsRow(): React.JSX.Element {
  return (
    <View style={styles.statsRow}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.statCard}>
          <Skeleton width={36} height={28} />
          <Skeleton width={48} height={10} style={{ marginTop: 4 }} />
        </View>
      ))}
    </View>
  );
}

/** Metadata row skeleton for document detail. */
export function SkeletonMetadataCard(): React.JSX.Element {
  return (
    <View style={styles.metaCard}>
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} style={styles.metaRow}>
          <Skeleton width={32} height={32} borderRadius={BORDER_RADIUS.sm} />
          <View style={styles.metaRowContent}>
            <Skeleton width="35%" height={10} />
            <Skeleton width="55%" height={13} style={{ marginTop: 4 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: COLORS.borderLight,
  },

  // Card skeleton
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: 16,
    marginBottom: 8,
  },
  cardContent: {
    flex: 1,
    marginLeft: 16,
    gap: 0,
  },
  cardSubtitle: {
    marginTop: 8,
  },

  // Streak row
  streakRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 24,
  },
  streakCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.borderLight,
  },
  streakCardTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  streakCardInfo: {
    flex: 1,
    marginLeft: 8,
  },

  // Timeline entry
  timelineEntry: {
    flexDirection: "row",
    marginBottom: 4,
  },
  timelineDotCol: {
    alignItems: "center",
    width: 20,
    marginRight: 8,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: COLORS.borderLight,
    marginTop: 2,
  },
  timelineContent: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: 16,
    marginBottom: 8,
  },
  timelineHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  timelineHeaderText: {
    flex: 1,
    marginLeft: 8,
  },

  // Phase card
  phaseCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: 16,
    marginBottom: 16,
  },
  phaseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  phaseHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  milestoneRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    gap: 8,
  },

  // Document card
  docCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: 16,
    marginBottom: 8,
  },
  docCardContent: {
    flex: 1,
    marginLeft: 16,
  },
  docCardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  docCardMeta: {
    flexDirection: "row",
    gap: 8,
  },

  // Stats row
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: 16,
    alignItems: "center",
  },

  // Metadata card
  metaCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: 16,
    marginBottom: 24,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 16,
  },
  metaRowContent: {
    flex: 1,
  },
});

