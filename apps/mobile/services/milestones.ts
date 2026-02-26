/**
 * Milestones API service — wraps all phase and milestone endpoints.
 */

import { apiDelete, apiGet, apiPatch, apiPost } from "@/services/api";
import type {
  MilestoneCreatePayload,
  MilestoneResponse,
  MilestoneUpdatePayload,
  PhaseCreatePayload,
  PhaseResponse,
  PhaseUpdatePayload,
  PhaseWithMilestones,
} from "@/types/milestones";

// ── Phase operations ────────────────────────────────────────

/** Fetch all phases with nested milestones for the milestone board. */
export async function listPhases(): Promise<PhaseWithMilestones[]> {
  return apiGet<PhaseWithMilestones[]>("/api/v1/phases");
}

/** Create a new phase. */
export async function createPhase(
  payload: PhaseCreatePayload
): Promise<PhaseResponse> {
  return apiPost<PhaseResponse>("/api/v1/phases", payload);
}

/** Update a phase's title, description, or sort order. */
export async function updatePhase(
  phaseId: string,
  payload: PhaseUpdatePayload
): Promise<PhaseResponse> {
  return apiPatch<PhaseResponse>(`/api/v1/phases/${phaseId}`, payload);
}

/** Delete a phase and all its milestones. */
export async function deletePhase(phaseId: string): Promise<void> {
  return apiDelete(`/api/v1/phases/${phaseId}`);
}

// ── Milestone operations ────────────────────────────────────

/** Create a milestone inside a phase. */
export async function createMilestone(
  phaseId: string,
  payload: MilestoneCreatePayload
): Promise<MilestoneResponse> {
  return apiPost<MilestoneResponse>(
    `/api/v1/phases/${phaseId}/milestones`,
    payload
  );
}

/** Update a milestone's title, status, description, or sort order. */
export async function updateMilestone(
  milestoneId: string,
  payload: MilestoneUpdatePayload
): Promise<MilestoneResponse> {
  return apiPatch<MilestoneResponse>(
    `/api/v1/milestones/${milestoneId}`,
    payload
  );
}

/** Delete a milestone. */
export async function deleteMilestone(milestoneId: string): Promise<void> {
  return apiDelete(`/api/v1/milestones/${milestoneId}`);
}

