import { useQuery } from "@tanstack/react-query";
import type { HomeDashboardResponse } from "shared";
import { api } from "../lib/api";

export function useHomeDashboard() {
  return useQuery({
    queryKey: ["activity", "home"],
    queryFn: async () => {
      const response = await api.get<HomeDashboardResponse>("/activity/home");
      return response.data;
    }
  });
}
