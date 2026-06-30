import { useQuery } from "@tanstack/react-query";
import type { IndicatorPeriod, IndicatorPortfolioYear, IndicatorScope, IndicatorsResponse } from "shared";
import { api } from "../lib/api";

export interface IndicatorsQuery {
  period: IndicatorPeriod;
  scope: IndicatorScope;
  portfolioYear: IndicatorPortfolioYear;
}

export function useIndicators(query: IndicatorsQuery) {
  return useQuery({
    queryKey: ["indicators", query],
    queryFn: async () => {
      const response = await api.get<IndicatorsResponse>("/indicators", {
        params: query
      });

      return response.data;
    },
    staleTime: 60_000
  });
}
