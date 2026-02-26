/**
 * Diary API service — wraps all diary entry and streak endpoints.
 */

import { apiDelete, apiGet, apiPatch, apiPost } from "@/services/api";
import type {
  DiaryEntryCreatePayload,
  DiaryEntryResponse,
  DiaryEntryUpdatePayload,
  StreaksResponse,
} from "@/types/diary";

// ── Query params builder ────────────────────────────────────

interface DiaryListParams {
  author?: string;
  milestone?: string;
  from?: string;
  to?: string;
}

function buildQueryString(params: DiaryListParams): string {
  const parts: string[] = [];
  if (params.author) parts.push(`author=${params.author}`);
  if (params.milestone) parts.push(`milestone=${params.milestone}`);
  if (params.from) parts.push(`from=${params.from}`);
  if (params.to) parts.push(`to=${params.to}`);
  return parts.length > 0 ? `?${parts.join("&")}` : "";
}

// ── Diary entry operations ──────────────────────────────────

/** Fetch diary entries with optional filters. */
export async function listEntries(
  params: DiaryListParams = {}
): Promise<DiaryEntryResponse[]> {
  const qs = buildQueryString(params);
  return apiGet<DiaryEntryResponse[]>(`/api/v1/diary${qs}`);
}

/** Create a new diary entry. */
export async function createEntry(
  payload: DiaryEntryCreatePayload
): Promise<DiaryEntryResponse> {
  return apiPost<DiaryEntryResponse>("/api/v1/diary", payload);
}

/** Update a diary entry. */
export async function updateEntry(
  entryId: string,
  payload: DiaryEntryUpdatePayload
): Promise<DiaryEntryResponse> {
  return apiPatch<DiaryEntryResponse>(`/api/v1/diary/${entryId}`, payload);
}

/** Delete a diary entry. */
export async function deleteEntry(entryId: string): Promise<void> {
  return apiDelete(`/api/v1/diary/${entryId}`);
}

// ── Streaks ─────────────────────────────────────────────────

/** Get streak data for all workspace members. */
export async function getStreaks(): Promise<StreaksResponse> {
  return apiGet<StreaksResponse>("/api/v1/diary/streaks");
}

