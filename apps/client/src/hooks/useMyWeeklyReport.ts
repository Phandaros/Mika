import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { WeeklyReportDto, WeeklyReportItemDto } from "shared";
import { api } from "../lib/api";
import { queryClient } from "../lib/queryClient";

interface WeeklyReportResponse {
  report: WeeklyReportDto;
}

interface WeeklyReportItemResponse {
  item: WeeklyReportItemDto;
}

export function useMyWeeklyReport() {
  return useQuery({
    queryKey: ["weekly-reports", "mine"],
    queryFn: async () => {
      const response = await api.get<WeeklyReportResponse>("/weekly-reports/mine");
      return response.data.report;
    }
  });
}

export function useUpdateWeeklyReportItem(reportId: string) {
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [savedItemIds, setSavedItemIds] = useState<Set<string>>(new Set());

  const mutation = useMutation({
    mutationFn: async ({ itemId, comment }: { itemId: string; comment: string }) => {
      const response = await api.patch<WeeklyReportItemResponse>(
        `/weekly-reports/${reportId}/items/${itemId}`,
        { comment }
      );
      return response.data.item;
    },
    onMutate: ({ itemId }) => {
      setSavingItemId(itemId);
      setSavedItemIds((current) => {
        const next = new Set(current);
        next.delete(itemId);
        return next;
      });
    },
    onSuccess: (item) => {
      queryClient.setQueryData<WeeklyReportDto>(["weekly-reports", "mine"], (current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          items: current.items.map((entry) => (entry.id === item.id ? item : entry))
        };
      });
      setSavedItemIds((current) => new Set(current).add(item.id));
    },
    onError: () => {
      toast.error("Não foi possível salvar o comentário");
    },
    onSettled: () => {
      setSavingItemId(null);
    }
  });

  const debouncedUpdate = useCallback(
    (itemId: string, comment: string) => {
      const existing = debounceTimers.current.get(itemId);
      if (existing) {
        clearTimeout(existing);
      }

      debounceTimers.current.set(
        itemId,
        setTimeout(() => {
          debounceTimers.current.delete(itemId);
          void mutation.mutateAsync({ itemId, comment });
        }, 1000)
      );
    },
    [mutation]
  );

  useEffect(() => {
    const timers = debounceTimers.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
    };
  }, []);

  return {
    debouncedUpdate,
    savingItemId,
    savedItemIds,
    isSaving: mutation.isPending
  };
}

export function useSubmitWeeklyReport() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (reportId: string) => {
      const response = await api.post<WeeklyReportResponse>(`/weekly-reports/${reportId}/submit`);
      return response.data.report;
    },
    onSuccess: (report) => {
      client.setQueryData(["weekly-reports", "mine"], report);
      client.invalidateQueries({ queryKey: ["weekly-reports"] });
      toast.success("Relatório enviado com sucesso");
    },
    onError: (error: unknown) => {
      const message =
        error && typeof error === "object" && "response" in error
          ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      toast.error(message ?? "Não foi possível enviar o relatório");
    }
  });
}
