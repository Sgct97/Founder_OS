/** React Query hooks for workspace management — list, create, switch. */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost, apiPut } from "@/services/api";
import type { WorkspaceInfo, WorkspaceMemberInfo } from "@/types/auth";

const WORKSPACES_KEY = ["workspaces"] as const;

export function useWorkspaces() {
  return useQuery<WorkspaceMemberInfo[]>({
    queryKey: WORKSPACES_KEY,
    queryFn: () => apiGet<WorkspaceMemberInfo[]>("/api/v1/workspaces"),
  });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiPost<WorkspaceInfo>("/api/v1/workspaces", { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKSPACES_KEY });
    },
  });
}

export function useSwitchWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workspaceId: string) =>
      apiPut<WorkspaceInfo>("/api/v1/workspaces/switch", {
        workspace_id: workspaceId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKSPACES_KEY });
    },
  });
}
