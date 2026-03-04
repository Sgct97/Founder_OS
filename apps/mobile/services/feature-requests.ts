import { apiDelete, apiGet, apiPatch, apiPost } from "./api";
import type {
  FeatureRequest,
  FeatureRequestCreatePayload,
  FeatureRequestUpdatePayload,
  VoteToggleResponse,
} from "@/types/feature-requests";

export async function listFeatureRequests(): Promise<FeatureRequest[]> {
  return apiGet<FeatureRequest[]>("/api/v1/feature-requests");
}

export async function createFeatureRequest(
  payload: FeatureRequestCreatePayload
): Promise<FeatureRequest> {
  return apiPost<FeatureRequest>("/api/v1/feature-requests", payload);
}

export async function updateFeatureRequest(
  id: string,
  payload: FeatureRequestUpdatePayload
): Promise<FeatureRequest> {
  return apiPatch<FeatureRequest>(`/api/v1/feature-requests/${id}`, payload);
}

export async function deleteFeatureRequest(id: string): Promise<void> {
  return apiDelete(`/api/v1/feature-requests/${id}`);
}

export async function toggleVote(id: string): Promise<VoteToggleResponse> {
  return apiPost<VoteToggleResponse>(`/api/v1/feature-requests/${id}/vote`);
}
