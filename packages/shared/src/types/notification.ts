import { NotificationType } from "./enums.js";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType | string;
  title: string;
  message: string;
  read: boolean;
  taskId: string | null;
  createdAt: string;
}

export interface MarkNotificationReadResponse {
  notification: Notification;
}
