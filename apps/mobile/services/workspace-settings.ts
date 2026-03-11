/** API functions for workspace settings — API keys and project brief. */

import { apiDelete, apiGet, apiPost, apiPut } from "./api";
import type {
  ApiKeyCreate,
  ApiKeyResponse,
  ProjectBriefResponse,
  ProjectBriefUpdate,
} from "@/types/workspace-settings";

// ── API Keys ──────────────────────────────────────────────────────

export async function listApiKeys(): Promise<ApiKeyResponse[]> {
  return apiGet<ApiKeyResponse[]>("/api/v1/workspace/api-keys");
}

export async function addApiKey(data: ApiKeyCreate): Promise<ApiKeyResponse> {
  return apiPost<ApiKeyResponse>("/api/v1/workspace/api-keys", data);
}

export async function deleteApiKey(keyId: string): Promise<void> {
  return apiDelete(`/api/v1/workspace/api-keys/${keyId}`);
}

// ── Project Brief ────────────────────────────────────────────────

export async function getProjectBrief(): Promise<ProjectBriefResponse> {
  return apiGet<ProjectBriefResponse>("/api/v1/workspace/project-brief");
}

export async function updateProjectBrief(
  data: ProjectBriefUpdate
): Promise<ProjectBriefResponse> {
  return apiPut<ProjectBriefResponse>("/api/v1/workspace/project-brief", data);
}
