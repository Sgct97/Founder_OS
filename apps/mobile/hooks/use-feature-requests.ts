import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as frService from "@/services/feature-requests";
import type {
  FeatureRequest,
  FeatureRequestCreatePayload,
  FeatureRequestUpdatePayload,
} from "@/types/feature-requests";

const FR_KEY = ["feature-requests"] as const;
const REFETCH_INTERVAL_MS = 5000;

export function useFeatureRequests() {
  return useQuery<FeatureRequest[]>({
    queryKey: FR_KEY,
    queryFn: frService.listFeatureRequests,
    refetchInterval: REFETCH_INTERVAL_MS,
  });
}

export function useCreateFeatureRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: FeatureRequestCreatePayload) =>
      frService.createFeatureRequest(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: FR_KEY }),
  });
}

export function useUpdateFeatureRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: FeatureRequestUpdatePayload;
    }) => frService.updateFeatureRequest(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: FR_KEY }),
  });
}

export function useDeleteFeatureRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => frService.deleteFeatureRequest(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: FR_KEY }),
  });
}

export function useToggleVote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => frService.toggleVote(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: FR_KEY }),
  });
}
