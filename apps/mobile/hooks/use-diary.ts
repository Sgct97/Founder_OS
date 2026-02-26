/**
 * React Query hooks for diary entries and streaks.
 *
 * Provides data fetching, mutations, and cache invalidation
 * for the diary timeline and new entry screens.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as diaryService from "@/services/diary";
import type {
  DiaryEntryCreatePayload,
  DiaryEntryResponse,
  DiaryEntryUpdatePayload,
  StreaksResponse,
} from "@/types/diary";

const DIARY_KEY = ["diary"] as const;
const STREAKS_KEY = ["diary", "streaks"] as const;
const REFETCH_INTERVAL_MS = 5000;

interface DiaryListParams {
  author?: string;
  milestone?: string;
  from?: string;
  to?: string;
}

/** Fetch diary entries with optional filters. Polls every 5 seconds. */
export function useDiaryEntries(params: DiaryListParams = {}) {
  return useQuery<DiaryEntryResponse[]>({
    queryKey: [...DIARY_KEY, params],
    queryFn: () => diaryService.listEntries(params),
    refetchInterval: REFETCH_INTERVAL_MS,
  });
}

/** Fetch streak data for all workspace members. Polls every 5 seconds. */
export function useStreaks() {
  return useQuery<StreaksResponse>({
    queryKey: STREAKS_KEY,
    queryFn: diaryService.getStreaks,
    refetchInterval: REFETCH_INTERVAL_MS,
  });
}

/** Create a new diary entry. Invalidates diary + streaks on success. */
export function useCreateDiaryEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: DiaryEntryCreatePayload) =>
      diaryService.createEntry(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DIARY_KEY });
      queryClient.invalidateQueries({ queryKey: STREAKS_KEY });
    },
  });
}

/** Update a diary entry. Invalidates diary cache on success. */
export function useUpdateDiaryEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      entryId,
      payload,
    }: {
      entryId: string;
      payload: DiaryEntryUpdatePayload;
    }) => diaryService.updateEntry(entryId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DIARY_KEY });
    },
  });
}

/** Delete a diary entry. Invalidates diary + streaks on success. */
export function useDeleteDiaryEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) => diaryService.deleteEntry(entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DIARY_KEY });
      queryClient.invalidateQueries({ queryKey: STREAKS_KEY });
    },
  });
}

