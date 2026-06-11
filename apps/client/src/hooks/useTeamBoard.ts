import { useQuery, type QueryKey } from "@tanstack/react-query";
import type { TeamBoardResponse } from "shared";
import { api } from "../lib/api";
import { queryClient } from "../lib/queryClient";

export interface TeamBoardQueryParams {
  includeEmpty?: boolean;
}

export function teamBoardQueryKey(params: TeamBoardQueryParams = {}): QueryKey {
  return ["teamBoard", params.includeEmpty ?? false];
}

export function teamBoardQueryPredicate(query: { queryKey: QueryKey }): boolean {
  return Array.isArray(query.queryKey) && query.queryKey[0] === "teamBoard";
}

export function invalidateTeamBoardQueries() {
  void queryClient.invalidateQueries({ predicate: teamBoardQueryPredicate });
}

export function useTeamBoard(params: TeamBoardQueryParams = {}) {
  const includeEmpty = params.includeEmpty ?? false;

  return useQuery({
    queryKey: teamBoardQueryKey({ includeEmpty }),
    queryFn: async () => {
      const response = await api.get<TeamBoardResponse>("/team-board", {
        params: {
          includeEmpty: includeEmpty ? "true" : "false"
        }
      });
      return response.data;
    },
    staleTime: 30_000
  });
}
