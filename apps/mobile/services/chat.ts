/**
 * Chat API service — wraps all RAG conversation endpoints + SSE streaming.
 */

import { fetch as expoFetch } from "expo/fetch";

import { API_BASE_URL } from "@/constants/api";
import { apiDelete, apiGet, apiPost, getAccessToken } from "@/services/api";
import { flushSSEBuffer, parseSSEChunk } from "@/services/sse";
import type {
  ConversationCreatePayload,
  ConversationResponse,
  MessageResponse,
  SSEChatEvent,
} from "@/types/chat";

export { flushSSEBuffer, parseSSEChunk } from "@/services/sse";

// ── Conversation CRUD ────────────────────────────────────────

/** Fetch conversations. Pass milestoneId to scope to a specific milestone. */
export async function listConversations(
  milestoneId?: string
): Promise<ConversationResponse[]> {
  const params = milestoneId ? `?milestone_id=${milestoneId}` : "";
  return apiGet<ConversationResponse[]>(`/api/v1/conversations${params}`);
}

/** Create a new conversation. */
export async function createConversation(
  payload: ConversationCreatePayload
): Promise<ConversationResponse> {
  return apiPost<ConversationResponse>("/api/v1/conversations", payload);
}

/** Fetch all messages for a conversation, in chronological order. */
export async function getConversationMessages(
  conversationId: string
): Promise<MessageResponse[]> {
  return apiGet<MessageResponse[]>(
    `/api/v1/conversations/${conversationId}/messages`
  );
}

/** Delete a conversation and all its messages. */
export async function deleteConversation(
  conversationId: string
): Promise<void> {
  return apiDelete(`/api/v1/conversations/${conversationId}`);
}

// ── SSE Streaming ────────────────────────────────────────────

/**
 * Send a message and process the streamed SSE response.
 *
 * Uses `expo/fetch` so `response.body` is a ReadableStream on iOS/Android.
 * React Native's default fetch often returns a null body for SSE.
 *
 * @param conversationId  The conversation to send the message to.
 * @param content         The user's message text.
 * @param onEvent         Callback invoked for each SSE event.
 *
 * Returns a promise that resolves when the stream completes.
 */
export async function sendMessageStreaming(
  conversationId: string,
  content: string,
  onEvent: (event: SSEChatEvent) => void
): Promise<void> {
  const token = await getAccessToken();

  const response = (await expoFetch(
    `${API_BASE_URL}/api/v1/conversations/${conversationId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ content }),
    } as never
  )) as unknown as Response;

  if (!response.ok) {
    let detail = `Chat request failed with status ${response.status}`;
    try {
      const body = await response.json();
      if (body.detail) {
        detail =
          typeof body.detail === "string"
            ? body.detail
            : JSON.stringify(body.detail);
      }
    } catch {
      // non-JSON
    }
    throw new Error(detail);
  }

  // Preferred path: true streaming via ReadableStream.
  if (response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        buffer = parseSSEChunk(buffer, onEvent);
      }

      flushSSEBuffer(buffer, onEvent);
    } finally {
      reader.releaseLock();
    }
    return;
  }

  // Fallback: some runtimes buffer the full SSE payload with a null body.
  // Still deliver events so chat works (without token-by-token streaming).
  const text = await response.text();
  if (!text) {
    throw new Error(
      "Chat response was empty. Streaming is unavailable on this device — try again or use the web app."
    );
  }
  const remainder = parseSSEChunk(
    text.endsWith("\n") ? text : `${text}\n`,
    onEvent
  );
  flushSSEBuffer(remainder, onEvent);
}
