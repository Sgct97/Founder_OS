export interface FeatureRequest {
  id: string;
  workspace_id: string;
  author_id: string;
  author_email: string | null;
  author_name: string | null;
  title: string;
  description: string | null;
  status: FeatureRequestStatus;
  vote_count: number;
  has_voted: boolean;
  created_at: string;
  updated_at: string;
}

export type FeatureRequestStatus =
  | "open"
  | "under_review"
  | "planned"
  | "in_progress"
  | "completed"
  | "declined";

export interface FeatureRequestCreatePayload {
  title: string;
  description?: string;
}

export interface FeatureRequestUpdatePayload {
  title?: string;
  description?: string;
  status?: FeatureRequestStatus;
}

export interface VoteToggleResponse {
  has_voted: boolean;
  vote_count: number;
}
