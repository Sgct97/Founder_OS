/**
 * Feature Requests screen — workspace members submit and vote on ideas.
 *
 * Premium card-based UI with upvote interaction, status badges,
 * and a slide-up creation modal. Sorted by vote count.
 */

import React, { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
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

import {
  BORDER_RADIUS,
  COLORS,
  FONT_SIZE,
  FONT_WEIGHT,
  LAYOUT,
  SHADOW,
  SPACING,
} from "@/constants/theme";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  useFeatureRequests,
  useCreateFeatureRequest,
  useDeleteFeatureRequest,
  useToggleVote,
} from "@/hooks/use-feature-requests";
import type { FeatureRequest, FeatureRequestStatus } from "@/types/feature-requests";

// ── Status config ────────────────────────────────────────────

const STATUS_CONFIG: Record<
  FeatureRequestStatus,
  { label: string; color: string; bg: string; icon: string }
> = {
  open: {
    label: "Open",
    color: COLORS.info,
    bg: COLORS.infoMuted,
    icon: "chatbubble-ellipses-outline",
  },
  under_review: {
    label: "Under Review",
    color: COLORS.warning,
    bg: COLORS.warningMuted,
    icon: "eye-outline",
  },
  planned: {
    label: "Planned",
    color: COLORS.primary,
    bg: COLORS.primaryMuted,
    icon: "calendar-outline",
  },
  in_progress: {
    label: "In Progress",
    color: "#a855f7",
    bg: "rgba(168, 85, 247, 0.10)",
    icon: "hammer-outline",
  },
  completed: {
    label: "Completed",
    color: COLORS.success,
    bg: COLORS.successMuted,
    icon: "checkmark-circle-outline",
  },
  declined: {
    label: "Declined",
    color: COLORS.textTertiary,
    bg: "rgba(142, 153, 164, 0.10)",
    icon: "close-circle-outline",
  },
};

// ── Helpers ──────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// ── Feature Card ─────────────────────────────────────────────

function FeatureCard({
  item,
  onVote,
  onDelete,
  isVoting,
}: {
  item: FeatureRequest;
  onVote: (id: string) => void;
  onDelete: (id: string) => void;
  isVoting: boolean;
}) {
  const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.open;

  return (
    <View style={[styles.card, SHADOW.md]}>
      <View style={styles.cardRow}>
        {/* Vote column */}
        <Pressable
          style={[
            styles.voteCol,
            item.has_voted && styles.voteColActive,
          ]}
          onPress={() => onVote(item.id)}
          disabled={isVoting}
        >
          <Ionicons
            name={item.has_voted ? "chevron-up" : "chevron-up-outline"}
            size={20}
            color={item.has_voted ? COLORS.primary : COLORS.textTertiary}
          />
          <Text
            style={[
              styles.voteCount,
              item.has_voted && styles.voteCountActive,
            ]}
          >
            {item.vote_count}
          </Text>
        </Pressable>

        {/* Content */}
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
              <Ionicons
                name={cfg.icon as any}
                size={12}
                color={cfg.color}
              />
              <Text style={[styles.statusText, { color: cfg.color }]}>
                {cfg.label}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                if (Platform.OS === "web") {
                  if (confirm("Delete this feature request?")) {
                    onDelete(item.id);
                  }
                } else {
                  Alert.alert(
                    "Delete",
                    "Delete this feature request?",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => onDelete(item.id),
                      },
                    ]
                  );
                }
              }}
              hitSlop={8}
            >
              <Ionicons
                name="trash-outline"
                size={16}
                color={COLORS.textMuted}
              />
            </Pressable>
          </View>

          <Text style={styles.cardTitle}>{item.title}</Text>

          {item.description ? (
            <Text style={styles.cardDesc} numberOfLines={3}>
              {item.description}
            </Text>
          ) : null}

          <View style={styles.cardMeta}>
            <Ionicons
              name="person-outline"
              size={12}
              color={COLORS.textTertiary}
            />
            <Text style={styles.metaText}>
              {item.author_name || item.author_email || "Unknown"}
            </Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaText}>{timeAgo(item.created_at)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Skeleton loader ──────────────────────────────────────────

function SkeletonCard() {
  return (
    <View style={[styles.card, SHADOW.sm, { opacity: 0.6 }]}>
      <View style={styles.cardRow}>
        <View style={styles.voteCol}>
          <Skeleton width={20} height={20} borderRadius={4} />
          <Skeleton width={24} height={16} borderRadius={4} />
        </View>
        <View style={styles.cardContent}>
          <Skeleton width={80} height={20} borderRadius={10} />
          <Skeleton
            width="90%"
            height={18}
            borderRadius={4}
            style={{ marginTop: 10 }}
          />
          <Skeleton
            width="60%"
            height={14}
            borderRadius={4}
            style={{ marginTop: 8 }}
          />
          <Skeleton
            width={120}
            height={12}
            borderRadius={4}
            style={{ marginTop: 12 }}
          />
        </View>
      </View>
    </View>
  );
}

// ── Empty state ──────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIconWrap}>
        <Ionicons
          name="bulb-outline"
          size={48}
          color={COLORS.primary}
        />
      </View>
      <Text style={styles.emptyTitle}>No feature requests yet</Text>
      <Text style={styles.emptySubtitle}>
        Be the first to suggest an idea for the team
      </Text>
      <Pressable style={[styles.emptyBtn, SHADOW.glow]} onPress={onAdd}>
        <Ionicons name="add" size={18} color={COLORS.white} />
        <Text style={styles.emptyBtnText}>Submit Request</Text>
      </Pressable>
    </View>
  );
}

// ── Main screen ──────────────────────────────────────────────

export default function FeaturesScreen() {
  const { data: requests, isLoading, isError, refetch } = useFeatureRequests();
  const createMutation = useCreateFeatureRequest();
  const deleteMutation = useDeleteFeatureRequest();
  const voteMutation = useToggleVote();

  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = useCallback(() => {
    if (!title.trim()) return;
    createMutation.mutate(
      { title: title.trim(), description: description.trim() || undefined },
      {
        onSuccess: () => {
          setTitle("");
          setDescription("");
          setModalVisible(false);
        },
      }
    );
  }, [title, description, createMutation]);

  const handleVote = useCallback(
    (id: string) => voteMutation.mutate(id),
    [voteMutation]
  );

  const handleDelete = useCallback(
    (id: string) => deleteMutation.mutate(id),
    [deleteMutation]
  );

  // ── Loading ──
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.headerBar}>
          <Text style={styles.headerTitle}>Feature Requests</Text>
        </View>
        <View style={styles.list}>
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </View>
      </View>
    );
  }

  // ── Error ──
  if (isError) {
    return (
      <View style={styles.container}>
        <View style={styles.headerBar}>
          <Text style={styles.headerTitle}>Feature Requests</Text>
        </View>
        <View style={styles.center}>
          <Ionicons
            name="warning-outline"
            size={40}
            color={COLORS.error}
          />
          <Text style={styles.errorText}>Failed to load feature requests</Text>
          <Pressable style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const sortedRequests = requests || [];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerBar}>
        <View>
          <Text style={styles.headerTitle}>Feature Requests</Text>
          <Text style={styles.headerSubtitle}>
            {sortedRequests.length} request{sortedRequests.length !== 1 ? "s" : ""}
          </Text>
        </View>
        <Pressable
          style={[styles.addBtn, SHADOW.glow]}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add" size={20} color={COLORS.white} />
          <Text style={styles.addBtnText}>New</Text>
        </Pressable>
      </View>

      {/* List */}
      {sortedRequests.length === 0 ? (
        <EmptyState onAdd={() => setModalVisible(true)} />
      ) : (
        <FlatList
          data={sortedRequests}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <FeatureCard
              item={item}
              onVote={handleVote}
              onDelete={handleDelete}
              isVoting={voteMutation.isPending}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Creation modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={[styles.modalContent, SHADOW.lg]}>
            <View style={styles.modalHandle} />

            <Text style={styles.modalTitle}>New Feature Request</Text>
            <Text style={styles.modalSubtitle}>
              Describe a feature you'd like to see built
            </Text>

            <Text style={styles.inputLabel}>Title</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Dark mode, Notifications, Export..."
              placeholderTextColor={COLORS.textMuted}
              value={title}
              onChangeText={setTitle}
              maxLength={255}
            />

            <Text style={styles.inputLabel}>Description (optional)</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="Add more detail about what you'd like and why..."
              placeholderTextColor={COLORS.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              maxLength={5000}
              textAlignVertical="top"
            />

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => {
                  setTitle("");
                  setDescription("");
                  setModalVisible(false);
                }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.submitBtn,
                  !title.trim() && styles.submitBtnDisabled,
                  SHADOW.glow,
                ]}
                onPress={handleSubmit}
                disabled={!title.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <Text style={styles.submitText}>Submitting...</Text>
                ) : (
                  <>
                    <Ionicons name="rocket-outline" size={16} color={COLORS.white} />
                    <Text style={styles.submitText}>Submit</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: LAYOUT.screenPaddingH,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.background,
  },
  headerTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textTertiary,
    marginTop: 2,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    gap: 4,
  },
  addBtnText: {
    color: COLORS.white,
    fontWeight: FONT_WEIGHT.semibold,
    fontSize: FONT_SIZE.sm,
  },
  list: {
    paddingHorizontal: LAYOUT.screenPaddingH,
    paddingBottom: SPACING.xxxl,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    overflow: "hidden",
  },
  cardRow: {
    flexDirection: "row",
  },
  voteCol: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRightWidth: 1,
    borderRightColor: COLORS.borderLight,
    minWidth: 56,
    gap: 2,
  },
  voteColActive: {
    backgroundColor: COLORS.primaryMuted,
  },
  voteCount: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textTertiary,
  },
  voteCountActive: {
    color: COLORS.primary,
  },
  cardContent: {
    flex: 1,
    padding: SPACING.md,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
    gap: 4,
  },
  statusText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
  },
  cardTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
    lineHeight: FONT_SIZE.md * 1.4,
  },
  cardDesc: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    lineHeight: FONT_SIZE.sm * 1.5,
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: SPACING.sm,
    gap: 4,
  },
  metaText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textTertiary,
  },
  metaDot: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },

  // Empty state
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  emptySubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textTertiary,
    textAlign: "center",
    marginBottom: SPACING.lg,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
    borderRadius: BORDER_RADIUS.full,
    gap: 6,
  },
  emptyBtnText: {
    color: COLORS.white,
    fontWeight: FONT_WEIGHT.semibold,
    fontSize: FONT_SIZE.md,
  },

  // Error / Center
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.md,
  },
  errorText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
  },
  retryBtn: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primaryMuted,
  },
  retryText: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.semibold,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: COLORS.surfaceOverlay,
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl,
    paddingHorizontal: LAYOUT.screenPaddingH,
    paddingBottom: SPACING.xxxl,
    paddingTop: SPACING.md,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.borderLight,
    alignSelf: "center",
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textTertiary,
    marginBottom: SPACING.lg,
  },
  inputLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: SPACING.xs,
    marginTop: SPACING.sm,
  },
  input: {
    backgroundColor: COLORS.backgroundSubtle,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
  },
  inputMultiline: {
    minHeight: 100,
    paddingTop: SPACING.sm + 2,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  cancelBtn: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
    borderRadius: BORDER_RADIUS.full,
  },
  cancelText: {
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHT.medium,
    fontSize: FONT_SIZE.md,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
    borderRadius: BORDER_RADIUS.full,
    gap: 6,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: COLORS.white,
    fontWeight: FONT_WEIGHT.semibold,
    fontSize: FONT_SIZE.md,
  },
});
