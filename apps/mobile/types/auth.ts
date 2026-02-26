/**
 * Auth-related TypeScript types — mirrors backend Pydantic schemas.
 */

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  workspace_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceInfo {
  id: string;
  name: string;
  invite_code: string | null;
  commitment_hours: number | null;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  user: UserProfile;
  workspace: WorkspaceInfo | null;
}

export interface InviteResponse {
  invite_code: string;
}

export interface SignupPayload {
  email: string;
  display_name: string;
  workspace_name: string;
  supabase_uid: string;
}

export interface LoginPayload {
  supabase_uid: string;
}

export interface JoinPayload {
  invite_code: string;
  email: string;
  display_name: string;
  supabase_uid: string;
}

