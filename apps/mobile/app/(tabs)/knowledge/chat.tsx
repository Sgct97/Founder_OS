/**
 * AI Chat screen — RAG-powered conversation interface with SSE streaming.
 *
 * Ultra-premium chat experience with smooth token-by-token streaming,
 * source citation cards, conversation history, and polished micro-interactions.
 * Designed to rival the best AI chat interfaces.
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
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import {
  BORDER_RADIUS,
  COLORS,
  FONT_SIZE,
  FONT_WEIGHT,
  LAYOUT,
  SHADOW,
  SPACING,
} from "@/constants/theme";
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
  return (
    <View style={styles.sourceCard}>
      <View style={styles.sourceHeader}>
        <Ionicons name="document-text" size={12} color={COLORS.primary} />
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

interface MessageBubbleProps {
  message: MessageResponse;
  isStreaming?: boolean;
}

function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <View
      style={[
        styles.messageBubbleRow,
        isUser ? styles.userBubbleRow : styles.assistantBubbleRow,
      ]}
    >
      {/* Avatar for assistant */}
      {!isUser && (
        <View style={styles.assistantAvatar}>
          <Ionicons name="sparkles" size={14} color={COLORS.primary} />
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
          {isStreaming && <Text style={styles.cursor}>▊</Text>}
        </Text>

        {/* Source Citations */}
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
  return (
    <View style={[styles.messageBubbleRow, styles.assistantBubbleRow]}>
      <View style={styles.assistantAvatar}>
        <Ionicons name="sparkles" size={14} color={COLORS.primary} />
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
  return (
    <View style={[styles.messageBubbleRow, styles.assistantBubbleRow]}>
      <View style={styles.assistantAvatar}>
        <Ionicons name="sparkles" size={14} color={COLORS.primary} />
      </View>
      <View style={[styles.messageBubble, styles.assistantBubble, styles.thinkingBubble]}>
        <ActivityIndicator color={COLORS.primary} size="small" />
        <Text style={styles.thinkingText}>Searching your documents…</Text>
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

function ChatEmptyState() {
  return (
    <View style={styles.chatEmptyState}>
      <View style={styles.chatEmptyIconBg}>
        <Ionicons name="chatbubble-ellipses" size={36} color={COLORS.primary} />
      </View>
      <Text style={styles.chatEmptyTitle}>AI Knowledge Assistant</Text>
      <Text style={styles.chatEmptyBody}>
        Ask anything about your uploaded documents. The AI searches your
        knowledge base and responds with cited sources.
      </Text>
      <View style={styles.chatEmptySuggestions}>
        {[
          "Summarize my project brief",
          "What are the key milestones?",
          "How does the architecture work?",
        ].map((suggestion, index) => (
          <View key={index} style={styles.suggestionChip}>
            <Ionicons
              name="sparkles-outline"
              size={12}
              color={COLORS.textTertiary}
            />
            <Text style={styles.suggestionText}>{suggestion}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Input Bar ───────────────────────────────────────────────

interface InputBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  disabled: boolean;
}

function InputBar({ value, onChangeText, onSend, disabled }: InputBarProps) {
  const canSend = value.trim().length > 0 && !disabled;

  return (
    <View style={styles.inputBar}>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={value}
          onChangeText={onChangeText}
          placeholder="Ask about your documents…"
          placeholderTextColor={COLORS.textMuted}
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
            <ActivityIndicator color={COLORS.white} size={16} />
          ) : (
            <Ionicons
              name="arrow-up"
              size={20}
              color={canSend ? COLORS.white : COLORS.textMuted}
            />
          )}
        </Pressable>
      </View>
    </View>
  );
}

// ── Main Screen ─────────────────────────────────────────────

export default function ChatScreen() {
  const router = useRouter();
  const [activeConversationId, setActiveConversationId] = useState<
    string | undefined
  >(undefined);
  const [inputText, setInputText] = useState("");
  const [showSidebar, setShowSidebar] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const { data: conversations } = useConversations();
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

  // Auto-scroll to bottom when new messages arrive or streaming updates.
  useEffect(() => {
    if (flatListRef.current && (messages?.length || streamedContent)) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages?.length, streamedContent]);

  // Build the combined message list (server messages + streaming message).
  const displayMessages = useMemo(() => {
    const serverMessages = messages ?? [];
    return serverMessages;
  }, [messages]);

  const handleSend = useCallback(async () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;

    // If no active conversation, create one first.
    if (!activeConversationId) {
      try {
        const newConv = await createConversation.mutateAsync({
          title: trimmed.slice(0, 100),
        });
        setActiveConversationId(newConv.id);
        setInputText("");
        // Send the message after a brief delay to let state settle.
        setTimeout(() => {
          sendMessage(trimmed);
        }, 200);
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
  }, [
    inputText,
    activeConversationId,
    createConversation,
    sendMessage,
  ]);

  const handleNewConversation = useCallback(() => {
    setActiveConversationId(undefined);
    setInputText("");
    resetStream();
    setShowSidebar(false);
  }, [resetStream]);

  const handleSelectConversation = useCallback(
    (conversationId: string) => {
      setActiveConversationId(conversationId);
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
    ({ item }: { item: MessageResponse }) => (
      <MessageBubble message={item} />
    ),
    []
  );

  const hasMessages = displayMessages.length > 0 || isStreaming;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {/* Header Actions */}
      <View style={styles.chatHeader}>
        <View style={styles.headerLeftGroup}>
          <Pressable
            style={styles.headerButton}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={22} color={COLORS.primary} />
          </Pressable>
          <Pressable
            style={styles.headerButton}
            onPress={() => setShowSidebar(!showSidebar)}
          >
            <Ionicons
              name={showSidebar ? "close" : "menu"}
              size={22}
              color={COLORS.textSecondary}
            />
          </Pressable>
        </View>
        <Text style={styles.chatHeaderTitle} numberOfLines={1}>
          {activeConversationId
            ? conversations?.find((c) => c.id === activeConversationId)
                ?.title ?? "Chat"
            : "New Conversation"}
        </Text>
        <Pressable style={styles.headerButton} onPress={handleNewConversation}>
          <Ionicons
            name="create-outline"
            size={22}
            color={COLORS.primary}
          />
        </Pressable>
      </View>

      <View style={styles.mainContent}>
        {/* Conversation Sidebar */}
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
        <View style={styles.chatArea}>
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
                    <StreamingBubble
                      content={streamedContent}
                      sources={sources}
                    />
                  )}
                  {isStreaming && !streamedContent && <ThinkingIndicator />}
                  {streamError && (
                    <View style={styles.streamErrorContainer}>
                      <Ionicons
                        name="alert-circle"
                        size={16}
                        color={COLORS.error}
                      />
                      <Text style={styles.streamErrorText}>{streamError}</Text>
                    </View>
                  )}
                </>
              }
            />
          ) : messagesLoading && activeConversationId ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={COLORS.primary} size="large" />
            </View>
          ) : (
            <ChatEmptyState />
          )}

          {/* Input Bar */}
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // ── Chat Header ────────────────────────────────────────
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    backgroundColor: COLORS.surface,
  },
  headerLeftGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  chatHeaderTitle: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
    textAlign: "center",
    marginHorizontal: SPACING.sm,
  },

  // ── Main Content ───────────────────────────────────────
  mainContent: {
    flex: 1,
    flexDirection: "row",
  },

  // ── Sidebar ────────────────────────────────────────────
  sidebar: {
    width: 260,
    backgroundColor: COLORS.surface,
    borderRightWidth: 1,
    borderRightColor: COLORS.borderLight,
    paddingTop: SPACING.md,
  },
  sidebarTitle: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  sidebarScroll: {
    flex: 1,
  },
  sidebarEmpty: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.lg,
    textAlign: "center",
  },
  conversationItem: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderLeftWidth: 3,
    borderLeftColor: "transparent",
  },
  conversationItemActive: {
    backgroundColor: COLORS.primaryMuted,
    borderLeftColor: COLORS.primary,
  },
  conversationItemContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  conversationTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.textPrimary,
    flex: 1,
    marginRight: SPACING.sm,
  },
  conversationTitleActive: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.semibold,
  },
  conversationTime: {
    fontSize: FONT_SIZE.caption,
    color: COLORS.textMuted,
    fontWeight: FONT_WEIGHT.regular,
  },

  // ── Chat Area ──────────────────────────────────────────
  chatArea: {
    flex: 1,
    justifyContent: "flex-end",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  messagesList: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },

  // ── Message Bubbles ────────────────────────────────────
  messageBubbleRow: {
    flexDirection: "row",
    marginBottom: SPACING.md,
    maxWidth: "88%",
  },
  userBubbleRow: {
    alignSelf: "flex-end",
  },
  assistantBubbleRow: {
    alignSelf: "flex-start",
  },
  assistantAvatar: {
    width: 28,
    height: 28,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.sm,
    marginTop: SPACING.xxs,
  },
  messageBubble: {
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    maxWidth: "100%",
    flexShrink: 1,
  },
  userBubble: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: BORDER_RADIUS.xs,
  },
  assistantBubble: {
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: BORDER_RADIUS.xs,
    ...SHADOW.sm,
  },
  messageText: {
    fontSize: FONT_SIZE.sm,
    lineHeight: 22,
  },
  userMessageText: {
    color: COLORS.white,
    fontWeight: FONT_WEIGHT.regular,
  },
  assistantMessageText: {
    color: COLORS.textPrimary,
    fontWeight: FONT_WEIGHT.regular,
  },
  cursor: {
    color: COLORS.primary,
    opacity: 0.7,
  },

  // ── Thinking Indicator ─────────────────────────────────
  thinkingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  thinkingText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textTertiary,
    fontWeight: FONT_WEIGHT.medium,
    fontStyle: "italic",
  },

  // ── Source Citations ───────────────────────────────────
  sourcesContainer: {
    marginTop: SPACING.sm,
  },
  sourcesDivider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginBottom: SPACING.sm,
  },
  sourcesLabel: {
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: SPACING.xs,
  },
  sourcesScroll: {
    gap: SPACING.sm,
  },
  sourceCard: {
    width: 200,
    backgroundColor: COLORS.backgroundSubtle,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.primary,
  },
  sourceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    marginBottom: SPACING.xxs,
  },
  sourceTitle: {
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.primary,
    flex: 1,
  },
  sourceSnippet: {
    fontSize: FONT_SIZE.caption,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },

  // ── Stream Error ───────────────────────────────────────
  streamErrorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.errorMuted,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  streamErrorText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.error,
    fontWeight: FONT_WEIGHT.medium,
    flex: 1,
  },

  // ── Chat Empty State ───────────────────────────────────
  chatEmptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: LAYOUT.screenPaddingH,
  },
  chatEmptyIconBg: {
    width: 72,
    height: 72,
    borderRadius: BORDER_RADIUS.xl,
    backgroundColor: COLORS.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.lg,
  },
  chatEmptyTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
    letterSpacing: -0.3,
  },
  chatEmptyBody: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.regular,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 300,
    marginBottom: SPACING.lg,
  },
  chatEmptySuggestions: {
    alignItems: "center",
    gap: SPACING.sm,
  },
  suggestionChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.full,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    gap: SPACING.xs,
    ...SHADOW.sm,
  },
  suggestionText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.textSecondary,
  },

  // ── Input Bar ──────────────────────────────────────────
  inputBar: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    backgroundColor: COLORS.surface,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: COLORS.backgroundSubtle,
    borderRadius: BORDER_RADIUS.lg,
    paddingLeft: SPACING.md,
    paddingRight: SPACING.xs,
    paddingVertical: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textInput: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.regular,
    color: COLORS.textPrimary,
    maxHeight: 120,
    paddingVertical: SPACING.sm,
    lineHeight: 20,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.textMuted,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: SPACING.xs,
  },
  sendButtonActive: {
    backgroundColor: COLORS.primary,
    ...SHADOW.glow,
  },
});

