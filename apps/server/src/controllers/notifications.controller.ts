import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma.js";
import { getAuthUser } from "../middleware/auth.js";
import { AppError } from "../middleware/errorHandler.js";
import { notificationToPayload } from "../lib/notify.js";

export const listNotifications: RequestHandler = async (req, res, next) => {
  try {
    const user = getAuthUser(req);
    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50
    });

    res.json({
      notifications: notifications.map((n) => notificationToPayload(n))
    });
  } catch (error) {
    next(error);
  }
};

export const markNotificationRead: RequestHandler = async (req, res, next) => {
  try {
    const user = getAuthUser(req);
    const updated = await prisma.notification.updateMany({
      where: { id: req.params.id, userId: user.id },
      data: { read: true }
    });

    if (updated.count === 0) {
      throw new AppError(404, "Notification not found");
    }

    const notification = await prisma.notification.findFirstOrThrow({
      where: { id: req.params.id, userId: user.id }
    });

    res.json({ notification: notificationToPayload(notification) });
  } catch (error) {
    next(error);
  }
};

export const markAllNotificationsRead: RequestHandler = async (req, res, next) => {
  try {
    const user = getAuthUser(req);
    await prisma.notification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true }
    });

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};
