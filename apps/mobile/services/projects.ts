/**
 * Projects API service — client delivery jobs in the current workspace.
 */

import { apiDelete, apiGet, apiPatch, apiPost } from "@/services/api";
import type {
  Project,
  ProjectCreatePayload,
  ProjectUpdatePayload,
} from "@/types/projects";

export { normalizeExternalUrl } from "@/services/project-urls";

export async function listProjects(): Promise<Project[]> {
  return apiGet<Project[]>("/api/v1/projects");
}

export async function getProject(id: string): Promise<Project> {
  return apiGet<Project>(`/api/v1/projects/${id}`);
}

export async function createProject(
  payload: ProjectCreatePayload
): Promise<Project> {
  return apiPost<Project>("/api/v1/projects", payload);
}

export async function updateProject(
  id: string,
  payload: ProjectUpdatePayload
): Promise<Project> {
  return apiPatch<Project>(`/api/v1/projects/${id}`, payload);
}

export async function deleteProject(id: string): Promise<void> {
  return apiDelete(`/api/v1/projects/${id}`);
}
