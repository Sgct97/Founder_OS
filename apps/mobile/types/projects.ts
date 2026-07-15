/**
 * Project types — mirrors backend Pydantic schemas.
 */

export interface Project {
  id: string;
  workspace_id: string;
  created_by: string;
  name: string;
  brief: string | null;
  github_url: string | null;
  preview_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectCreatePayload {
  name: string;
  brief?: string | null;
  github_url?: string | null;
  preview_url?: string | null;
}

export interface ProjectUpdatePayload {
  name?: string;
  brief?: string | null;
  github_url?: string | null;
  preview_url?: string | null;
}
