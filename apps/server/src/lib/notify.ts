import type { Notification } from "../generated/prisma/client.js";
import { prisma } from "./prisma.js";
import { emitNotification } from "./socket.js";

export function notificationToPayload(notification: Notification) {
  return {
    id: notification.id,
    userId: notification.userId,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    read: notification.read,
    taskId: notification.taskId,
    createdAt: notification.createdAt.toISOString()
  };
}

export async function createAndEmitNotification(input: {
  userId: string;
  type: string;
  title: string;
  message: string;
  taskId?: string | null;
}): Promise<Notification> {
  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      taskId: input.taskId ?? null
    }
  });

  emitNotification(input.userId, notificationToPayload(notification));
  return notification;
}
