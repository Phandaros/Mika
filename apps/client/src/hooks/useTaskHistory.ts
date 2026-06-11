import { useQuery } from "@tanstack/react-query";
import type { TaskActivity } from "shared";
import { api } from "../lib/api";
import { canManageTasks } from "../lib/permissions";
import { useAuth } from "./useAuth";

interface TaskHistoryResponse {
  activities: TaskActivity[];
}

export function useTaskHistory(taskId: string | undefined) {
  const { user } = useAuth();
  const canViewHistory = canManageTasks(user);

  return useQuery({
    queryKey: ["tasks", taskId, "history"],
    enabled: Boolean(taskId) && canViewHistory,
    queryFn: async () => {
      const response = await api.get<TaskHistoryResponse>(`/tasks/${taskId}/history`);
      return response.data.activities;
    }
  });
}
