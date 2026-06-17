import { useQuery } from "@tanstack/react-query";
import type { HomeDashboardResponse } from "shared";
import { api } from "../lib/api";

export function useUserHomeDashboard(userId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["users", userId, "home"],
    enabled: Boolean(userId) && enabled,
    queryFn: async () => {
      const response = await api.get<HomeDashboardResponse>(`/users/${userId}/home`);
      return response.data;
    }
  });
}
