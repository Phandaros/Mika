import { useMutation, useQuery } from "@tanstack/react-query";
import type { CreateSectionRequest, Section, UpdateSectionRequest } from "shared";
import { api } from "../lib/api";
import { queryClient } from "../lib/queryClient";

interface SectionsResponse {
  sections: Section[];
}

interface SectionResponse {
  section: Section;
}

export function useSections(projectId: string | undefined) {
  return useQuery({
    queryKey: ["projects", projectId, "sections"],
    enabled: Boolean(projectId),
    queryFn: async () => {
      const response = await api.get<SectionsResponse>(`/projects/${projectId}/sections`);
      return response.data.sections;
    }
  });
}

export function useCreateSection(projectId: string) {
  return useMutation({
    mutationFn: async (payload: CreateSectionRequest) => {
      const response = await api.post<SectionResponse>(`/projects/${projectId}/sections`, payload);
      return response.data.section;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["projects", projectId, "sections"] });
    }
  });
}

export function useUpdateSection(projectId: string) {
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateSectionRequest }) => {
      const response = await api.patch<SectionResponse>(`/sections/${id}`, payload);
      return response.data.section;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["projects", projectId, "sections"] });
    }
  });
}
