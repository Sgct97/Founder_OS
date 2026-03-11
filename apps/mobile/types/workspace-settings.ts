/** Types for workspace settings — API keys and project brief. */

export interface ApiKeyResponse {
  id: string;
  service: string;
  key_hint: string;
  label: string | null;
  added_by: string;
  created_at: string;
  updated_at: string;
}

export interface ApiKeyCreate {
  service: string;
  api_key: string;
  label?: string;
}

export interface ProjectBriefResponse {
  project_brief: string | null;
}

export interface ProjectBriefUpdate {
  project_brief: string | null;
}
