import { useMutation, useQuery } from "@tanstack/react-query";
import type {
  CreateTaskRequest,
  Task,
  TaskStatus,
  UpdateTaskRequest
} from "shared";
import { api } from "../lib/api";
import { queryClient } from "../lib/queryClient";

interface TasksResponse {
  tasks: Task[];
}

interface TaskResponse {
  task: Task;
}

export function useTasks(disciplineId: string | undefined) {
  return useQuery({
    queryKey: ["disciplines", disciplineId, "tasks"],
    enabled: Boolean(disciplineId),
    queryFn: async () => {
      const response = await api.get<TasksResponse>(`/disciplines/${disciplineId}/tasks`);
      return response.data.tasks;
    }
  });
}

export function useCreateTask(projectId: string, disciplineId: string) {
  return useMutation({
    mutationFn: async (payload: CreateTaskRequest) => {
      const response = await api.post<TaskResponse>(`/disciplines/${disciplineId}/tasks`, payload);
      return response.data.task;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["disciplines", disciplineId, "tasks"] });
    }
  });
}

export function useUpdateTask(projectId: string) {
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateTaskRequest }) => {
      const response = await api.patch<TaskResponse>(`/tasks/${id}`, payload);
      return response.data.task;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
    }
  });
}

export function useUpdateTaskStatus(projectId: string) {
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TaskStatus }) => {
      const response = await api.patch<TaskResponse>(`/tasks/${id}/status`, { status });
      return response.data.task;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
    }
  });
}
