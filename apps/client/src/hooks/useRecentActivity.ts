import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export interface ActivityItem {
  id: string;
  type: "comment" | "task";
  at: string;
  title: string;
  subtitle: string;
  taskId: string | null;
}

interface ActivityResponse {
  activities: ActivityItem[];
}

export function useRecentActivity() {
  return useQuery({
    queryKey: ["activity", "recent"],
    queryFn: async () => {
      const response = await api.get<ActivityResponse>("/activity/recent");
      return response.data.activities;
    }
  });
}
