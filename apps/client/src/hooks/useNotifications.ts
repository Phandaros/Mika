import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Notification, NotificationsListResponse } from "shared";
import { api } from "../lib/api";
import { queryClient } from "../lib/queryClient";

export interface NotificationFilters {
  page?: number;
  limit?: number;
  read?: boolean;
  type?: string;
}

export const notificationKeys = {
  all: ["notifications"] as const,
  list: (filters: Required<Pick<NotificationFilters, "page" | "limit">> & Omit<NotificationFilters, "page" | "limit">) =>
    [...notificationKeys.all, "list", filters] as const
};

function normalizedFilters(filters: NotificationFilters) {
  return {
    page: filters.page ?? 1,
    limit: filters.limit ?? 25,
    read: filters.read,
    type: filters.type
  };
}

export function useNotifications(filters: NotificationFilters = {}) {
  const normalized = normalizedFilters(filters);

  return useQuery({
    queryKey: notificationKeys.list(normalized),
    queryFn: async () => {
      const response = await api.get<NotificationsListResponse>("/notifications", {
        params: {
          page: normalized.page,
          limit: normalized.limit,
          ...(normalized.read === undefined ? {} : { read: normalized.read }),
          ...(normalized.type ? { type: normalized.type } : {})
        }
      });
      return response.data;
    }
  });
}

type NotificationCacheSnapshot = Array<[readonly unknown[], NotificationsListResponse | undefined]>;

function snapshotNotificationCaches(): NotificationCacheSnapshot {
  return queryClient.getQueriesData<NotificationsListResponse>({ queryKey: notificationKeys.all });
}

function restoreNotificationCaches(snapshot: NotificationCacheSnapshot | undefined) {
  for (const [key, data] of snapshot ?? []) {
    queryClient.setQueryData(key, data);
  }
}

function updateNotificationInCaches(updated: Notification, unreadDeltaOverride?: number) {
  const entries = queryClient.getQueriesData<NotificationsListResponse>({ queryKey: notificationKeys.all });

  for (const [key, current] of entries) {
    if (!current) {
      continue;
    }

    const existing = current.notifications.find((item) => item.id === updated.id);
    if (!existing) {
      if (unreadDeltaOverride !== undefined) {
        queryClient.setQueryData<NotificationsListResponse>(key, {
          ...current,
          unreadCount: Math.max(0, current.unreadCount + unreadDeltaOverride)
        });
      }
      continue;
    }

    const filters = filtersFromQueryKey(key);
    const remainsVisible =
      (filters.read === undefined || filters.read === updated.read) &&
      (!filters.type || filters.type === updated.type);
    const unreadDelta = unreadDeltaOverride ?? Number(!updated.read) - Number(!existing.read);
    const nextTotal = remainsVisible ? current.total : Math.max(0, current.total - 1);

    queryClient.setQueryData<NotificationsListResponse>(key, {
      ...current,
      notifications: remainsVisible
        ? current.notifications.map((item) => (item.id === updated.id ? updated : item))
        : current.notifications.filter((item) => item.id !== updated.id),
      total: nextTotal,
      totalPages: Math.ceil(nextTotal / filters.limit),
      unreadCount: Math.max(0, current.unreadCount + unreadDelta)
    });
  }
}

export function useMarkNotificationRead() {
  return useMutation<
    Notification,
    Error,
    { notificationId: string; read: boolean },
    { snapshot: NotificationCacheSnapshot }
  >({
    mutationFn: async ({ notificationId, read }: { notificationId: string; read: boolean }) => {
      const response = await api.patch<{ notification: Notification }>(`/notifications/${notificationId}/read`, { read });
      return response.data.notification;
    },
    onMutate: async ({ notificationId, read }) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.all });
      const snapshot = snapshotNotificationCaches();

      const optimistic = snapshot
        .flatMap(([, data]) => data?.notifications ?? [])
        .find((item) => item.id === notificationId);

      if (optimistic && optimistic.read !== read) {
        updateNotificationInCaches({ ...optimistic, read }, read ? -1 : 1);
      }

      return { snapshot };
    },
    onError: (_error, _variables, context) => {
      restoreNotificationCaches(context?.snapshot);
      toast.error("Não foi possível atualizar a notificação.");
    },
    onSuccess: (notification) => {
      updateNotificationInCaches(notification);
    }
  });
}

export function useMarkAllNotificationsRead() {
  return useMutation<void, Error, void, { snapshot: NotificationCacheSnapshot }>({
    mutationFn: async () => {
      await api.patch("/notifications/read-all");
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.all });
      const snapshot = snapshotNotificationCaches();

      for (const [key, current] of snapshot) {
        if (!current) {
          continue;
        }

        const filters = filtersFromQueryKey(key);
        const notifications =
          filters.read === false
            ? []
            : current.notifications.map((notification) => ({ ...notification, read: true }));

        queryClient.setQueryData<NotificationsListResponse>(key, {
          ...current,
          notifications,
          total: filters.read === false ? 0 : current.total,
          totalPages: filters.read === false ? 0 : current.totalPages,
          unreadCount: 0
        });
      }

      return { snapshot };
    },
    onError: (_error, _variables, context) => {
      restoreNotificationCaches(context?.snapshot);
      toast.error("Não foi possível marcar as notificações como lidas.");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    }
  });
}

export function prependRealtimeNotification(notification: Notification) {
  const entries = queryClient.getQueriesData<NotificationsListResponse>({ queryKey: notificationKeys.all });

  for (const [key, current] of entries) {
    if (!current || current.notifications.some((item) => item.id === notification.id)) {
      continue;
    }

    const filters = filtersFromQueryKey(key);
    const matchesRead = filters.read === undefined || filters.read === notification.read;
    const matchesType = !filters.type || filters.type === notification.type;

    queryClient.setQueryData<NotificationsListResponse>(key, {
      ...current,
      notifications:
        filters.page === 1 && matchesRead && matchesType
          ? [notification, ...current.notifications].slice(0, filters.limit)
          : current.notifications,
      total: matchesRead && matchesType ? current.total + 1 : current.total,
      totalPages: matchesRead && matchesType ? Math.ceil((current.total + 1) / filters.limit) : current.totalPages,
      unreadCount: current.unreadCount + (notification.read ? 0 : 1)
    });
  }

  if (entries.length === 0) {
    void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
  }
}

function filtersFromQueryKey(key: readonly unknown[]): ReturnType<typeof normalizedFilters> {
  return Array.isArray(key) && typeof key[2] === "object" && key[2] !== null
    ? (key[2] as ReturnType<typeof normalizedFilters>)
    : normalizedFilters({});
}
