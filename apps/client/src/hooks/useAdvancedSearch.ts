import { useQuery } from "@tanstack/react-query";
import type {
  AdvancedSearchCompletion,
  AdvancedSearchIndicatorMetric,
  AdvancedSearchResponse,
  AdvancedSearchType,
  IndicatorPeriod,
  IndicatorScope
} from "shared";
import { api } from "../lib/api";

export interface AdvancedSearchFilters {
  q: string;
  type: AdvancedSearchType;
  page: number;
  limit: number;
  projectId?: string;
  status: string[];
  assigneeId?: string;
  priority: string[];
  dueFrom?: string;
  dueTo?: string;
  completion: AdvancedSearchCompletion;
  source?: "indicators";
  indicatorMetric?: AdvancedSearchIndicatorMetric;
  indicatorPeriod?: IndicatorPeriod;
  indicatorScope?: IndicatorScope;
}

const EMPTY_PAGE = {
  items: [],
  total: 0,
  page: 1,
  limit: 25
};

export const EMPTY_ADVANCED_SEARCH_RESPONSE: AdvancedSearchResponse = {
  type: "all",
  tasks: EMPTY_PAGE,
  projects: EMPTY_PAGE,
  users: EMPTY_PAGE
};

export function useAdvancedSearch(filters: AdvancedSearchFilters) {
  return useQuery({
    queryKey: ["advancedSearch", filters],
    placeholderData: EMPTY_ADVANCED_SEARCH_RESPONSE,
    queryFn: async () => {
      const response = await api.get<AdvancedSearchResponse>("/search/advanced", {
        params: {
          q: filters.q || undefined,
          type: filters.type,
          page: filters.page,
          limit: filters.limit,
          projectId: filters.projectId,
          status: filters.status.length ? filters.status : undefined,
          assigneeId: filters.assigneeId,
          priority: filters.priority.length ? filters.priority : undefined,
          dueFrom: filters.dueFrom,
          dueTo: filters.dueTo,
          completion: filters.completion,
          source: filters.source,
          indicatorMetric: filters.indicatorMetric,
          indicatorPeriod: filters.indicatorPeriod,
          indicatorScope: filters.indicatorScope
        },
        paramsSerializer: {
          indexes: null
        }
      });

      return response.data;
    }
  });
}
