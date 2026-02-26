/**
 * Chat / RAG conversation TypeScript types — mirrors backend Pydantic schemas.
 */

export interface SourceCitation {
  document_id: string;
  document_title: string;
  chunk_id: string;
  snippet: string;
}

export interface MessageResponse {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  sources: SourceCitation[] | null;
  created_at: string;
}

export interface ConversationResponse {
  id: string;
  workspace_id: string;
  created_by: string;
  title: string;
  created_at: string;
  updated_at: string;
}

// ── Request payloads ────────────────────────────────────────

export interface ConversationCreatePayload {
  title?: string;
}

export interface MessageCreatePayload {
  content: string;
}

// ── SSE event types ─────────────────────────────────────────

export interface SSEContentEvent {
  type: "content";
  content: string;
}

export interface SSESourcesEvent {
  type: "sources";
  sources: SourceCitation[];
}

export interface SSEDoneEvent {
  type: "done";
  message_id: string;
}

export interface SSEErrorEvent {
  type: "error";
  content: string;
}

export type SSEChatEvent =
  | SSEContentEvent
  | SSESourcesEvent
  | SSEDoneEvent
  | SSEErrorEvent;

