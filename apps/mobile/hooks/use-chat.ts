/**
 * React Query hooks for chat / RAG conversations.
 *
 * Provides data fetching, mutations, cache invalidation,
 * and streaming support for the chat interface.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";

import * as chatService from "@/services/chat";
import type {
  ConversationCreatePayload,
  ConversationResponse,
  MessageResponse,
  SourceCitation,
  SSEChatEvent,
} from "@/types/chat";

const CONVERSATIONS_KEY = ["conversations"] as const;
const REFETCH_INTERVAL_MS = 10000;

/** Fetch all conversations for the workspace. */
export function useConversations() {
  return useQuery<ConversationResponse[]>({
    queryKey: CONVERSATIONS_KEY,
    queryFn: chatService.listConversations,
    refetchInterval: REFETCH_INTERVAL_MS,
  });
}

/** Fetch messages for a specific conversation. */
export function useConversationMessages(conversationId: string | undefined) {
  return useQuery<MessageResponse[]>({
    queryKey: [...CONVERSATIONS_KEY, conversationId, "messages"],
    queryFn: () => chatService.getConversationMessages(conversationId!),
    enabled: !!conversationId,
  });
}

/** Create a new conversation. */
export function useCreateConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ConversationCreatePayload) =>
      chatService.createConversation(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
  });
}

/** Delete a conversation. */
export function useDeleteConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) =>
      chatService.deleteConversation(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
  });
}

// ── Streaming Hook ──────────────────────────────────────────

interface StreamingState {
  /** Whether we're currently streaming a response. */
  isStreaming: boolean;
  /** Accumulated AI response text so far. */
  streamedContent: string;
  /** Source citations returned after streaming completes. */
  sources: SourceCitation[];
  /** Error message if something went wrong. */
  error: string | null;
}

/**
 * Hook for sending a message and streaming the AI response.
 *
 * Returns streaming state + a `sendMessage` function.
 * After streaming completes, the conversation messages cache is invalidated
 * so the full history refreshes from the server.
 */
export function useStreamingChat(conversationId: string | undefined) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<StreamingState>({
    isStreaming: false,
    streamedContent: "",
    sources: [],
    error: null,
  });

  // Ref to accumulate content during streaming.
  const contentRef = useRef("");

  const sendMessage = useCallback(
    async (content: string, conversationIdOverride?: string) => {
      const targetId = conversationIdOverride ?? conversationId;
      if (!targetId || state.isStreaming) return;

      contentRef.current = "";
      setState({
        isStreaming: true,
        streamedContent: "",
        sources: [],
        error: null,
      });

      try {
        await chatService.sendMessageStreaming(
          targetId,
          content,
          (event: SSEChatEvent) => {
            switch (event.type) {
              case "content":
                contentRef.current += event.content;
                setState((prev) => ({
                  ...prev,
                  streamedContent: contentRef.current,
                }));
                break;

              case "sources":
                setState((prev) => ({
                  ...prev,
                  sources: event.sources,
                }));
                break;

              case "done":
                setState((prev) => ({
                  ...prev,
                  isStreaming: false,
                }));
                // Invalidate messages cache so the full response is fetched.
                queryClient.invalidateQueries({
                  queryKey: [
                    ...CONVERSATIONS_KEY,
                    targetId,
                    "messages",
                  ],
                });
                queryClient.invalidateQueries({
                  queryKey: CONVERSATIONS_KEY,
                });
                break;

              case "error":
                setState((prev) => ({
                  ...prev,
                  isStreaming: false,
                  error: event.content,
                }));
                break;
            }
          }
        );
      } catch (err) {
        setState((prev) => ({
          ...prev,
          isStreaming: false,
          error:
            err instanceof Error ? err.message : "An unexpected error occurred",
        }));
      }
    },
    [conversationId, state.isStreaming, queryClient]
  );

  const resetStream = useCallback(() => {
    contentRef.current = "";
    setState({
      isStreaming: false,
      streamedContent: "",
      sources: [],
      error: null,
    });
  }, []);

  return { ...state, sendMessage, resetStream };
}

