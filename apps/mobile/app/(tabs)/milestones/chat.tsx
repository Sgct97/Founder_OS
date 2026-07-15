/**
 * Milestone AI Chat — context-aware conversation scoped to a specific milestone.
 *
 * Reuses the same chat patterns (SSE streaming, source citations, message bubbles)
 * from the knowledge base chat but passes milestone_id so the backend builds a
 * dynamic system prompt with the milestone's details + full project roadmap.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

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
import { useTourRef } from "@/components/tour/TourProvider";
import {
  useConversationMessages,
  useConversations,
  useCreateConversation,
  useDeleteConversation,
  useStreamingChat,
} from "@/hooks/use-chat";
import type {
  ConversationResponse,
  MessageResponse,
  SourceCitation,
} from "@/types/chat";

// ── Helpers ──────────────────────────────────────────────────

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Source Citation Card ────────────────────────────────────

function SourceCard({ source }: { source: SourceCitation }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.sourceCard}>
      <View style={styles.sourceHeader}>
        <Ionicons name="document-text" size={12} color={colors.primary} />
        <Text style={styles.sourceTitle} numberOfLines={1}>
          {source.document_title}
        </Text>
      </View>
      <Text style={styles.sourceSnippet} numberOfLines={2}>
        {source.snippet}
      </Text>
    </View>
  );
}

// ── Message Bubble ──────────────────────────────────────────

function MessageBubble({ message }: { message: MessageResponse }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const isUser = message.role === "user";

  return (
    <View
      style={[
        styles.messageBubbleRow,
        isUser ? styles.userBubbleRow : styles.assistantBubbleRow,
      ]}
    >
      {!isUser && (
        <View style={styles.assistantAvatar}>
          <Ionicons name="sparkles" size={14} color={colors.primary} />
        </View>
      )}

      <View
        style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.assistantBubble,
        ]}
      >
        <Text
          style={[
            styles.messageText,
            isUser ? styles.userMessageText : styles.assistantMessageText,
          ]}
        >
          {message.content}
        </Text>

        {message.sources && message.sources.length > 0 && (
          <View style={styles.sourcesContainer}>
            <View style={styles.sourcesDivider} />
            <Text style={styles.sourcesLabel}>Sources</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.sourcesScroll}
            >
              {message.sources.map((source, index) => (
                <SourceCard key={`${source.chunk_id}-${index}`} source={source} />
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Streaming Bubble ────────────────────────────────────────

function StreamingBubble({
  content,
  sources,
}: {
  content: string;
  sources: SourceCitation[];
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  return (
    <View style={[styles.messageBubbleRow, styles.assistantBubbleRow]}>
      <View style={styles.assistantAvatar}>
        <Ionicons name="sparkles" size={14} color={colors.primary} />
      </View>
      <View style={[styles.messageBubble, styles.assistantBubble]}>
        <Text style={[styles.messageText, styles.assistantMessageText]}>
          {content}
          <Text style={styles.cursor}>▊</Text>
        </Text>

        {sources.length > 0 && (
          <View style={styles.sourcesContainer}>
            <View style={styles.sourcesDivider} />
            <Text style={styles.sourcesLabel}>Sources</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.sourcesScroll}
            >
              {sources.map((source, index) => (
                <SourceCard key={`${source.chunk_id}-${index}`} source={source} />
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Thinking Indicator ──────────────────────────────────────

function ThinkingIndicator() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  return (
    <View style={[styles.messageBubbleRow, styles.assistantBubbleRow]}>
      <View style={styles.assistantAvatar}>
        <Ionicons name="sparkles" size={14} color={colors.primary} />
      </View>
      <View style={[styles.messageBubble, styles.assistantBubble, styles.thinkingBubble]}>
        <ActivityIndicator color={colors.primary} size="small" />
        <Text style={styles.thinkingText}>Analyzing milestone context…</Text>
      </View>
    </View>
  );
}

// ── Conversation List Item ──────────────────────────────────

function ConversationItem({
  conversation,
  isActive,
  onPress,
  onDelete,
}: {
  conversation: ConversationResponse;
  isActive: boolean;
  onPress: () => void;
  onDelete: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const handleLongPress = useCallback(() => {
    Alert.alert("Conversation", undefined, [
      { text: "Delete", style: "destructive", onPress: onDelete },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [onDelete]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.conversationItem,
        isActive && styles.conversationItemActive,
        pressed && { opacity: 0.7 },
      ]}
      onPress={onPress}
      onLongPress={handleLongPress}
      delayLongPress={500}
    >
      <View style={styles.conversationItemContent}>
        <Text
          style={[
            styles.conversationTitle,
            isActive && styles.conversationTitleActive,
          ]}
          numberOfLines={1}
        >
          {conversation.title}
        </Text>
        <Text style={styles.conversationTime}>
          {formatRelativeTime(conversation.updated_at)}
        </Text>
      </View>
    </Pressable>
  );
}

// ── Chat Empty State ────────────────────────────────────────

function MilestoneChatEmpty({ milestoneTitle }: { milestoneTitle: string }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.chatEmptyState}>
      <View style={styles.chatEmptyIconBg}>
        <Ionicons name="sparkles" size={36} color={colors.primary} />
      </View>
      <Text style={styles.chatEmptyTitle}>Milestone AI Advisor</Text>
      <Text style={styles.chatEmptyBody}>
        Ask anything about{" "}
        <Text style={styles.chatEmptyHighlight}>{milestoneTitle}</Text>. The AI
        knows your full roadmap and can help with implementation, blockers, and
        strategy.
      </Text>
      <View style={styles.chatEmptySuggestions}>
        {[
          "What's the best approach for this?",
          "What are the blockers?",
          "How does this fit the roadmap?",
        ].map((suggestion, index) => (
          <View key={index} style={styles.suggestionChip}>
            <Ionicons
              name="sparkles-outline"
              size={12}
              color={colors.textTertiary}
            />
            <Text style={styles.suggestionText}>{suggestion}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Input Bar ───────────────────────────────────────────────

function InputBar({
  value,
  onChangeText,
  onSend,
  disabled,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  disabled: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const canSend = value.trim().length > 0 && !disabled;

  return (
    <View style={styles.inputBar}>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={value}
          onChangeText={onChangeText}
          placeholder="Ask about this milestone…"
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={10000}
          editable={!disabled}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={canSend ? onSend : undefined}
        />
        <Pressable
          style={({ pressed }) => [
            styles.sendButton,
            canSend && styles.sendButtonActive,
            pressed && canSend && { opacity: 0.7 },
          ]}
          onPress={canSend ? onSend : undefined}
          disabled={!canSend}
        >
          {disabled ? (
            <ActivityIndicator color={colors.white} size={16} />
          ) : (
            <Ionicons
              name="arrow-up"
              size={20}
              color={canSend ? colors.white : colors.textMuted}
            />
          )}
        </Pressable>
      </View>
    </View>
  );
}

// ── Main Screen ─────────────────────────────────────────────

export default function MilestoneChatScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    milestoneId: string;
    milestoneTitle: string;
    phaseName: string;
  }>();

  const milestoneId = params.milestoneId;
  const milestoneTitle = params.milestoneTitle ?? "Milestone";
  const phaseName = params.phaseName ?? "";
  const chatDemoRef = useTourRef("milestones-chat-demo");

  const [activeConversationId, setActiveConversationId] = useState<
    string | undefined
  >(undefined);
  const [isNewChat, setIsNewChat] = useState(false);
  const [inputText, setInputText] = useState("");
  const [showSidebar, setShowSidebar] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const { data: conversations } = useConversations(milestoneId);
  const createConversation = useCreateConversation();
  const deleteConversation = useDeleteConversation();
  const { data: messages, isLoading: messagesLoading } =
    useConversationMessages(activeConversationId);

  const {
    isStreaming,
    streamedContent,
    sources,
    error: streamError,
    sendMessage,
    resetStream,
  } = useStreamingChat(activeConversationId);

  // Auto-select the most recent milestone conversation on mount (not when user clicked "new chat").
  useEffect(() => {
    if (!activeConversationId && !isNewChat && conversations && conversations.length > 0) {
      setActiveConversationId(conversations[0]!.id);
    }
  }, [conversations, activeConversationId, isNewChat]);

  // Auto-scroll on new messages / streaming.
  useEffect(() => {
    if (flatListRef.current && (messages?.length || streamedContent)) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages?.length, streamedContent]);

  const displayMessages = useMemo(() => messages ?? [], [messages]);

  const handleSend = useCallback(async () => {
    const trimmed = inputText.trim();
    if (!trimmed || !milestoneId) return;

    if (!activeConversationId) {
      try {
        const newConv = await createConversation.mutateAsync({
          title: trimmed.slice(0, 100),
          milestone_id: milestoneId,
        });
        setActiveConversationId(newConv.id);
        setIsNewChat(false);
        setInputText("");
        await sendMessage(trimmed, newConv.id);
        return;
      } catch (err) {
        Alert.alert(
          "Error",
          err instanceof Error ? err.message : "Failed to create conversation."
        );
        return;
      }
    }

    setInputText("");
    await sendMessage(trimmed);
  }, [inputText, milestoneId, activeConversationId, createConversation, sendMessage]);

  const handleNewConversation = useCallback(() => {
    setActiveConversationId(undefined);
    setIsNewChat(true);
    setInputText("");
    resetStream();
    setShowSidebar(false);
  }, [resetStream]);

  const handleSelectConversation = useCallback(
    (conversationId: string) => {
      setActiveConversationId(conversationId);
      setIsNewChat(false);
      resetStream();
      setShowSidebar(false);
    },
    [resetStream]
  );

  const handleDeleteConversation = useCallback(
    (conversationId: string) => {
      Alert.alert(
        "Delete Conversation",
        "This will permanently delete this conversation.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              await deleteConversation.mutateAsync(conversationId);
              if (activeConversationId === conversationId) {
                setActiveConversationId(undefined);
                resetStream();
              }
            },
          },
        ]
      );
    },
    [activeConversationId, deleteConversation, resetStream]
  );

  const renderMessage = useCallback(
    ({ item }: { item: MessageResponse }) => <MessageBubble message={item} />,
    []
  );

  const hasMessages = displayMessages.length > 0 || isStreaming;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {/* Header */}
      <View style={styles.chatHeader}>
        <View style={styles.headerLeftGroup}>
          <Pressable
            style={styles.headerButton}
            onPress={() =>
              router.replace({
                pathname: "/(tabs)/milestones",
                params: {
                  reopenMilestoneId: milestoneId,
                  reopenPhaseName: phaseName,
                },
              })
            }
          >
            <Ionicons name="chevron-back" size={22} color={colors.primary} />
          </Pressable>
          <Pressable
            style={styles.headerButton}
            onPress={() => setShowSidebar(!showSidebar)}
          >
            <Ionicons
              name={showSidebar ? "close" : "menu"}
              size={22}
              color={colors.textSecondary}
            />
          </Pressable>
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.chatHeaderTitle} numberOfLines={1}>
            {milestoneTitle}
          </Text>
          {phaseName ? (
            <Text style={styles.chatHeaderSubtitle} numberOfLines={1}>
              {phaseName}
            </Text>
          ) : null}
        </View>
        <Pressable style={styles.headerButton} onPress={handleNewConversation}>
          <Ionicons name="create-outline" size={22} color={colors.primary} />
        </Pressable>
      </View>

      <View style={styles.mainContent}>
        {/* Sidebar */}
        {showSidebar && (
          <View style={styles.sidebar}>
            <Text style={styles.sidebarTitle}>Conversations</Text>
            <ScrollView
              style={styles.sidebarScroll}
              showsVerticalScrollIndicator={false}
            >
              {conversations && conversations.length > 0 ? (
                conversations.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    conversation={conv}
                    isActive={conv.id === activeConversationId}
                    onPress={() => handleSelectConversation(conv.id)}
                    onDelete={() => handleDeleteConversation(conv.id)}
                  />
                ))
              ) : (
                <Text style={styles.sidebarEmpty}>No conversations yet</Text>
              )}
            </ScrollView>
          </View>
        )}

        {/* Chat Area */}
        <View ref={chatDemoRef} collapsable={false} style={styles.chatArea}>
          {hasMessages ? (
            <FlatList
              ref={flatListRef}
              data={displayMessages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.messagesList}
              showsVerticalScrollIndicator={false}
              ListFooterComponent={
                <>
                  {isStreaming && streamedContent && (
                    <StreamingBubble content={streamedContent} sources={sources} />
                  )}
                  {isStreaming && !streamedContent && <ThinkingIndicator />}
                  {streamError && (
                    <View style={styles.streamErrorContainer}>
                      <Ionicons name="alert-circle" size={16} color={colors.error} />
                      <Text style={styles.streamErrorText}>{streamError}</Text>
                    </View>
                  )}
                </>
              }
            />
          ) : messagesLoading && activeConversationId ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : (
            <MilestoneChatEmpty milestoneTitle={milestoneTitle} />
          )}

          <InputBar
            value={inputText}
            onChangeText={setInputText}
            onSend={handleSend}
            disabled={isStreaming || createConversation.isPending}
          />
        </View>
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

    chatHeader: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
      backgroundColor: colors.surface,
    },
    headerLeftGroup: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
    },
    headerButton: {
      width: 36,
      height: 36,
      borderRadius: BORDER_RADIUS.sm,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    headerCenter: {
      flex: 1,
      alignItems: "center" as const,
      marginHorizontal: SPACING.sm,
    },
    chatHeaderTitle: {
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.semibold,
      color: colors.textPrimary,
      textAlign: "center" as const,
    },
    chatHeaderSubtitle: {
      fontSize: FONT_SIZE.caption,
      color: colors.textTertiary,
      marginTop: 1,
    },

    mainContent: {
      flex: 1,
      flexDirection: "row" as const,
    },

    sidebar: {
      width: 260,
      backgroundColor: colors.surface,
      borderRightWidth: 1,
      borderRightColor: colors.borderLight,
      paddingTop: SPACING.md,
    },
    sidebarTitle: {
      fontSize: FONT_SIZE.xs,
      fontWeight: FONT_WEIGHT.semibold,
      color: colors.textTertiary,
      textTransform: "uppercase" as const,
      letterSpacing: 0.8,
      paddingHorizontal: SPACING.md,
      marginBottom: SPACING.sm,
    },
    sidebarScroll: {
      flex: 1,
    },
    sidebarEmpty: {
      fontSize: FONT_SIZE.sm,
      color: colors.textMuted,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.lg,
      textAlign: "center" as const,
    },
    conversationItem: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm + 2,
      borderLeftWidth: 3,
      borderLeftColor: "transparent",
    },
    conversationItemActive: {
      backgroundColor: colors.primaryMuted,
      borderLeftColor: colors.primary,
    },
    conversationItemContent: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
    },
    conversationTitle: {
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.medium,
      color: colors.textPrimary,
      flex: 1,
      marginRight: SPACING.sm,
    },
    conversationTitleActive: {
      color: colors.primary,
      fontWeight: FONT_WEIGHT.semibold,
    },
    conversationTime: {
      fontSize: FONT_SIZE.caption,
      color: colors.textMuted,
      fontWeight: FONT_WEIGHT.regular,
    },

    chatArea: {
      flex: 1,
      justifyContent: "flex-end" as const,
    },
    loadingContainer: {
      flex: 1,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    messagesList: {
      paddingHorizontal: SPACING.md,
      paddingTop: SPACING.md,
      paddingBottom: SPACING.sm,
    },

    messageBubbleRow: {
      flexDirection: "row" as const,
      marginBottom: SPACING.md,
      maxWidth: "88%" as const,
    },
    userBubbleRow: {
      alignSelf: "flex-end" as const,
    },
    assistantBubbleRow: {
      alignSelf: "flex-start" as const,
    },
    assistantAvatar: {
      width: 28,
      height: 28,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: colors.primaryMuted,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginRight: SPACING.sm,
      marginTop: SPACING.xxs,
    },
    messageBubble: {
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.md,
      maxWidth: "100%" as const,
      flexShrink: 1,
    },
    userBubble: {
      backgroundColor: colors.primary,
      borderBottomRightRadius: BORDER_RADIUS.xs,
    },
    assistantBubble: {
      backgroundColor: colors.surface,
      borderBottomLeftRadius: BORDER_RADIUS.xs,
      ...SHADOW.sm,
    },
    messageText: {
      fontSize: FONT_SIZE.sm,
      lineHeight: 22,
    },
    userMessageText: {
      color: colors.white,
      fontWeight: FONT_WEIGHT.regular,
    },
    assistantMessageText: {
      color: colors.textPrimary,
      fontWeight: FONT_WEIGHT.regular,
    },
    cursor: {
      color: colors.primary,
      opacity: 0.7,
    },

    thinkingBubble: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: SPACING.sm,
    },
    thinkingText: {
      fontSize: FONT_SIZE.sm,
      color: colors.textTertiary,
      fontWeight: FONT_WEIGHT.medium,
      fontStyle: "italic" as const,
    },

    sourcesContainer: {
      marginTop: SPACING.sm,
    },
    sourcesDivider: {
      height: 1,
      backgroundColor: colors.borderLight,
      marginBottom: SPACING.sm,
    },
    sourcesLabel: {
      fontSize: FONT_SIZE.caption,
      fontWeight: FONT_WEIGHT.semibold,
      color: colors.textTertiary,
      textTransform: "uppercase" as const,
      letterSpacing: 0.5,
      marginBottom: SPACING.xs,
    },
    sourcesScroll: {
      gap: SPACING.sm,
    },
    sourceCard: {
      width: 200,
      backgroundColor: colors.backgroundSubtle,
      borderRadius: BORDER_RADIUS.md,
      padding: SPACING.sm,
      borderLeftWidth: 2,
      borderLeftColor: colors.primary,
    },
    sourceHeader: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: SPACING.xs,
      marginBottom: SPACING.xxs,
    },
    sourceTitle: {
      fontSize: FONT_SIZE.caption,
      fontWeight: FONT_WEIGHT.semibold,
      color: colors.primary,
      flex: 1,
    },
    sourceSnippet: {
      fontSize: FONT_SIZE.caption,
      color: colors.textSecondary,
      lineHeight: 16,
    },

    streamErrorContainer: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: colors.errorMuted,
      borderRadius: BORDER_RADIUS.md,
      padding: SPACING.sm,
      gap: SPACING.xs,
      marginBottom: SPACING.md,
    },
    streamErrorText: {
      fontSize: FONT_SIZE.sm,
      color: colors.error,
      fontWeight: FONT_WEIGHT.medium,
      flex: 1,
    },

    chatEmptyState: {
      flex: 1,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      paddingHorizontal: LAYOUT.screenPaddingH,
    },
    chatEmptyIconBg: {
      width: 72,
      height: 72,
      borderRadius: BORDER_RADIUS.xl,
      backgroundColor: colors.primaryMuted,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginBottom: SPACING.lg,
    },
    chatEmptyTitle: {
      fontSize: FONT_SIZE.xl,
      fontWeight: FONT_WEIGHT.bold,
      color: colors.textPrimary,
      marginBottom: SPACING.sm,
      letterSpacing: -0.3,
    },
    chatEmptyBody: {
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.regular,
      color: colors.textSecondary,
      textAlign: "center" as const,
      lineHeight: 22,
      maxWidth: 320,
      marginBottom: SPACING.lg,
    },
    chatEmptyHighlight: {
      fontWeight: FONT_WEIGHT.semibold,
      color: colors.primary,
    },
    chatEmptySuggestions: {
      alignItems: "center" as const,
      gap: SPACING.sm,
    },
    suggestionChip: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: colors.surface,
      borderRadius: BORDER_RADIUS.full,
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
      gap: SPACING.xs,
      ...SHADOW.sm,
    },
    suggestionText: {
      fontSize: FONT_SIZE.xs,
      fontWeight: FONT_WEIGHT.medium,
      color: colors.textSecondary,
    },

    inputBar: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
      backgroundColor: colors.surface,
    },
    inputContainer: {
      flexDirection: "row" as const,
      alignItems: "flex-end" as const,
      backgroundColor: colors.backgroundSubtle,
      borderRadius: BORDER_RADIUS.lg,
      paddingLeft: SPACING.md,
      paddingRight: SPACING.xs,
      paddingVertical: SPACING.xs,
      borderWidth: 1,
      borderColor: colors.border,
    },
    textInput: {
      flex: 1,
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.regular,
      color: colors.textPrimary,
      maxHeight: 120,
      paddingVertical: SPACING.sm,
      lineHeight: 20,
    },
    sendButton: {
      width: 36,
      height: 36,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: colors.textMuted,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginLeft: SPACING.xs,
    },
    sendButtonActive: {
      backgroundColor: colors.primary,
      ...SHADOW.glow,
    },
  };
}
