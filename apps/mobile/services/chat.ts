/**
 * Chat API service — wraps all RAG conversation endpoints + SSE streaming.
 */

import { API_BASE_URL } from "@/constants/api";
import { apiDelete, apiGet, apiPost, getAccessToken } from "@/services/api";
import type {
  ConversationCreatePayload,
  ConversationResponse,
  MessageResponse,
  SSEChatEvent,
} from "@/types/chat";

// ── Conversation CRUD ────────────────────────────────────────

/** Fetch all conversations for the workspace, newest first. */
export async function listConversations(): Promise<ConversationResponse[]> {
  return apiGet<ConversationResponse[]>("/api/v1/conversations");
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

  const response = await fetch(
    `${API_BASE_URL}/api/v1/conversations/${conversationId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ content }),
    }
  );

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

  if (!response.body) {
    throw new Error("Response body is null — streaming not supported.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const dataStr = line.slice(6).trim();
          if (!dataStr || dataStr === "[DONE]") continue;

          try {
            const parsed = JSON.parse(dataStr) as SSEChatEvent;
            onEvent(parsed);
          } catch {
            // Skip malformed JSON lines.
          }
        }
      }
    }

    // Process any remaining data in the buffer.
    if (buffer.startsWith("data: ")) {
      const dataStr = buffer.slice(6).trim();
      if (dataStr && dataStr !== "[DONE]") {
        try {
          const parsed = JSON.parse(dataStr) as SSEChatEvent;
          onEvent(parsed);
        } catch {
          // ignore
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

