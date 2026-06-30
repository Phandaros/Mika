import { useMutation, useQuery } from "@tanstack/react-query";
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

export function useDownloadMonthlyCompletedTemplate() {
  return useMutation({
    mutationFn: async (month: string) => {
      const response = await api.get<Blob>("/weekly-reports/monthly-completed-template", {
        params: { month },
        responseType: "blob"
      });
      return { blob: response.data, month };
    },
    onSuccess: ({ blob, month }) => {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `relatorio-mensal-concluidas-${month}.docx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    }
  });
}
