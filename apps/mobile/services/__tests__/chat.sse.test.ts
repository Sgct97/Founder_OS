/**
 * Unit tests for SSE parsing used by chat streaming.
 */

import { flushSSEBuffer, parseSSEChunk } from "../sse";
import type { SSEChatEvent } from "@/types/chat";

describe("parseSSEChunk", () => {
  it("parses complete data lines and keeps an incomplete trailing line", () => {
    const events: SSEChatEvent[] = [];
    const remainder = parseSSEChunk(
      'data: {"type":"content","content":"Hi"}\ndata: {"type":"content","content":" there"}\ndata: {"type":"do',
      (e) => events.push(e)
    );

    expect(events).toEqual([
      { type: "content", content: "Hi" },
      { type: "content", content: " there" },
    ]);
    expect(remainder).toBe('data: {"type":"do');
  });

  it("skips [DONE] and malformed JSON", () => {
    const events: SSEChatEvent[] = [];
    parseSSEChunk(
      'data: [DONE]\ndata: not-json\ndata: {"type":"done","message_id":"1"}\n',
      (e) => events.push(e)
    );
    expect(events).toEqual([{ type: "done", message_id: "1" }]);
  });
});

describe("flushSSEBuffer", () => {
  it("parses a final complete data line left in the buffer", () => {
    const events: SSEChatEvent[] = [];
    flushSSEBuffer('data: {"type":"done","message_id":"abc"}', (e) =>
      events.push(e)
    );
    expect(events).toEqual([{ type: "done", message_id: "abc" }]);
  });
});
