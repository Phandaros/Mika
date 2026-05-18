import { useMutation, useQuery } from "@tanstack/react-query";
import type {
  CompanyHoliday,
  CompanyHolidaysResponse,
  CreateCompanyHolidayRequest,
  UpdateCompanyHolidayRequest
} from "shared";
import { api } from "../lib/api";
import { queryClient } from "../lib/queryClient";

interface CompanyHolidayResponse {
  holiday: CompanyHoliday;
}

export function useCompanyHolidays(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: ["companyHolidays", from, to],
    enabled: enabled && Boolean(from) && Boolean(to),
    queryFn: async () => {
      const response = await api.get<CompanyHolidaysResponse>("/calendar/holidays", {
        params: { from, to }
      });
      return response.data.holidays;
    }
  });
}

export function useCreateCompanyHoliday() {
  return useMutation({
    mutationFn: async (payload: CreateCompanyHolidayRequest) => {
      const response = await api.post<CompanyHolidayResponse>("/calendar/holidays", payload);
      return response.data.holiday;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["companyHolidays"] });
    }
  });
}

export function useUpdateCompanyHoliday() {
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateCompanyHolidayRequest }) => {
      const response = await api.patch<CompanyHolidayResponse>(`/calendar/holidays/${id}`, payload);
      return response.data.holiday;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["companyHolidays"] });
    }
  });
}

export function useDeleteCompanyHoliday() {
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/calendar/holidays/${id}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["companyHolidays"] });
    }
  });
}
