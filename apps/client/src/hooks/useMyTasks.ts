import { useQuery } from "@tanstack/react-query";
import type { MyTasksCompletionFilter, MyTasksQuery, MyTasksResponse } from "shared";
import { api } from "../lib/api";

export function useMyTasks(filters: MyTasksQuery = {}) {
  return useQuery({
    queryKey: ["tasks", "mine", filters],
    queryFn: async () => {
      const response = await api.get<MyTasksResponse>("/tasks/mine", {
        params: {
          ...(filters.completion ? { completion: filters.completion } : {}),
          ...(filters.status?.length ? { status: filters.status } : {}),
          ...(filters.search ? { search: filters.search } : {}),
          ...(filters.userId ? { userId: filters.userId } : {})
        },
        paramsSerializer: {
          indexes: null
        }
      });
      return response.data.tasks;
    }
  });
}

export type { MyTasksCompletionFilter };
