/** React Query hooks for workspace settings — API keys and project brief. */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as settingsService from "@/services/workspace-settings";
import type {
  ApiKeyCreate,
  ApiKeyResponse,
  ProjectBriefResponse,
} from "@/types/workspace-settings";

const API_KEYS_KEY = ["workspace-api-keys"] as const;
const PROJECT_BRIEF_KEY = ["workspace-project-brief"] as const;

// ── API Keys ──────────────────────────────────────────────────────

export function useApiKeys() {
  return useQuery<ApiKeyResponse[]>({
    queryKey: API_KEYS_KEY,
    queryFn: settingsService.listApiKeys,
  });
}

export function useAddApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ApiKeyCreate) => settingsService.addApiKey(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: API_KEYS_KEY });
    },
  });
}

export function useDeleteApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (keyId: string) => settingsService.deleteApiKey(keyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: API_KEYS_KEY });
    },
  });
}

// ── Project Brief ────────────────────────────────────────────────

export function useProjectBrief() {
  return useQuery<ProjectBriefResponse>({
    queryKey: PROJECT_BRIEF_KEY,
    queryFn: settingsService.getProjectBrief,
  });
}

export function useUpdateProjectBrief() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (brief: string | null) =>
      settingsService.updateProjectBrief({ project_brief: brief }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECT_BRIEF_KEY });
    },
  });
}
