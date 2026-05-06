import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
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
