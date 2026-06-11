import { useMutation, useQuery } from "@tanstack/react-query";
import type {
  CreateProjectRequest,
  Project,
  UpdateProjectRequest
} from "shared";
import { api } from "../lib/api";
import {
  applyOptimisticProjectPatch,
  prepareProjectMutation,
  restoreProjectCaches,
  updateProjectInCaches
} from "../lib/projectCache";
import { queryClient } from "../lib/queryClient";

interface ProjectsResponse {
  projects: Project[];
}

interface ProjectResponse {
  project: Project;
}

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const response = await api.get<ProjectsResponse>("/projects");
      return response.data.projects;
    }
  });
}

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: ["projects", projectId],
    enabled: Boolean(projectId),
    queryFn: async () => {
      const response = await api.get<ProjectResponse>(`/projects/${projectId}`);
      return response.data.project;
    }
  });
}

export function useCreateProject() {
  return useMutation({
    mutationFn: async (payload: CreateProjectRequest) => {
      const response = await api.post<ProjectResponse>("/projects", payload);
      return response.data.project;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    }
  });
}

export function useUpdateProject(projectId: string) {
  return useMutation({
    mutationFn: async (payload: UpdateProjectRequest) => {
      const response = await api.patch<ProjectResponse>(`/projects/${projectId}`, payload);
      return response.data.project;
    },
    onMutate: async (payload) => {
      const context = await prepareProjectMutation(projectId);
      applyOptimisticProjectPatch(projectId, payload);
      return context;
    },
    onError: (_error, _payload, context) => {
      restoreProjectCaches(context);
    },
    onSuccess: (updatedProject) => {
      updateProjectInCaches(projectId, updatedProject);
    }
  });
}

export function usePatchProject() {
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateProjectRequest }) => {
      const response = await api.patch<ProjectResponse>(`/projects/${id}`, payload);
      return response.data.project;
    },
    onMutate: async ({ id, payload }) => {
      const context = await prepareProjectMutation(id);
      applyOptimisticProjectPatch(id, payload);
      return context;
    },
    onError: (_error, _variables, context) => {
      restoreProjectCaches(context);
    },
    onSuccess: (updatedProject, { id }) => {
      updateProjectInCaches(id, updatedProject);
    }
  });
}
