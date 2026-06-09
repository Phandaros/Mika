import { useQuery } from "@tanstack/react-query";
import type { TaskActivity } from "shared";
import { api } from "../lib/api";

interface TaskHistoryResponse {
  activities: TaskActivity[];
}

export function useTaskHistory(taskId: string | undefined) {
  return useQuery({
    queryKey: ["tasks", taskId, "history"],
    enabled: Boolean(taskId),
    queryFn: async () => {
      const response = await api.get<TaskHistoryResponse>(`/tasks/${taskId}/history`);
      return response.data.activities;
    }
  });
}
