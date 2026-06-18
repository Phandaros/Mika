import { NotificationType } from "./enums.js";

export interface NotificationActor {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType | string;
  title: string;
  message: string;
  read: boolean;
  taskId: string | null;
  actor: NotificationActor | null;
  createdAt: string;
}

export interface NotificationsListResponse {
  notifications: Notification[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  unreadCount: number;
}

export interface MarkNotificationReadResponse {
  notification: Notification;
}
