/**
 * Milestone-related TypeScript types — mirrors backend Pydantic schemas.
 */

export type MilestoneStatus = "not_started" | "in_progress" | "completed";

export interface MilestoneResponse {
  id: string;
  phase_id: string;
  title: string;
  description: string | null;
  status: MilestoneStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PhaseWithMilestones {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  milestones: MilestoneResponse[];
  created_at: string;
  updated_at: string;
}

export interface PhaseResponse {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// ── Request payloads ────────────────────────────────────────

export interface PhaseCreatePayload {
  title: string;
  description?: string | null;
  sort_order?: number;
}

export interface PhaseUpdatePayload {
  title?: string;
  description?: string | null;
  sort_order?: number;
}

export interface MilestoneCreatePayload {
  title: string;
  description?: string | null;
  status?: MilestoneStatus;
  sort_order?: number;
}

export interface MilestoneUpdatePayload {
  title?: string;
  description?: string | null;
  status?: MilestoneStatus;
  sort_order?: number;
}

// ── Import types ─────────────────────────────────────────────

export interface ImportMilestoneItem {
  title: string;
  description: string | null;
}

export interface ImportPhaseItem {
  title: string;
  description: string | null;
  milestones: ImportMilestoneItem[];
}

export interface MilestoneImportPreview {
  phases: ImportPhaseItem[];
  total_phases: number;
  total_milestones: number;
}

export interface MilestoneImportRequest {
  content: string;
  replace_existing?: boolean;
}

export interface MilestoneImportResponse {
  phases_created: number;
  milestones_created: number;
  phases: PhaseWithMilestones[];
}

