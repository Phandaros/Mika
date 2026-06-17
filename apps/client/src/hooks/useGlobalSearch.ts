import { useQuery } from "@tanstack/react-query";
import type { GlobalSearchResponse } from "shared";
import { api } from "../lib/api";

const EMPTY_SEARCH_RESPONSE: GlobalSearchResponse = {
  projects: [],
  tasks: [],
  users: []
};

export function useGlobalSearch(search: string, enabled: boolean) {
  const q = search.trim();

  return useQuery({
    queryKey: ["globalSearch", q],
    enabled,
    placeholderData: EMPTY_SEARCH_RESPONSE,
    queryFn: async () => {
      const response = await api.get<GlobalSearchResponse>("/search", {
        params: {
          q,
          limit: 12
        }
      });

      return response.data;
    }
  });
}
