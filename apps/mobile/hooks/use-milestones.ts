/**
 * React Query hooks for milestones and phases.
 *
 * Provides data fetching, mutations, and cache invalidation
 * for the milestone board screen.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as milestonesService from "@/services/milestones";
import type {
  MilestoneAttachment,
  MilestoneCreatePayload,
  MilestoneImportRequest,
  MilestoneImportResponse,
  MilestoneUpdatePayload,
  PhaseCreatePayload,
  PhaseUpdatePayload,
  PhaseWithMilestones,
} from "@/types/milestones";

const PHASES_KEY = ["phases"] as const;
const REFETCH_INTERVAL_MS = 5000;

/** Fetch all phases with nested milestones. Polls every 5 seconds. */
export function usePhases() {
  return useQuery<PhaseWithMilestones[]>({
    queryKey: PHASES_KEY,
    queryFn: milestonesService.listPhases,
    refetchInterval: REFETCH_INTERVAL_MS,
  });
}

/** Create a new phase. Invalidates the phases cache on success. */
export function useCreatePhase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PhaseCreatePayload) =>
      milestonesService.createPhase(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PHASES_KEY });
    },
  });
}

/** Update a phase. Invalidates the phases cache on success. */
export function useUpdatePhase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ phaseId, payload }: { phaseId: string; payload: PhaseUpdatePayload }) =>
      milestonesService.updatePhase(phaseId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PHASES_KEY });
    },
  });
}

/** Delete a phase. Invalidates the phases cache on success. */
export function useDeletePhase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (phaseId: string) => milestonesService.deletePhase(phaseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PHASES_KEY });
    },
  });
}

/** Create a milestone in a phase. Invalidates phases cache on success. */
export function useCreateMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      phaseId,
      payload,
    }: {
      phaseId: string;
      payload: MilestoneCreatePayload;
    }) => milestonesService.createMilestone(phaseId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PHASES_KEY });
    },
  });
}

/** Update a milestone. Invalidates phases cache on success. */
export function useUpdateMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      milestoneId,
      payload,
    }: {
      milestoneId: string;
      payload: MilestoneUpdatePayload;
    }) => milestonesService.updateMilestone(milestoneId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PHASES_KEY });
    },
  });
}

/** Delete a milestone. Invalidates phases cache on success. */
export function useDeleteMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (milestoneId: string) =>
      milestonesService.deleteMilestone(milestoneId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PHASES_KEY });
    },
  });
}

/** Preview an AI import — does NOT write to the database. */
export function useImportPreview() {
  return useMutation({
    mutationFn: (payload: MilestoneImportRequest) =>
      milestonesService.importPreview(payload),
  });
}

/** Confirm an AI import — writes phases/milestones to the database. */
export function useImportConfirm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: MilestoneImportRequest) =>
      milestonesService.importConfirm(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PHASES_KEY });
    },
  });
}

// ── Attachment hooks ─────────────────────────────────────────

const ATTACHMENTS_KEY = ["milestone-attachments"] as const;

/** Fetch all attachments for a milestone. */
export function useMilestoneAttachments(milestoneId: string | undefined) {
  return useQuery<MilestoneAttachment[]>({
    queryKey: [...ATTACHMENTS_KEY, milestoneId],
    queryFn: () => milestonesService.listAttachments(milestoneId!),
    enabled: !!milestoneId,
  });
}

/** Upload a file attachment to a milestone. Invalidates phases + attachment cache. */
export function useUploadAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      milestoneId,
      file,
    }: {
      milestoneId: string;
      file: { uri: string; name: string; type: string };
    }) => milestonesService.uploadAttachment(milestoneId, file),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...ATTACHMENTS_KEY, variables.milestoneId],
      });
      queryClient.invalidateQueries({ queryKey: PHASES_KEY });
    },
  });
}

/** Delete a file attachment. Invalidates phases + attachment cache. */
export function useDeleteAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      milestoneId,
      attachmentId,
    }: {
      milestoneId: string;
      attachmentId: string;
    }) => milestonesService.deleteAttachment(milestoneId, attachmentId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...ATTACHMENTS_KEY, variables.milestoneId],
      });
      queryClient.invalidateQueries({ queryKey: PHASES_KEY });
    },
  });
}

