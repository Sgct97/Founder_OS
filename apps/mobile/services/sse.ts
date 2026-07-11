/**
 * SSE helpers for chat streaming — kept free of Expo/RN imports for easy unit testing.
 */

import type { SSEChatEvent } from "@/types/chat";

/**
 * Parse SSE `data:` lines from a text chunk.
 * Returns parsed events via callback and any incomplete trailing buffer.
 */
export function parseSSEChunk(
  chunk: string,
  onEvent: (event: SSEChatEvent) => void
): string {
  const lines = chunk.split("\n");
  const incomplete = lines.pop() ?? "";

  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;
    const dataStr = line.slice(6).trim();
    if (!dataStr || dataStr === "[DONE]") continue;
    try {
      onEvent(JSON.parse(dataStr) as SSEChatEvent);
    } catch {
      // Skip malformed JSON lines.
    }
  }

  return incomplete;
}

/** Flush a final partial SSE buffer line, if complete enough to parse. */
export function flushSSEBuffer(
  buffer: string,
  onEvent: (event: SSEChatEvent) => void
): void {
  if (!buffer.startsWith("data: ")) return;
  const dataStr = buffer.slice(6).trim();
  if (!dataStr || dataStr === "[DONE]") return;
  try {
    onEvent(JSON.parse(dataStr) as SSEChatEvent);
  } catch {
    // ignore
  }
}
