/**
 * React Query hooks for workspace Projects.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as projectService from "@/services/projects";
import type {
  Project,
  ProjectCreatePayload,
  ProjectUpdatePayload,
} from "@/types/projects";

const PROJECTS_KEY = ["projects"] as const;

export function useProjects() {
  return useQuery<Project[]>({
    queryKey: PROJECTS_KEY,
    queryFn: projectService.listProjects,
  });
}

export function useProject(id: string | undefined) {
  return useQuery<Project>({
    queryKey: [...PROJECTS_KEY, id],
    queryFn: () => projectService.getProject(id!),
    enabled: !!id,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProjectCreatePayload) =>
      projectService.createProject(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: PROJECTS_KEY }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: ProjectUpdatePayload;
    }) => projectService.updateProject(id, payload),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: PROJECTS_KEY });
      qc.invalidateQueries({ queryKey: [...PROJECTS_KEY, vars.id] });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectService.deleteProject(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: PROJECTS_KEY }),
  });
}
