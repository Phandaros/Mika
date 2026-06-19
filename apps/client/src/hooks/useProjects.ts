import { keepPreviousData, useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import type {
  CreateProjectRequest,
  PortfolioFacetsResponse,
  PortfolioProjectSort,
  PortfolioProjectsResponse,
  Project,
  ProjectOptionsResponse,
  UpdateProjectRequest
} from "shared";
import { api } from "../lib/api";
import {
  restoreProjectCaches,
  runOptimisticProjectMutation,
  updateProjectInCaches
} from "../lib/projectCache";
import { queryClient } from "../lib/queryClient";

interface ProjectsResponse {
  projects: Project[];
}

interface ProjectResponse {
  project: Project;
}

export interface PortfolioProjectsFilters {
  sort: PortfolioProjectSort;
  status?: string[];
  platform?: string[];
  builder?: string[];
  query?: string;
}

export function buildPortfolioQueryParams(filters: PortfolioProjectsFilters, cursor?: string) {
  const query = filters.query?.trim();

  return {
    cursor,
    sort: filters.sort,
    ...(filters.status?.length ? { status: filters.status } : {}),
    ...(filters.platform?.length ? { platform: filters.platform } : {}),
    ...(filters.builder !== undefined ? { builder: filters.builder } : {}),
    ...(query ? { q: query } : {})
  };
}

export function portfolioProjectsQueryKey(filters: PortfolioProjectsFilters) {
  return ["projects", "portfolio", filters] as const;
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

export function useProjectOptions() {
  return useQuery({
    queryKey: ["projects", "options"],
    queryFn: async () => {
      const response = await api.get<ProjectOptionsResponse>("/projects/options");
      return response.data.projects;
    },
    staleTime: 60_000
  });
}

export function usePortfolioFacets() {
  return useQuery({
    queryKey: ["projects", "portfolio", "facets"],
    queryFn: async () => {
      const response = await api.get<PortfolioFacetsResponse>("/projects/portfolio/facets");
      return response.data.builders;
    }
  });
}

export function usePortfolioProjectsInfinite(filters: PortfolioProjectsFilters, enabled = true) {
  return useInfiniteQuery({
    queryKey: portfolioProjectsQueryKey(filters),
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const response = await api.get<PortfolioProjectsResponse>("/projects/portfolio", {
        params: buildPortfolioQueryParams(filters, pageParam),
        paramsSerializer: {
          indexes: null
        }
      });
      return response.data;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    placeholderData: keepPreviousData
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
      await queryClient.invalidateQueries({ queryKey: ["projects", "options"] });
      await queryClient.invalidateQueries({ queryKey: ["projects", "portfolio"] });
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
      return runOptimisticProjectMutation(projectId, payload);
    },
    onError: (_error, _payload, context) => {
      restoreProjectCaches(context);
    },
    onSuccess: (updatedProject) => {
      try {
        updateProjectInCaches(projectId, updatedProject);
      } catch (error) {
        console.error("[projects] Falha ao atualizar cache após salvar", error);
        void queryClient.invalidateQueries({ queryKey: ["projects", "portfolio"] });
      }
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
      return runOptimisticProjectMutation(id, payload);
    },
    onError: (_error, _variables, context) => {
      restoreProjectCaches(context);
    },
    onSuccess: (updatedProject, { id }) => {
      try {
        updateProjectInCaches(id, updatedProject);
      } catch (error) {
        console.error("[projects] Falha ao atualizar cache após salvar", error);
        void queryClient.invalidateQueries({ queryKey: ["projects", "portfolio"] });
      }
    }
  });
}
