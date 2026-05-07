import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import type { Notification } from "shared";
import { api } from "../lib/api";
import { getNotificationSocket } from "../lib/socket";
import { queryClient } from "../lib/queryClient";
import { useAuthStore } from "../store/authStore";

interface NotificationsResponse {
  notifications: Notification[];
}

export function useNotifications() {
  const user = useAuthStore((state) => state.user);

  const query = useQuery({
    queryKey: ["notifications"],
    enabled: Boolean(user),
    queryFn: async () => {
      const response = await api.get<NotificationsResponse>("/notifications");
      return response.data.notifications;
    }
  });

  useEffect(() => {
    if (!user) {
      return;
    }

    const socket = getNotificationSocket();
    const onNotification = (notification: Notification) => {
      queryClient.setQueryData<Notification[]>(["notifications"], (current = []) => [
        notification,
        ...current
      ]);
      toast(notification.title);
    };

    socket.on("notification:new", onNotification);

    return () => {
      socket.off("notification:new", onNotification);
    };
  }, [user]);

  return query;
}

export function useUnreadNotificationCount(): number {
  const { data = [] } = useNotifications();
  return data.filter((notification) => !notification.read).length;
}

export function useMarkNotificationRead() {
  return useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await api.patch<{ notification: Notification }>(`/notifications/${notificationId}/read`);
      return response.data.notification;
    },
    onSuccess: (notification) => {
      queryClient.setQueryData<Notification[]>(["notifications"], (current = []) =>
        current.map((item) => (item.id === notification.id ? notification : item))
      );
    }
  });
}

export function useMarkAllNotificationsRead() {
  return useMutation({
    mutationFn: async () => {
      await api.patch("/notifications/read-all");
    },
    onSuccess: () => {
      queryClient.setQueryData<Notification[]>(["notifications"], (current = []) =>
        current.map((notification) => ({ ...notification, read: true }))
      );
    }
  });
}
