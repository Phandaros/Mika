import { useQuery } from "@tanstack/react-query";
import type { WeeklyReportDto, WeeklyReportStatus, WeeklyReportsListResponse } from "shared";
import { api } from "../lib/api";

export interface WeeklyReportsFilters {
  userId?: string;
  weekStart?: string;
  status?: WeeklyReportStatus;
  page?: number;
  limit?: number;
}

interface WeeklyReportDetailResponse {
  report: WeeklyReportDto;
}

export function useWeeklyReports(filters: WeeklyReportsFilters = {}) {
  const { userId, weekStart, status, page = 1, limit = 25 } = filters;

  return useQuery({
    queryKey: ["weekly-reports", "list", userId, weekStart, status, page, limit],
    queryFn: async () => {
      const response = await api.get<WeeklyReportsListResponse>("/weekly-reports", {
        params: {
          ...(userId ? { userId } : {}),
          ...(weekStart ? { weekStart } : {}),
          ...(status ? { status } : {}),
          page,
          limit
        }
      });
      return response.data;
    }
  });
}

export function useWeeklyReport(reportId: string | null) {
  return useQuery({
    queryKey: ["weekly-reports", reportId],
    enabled: Boolean(reportId),
    queryFn: async () => {
      const response = await api.get<WeeklyReportDetailResponse>(`/weekly-reports/${reportId}`);
      return response.data.report;
    }
  });
}
