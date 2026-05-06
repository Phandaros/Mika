import { useMutation, useQuery } from "@tanstack/react-query";
import type {
  CreateDisciplineRequest,
  Discipline,
  UpdateDisciplineRequest
} from "shared";
import { api } from "../lib/api";
import { queryClient } from "../lib/queryClient";

interface DisciplinesResponse {
  disciplines: Discipline[];
}

interface DisciplineResponse {
  discipline: Discipline;
}

export function useDisciplines(projectId: string | undefined) {
  return useQuery({
    queryKey: ["projects", projectId, "disciplines"],
    enabled: Boolean(projectId),
    queryFn: async () => {
      const response = await api.get<DisciplinesResponse>(`/projects/${projectId}/disciplines`);
      return response.data.disciplines;
    }
  });
}

export function useCreateDiscipline(projectId: string) {
  return useMutation({
    mutationFn: async (payload: CreateDisciplineRequest) => {
      const response = await api.post<DisciplineResponse>(`/projects/${projectId}/disciplines`, payload);
      return response.data.discipline;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["projects", projectId, "disciplines"] });
    }
  });
}

export function useUpdateDiscipline(projectId: string) {
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateDisciplineRequest }) => {
      const response = await api.patch<DisciplineResponse>(`/disciplines/${id}`, payload);
      return response.data.discipline;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["projects", projectId, "disciplines"] });
    }
  });
}
