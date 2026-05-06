import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma.js";
import { getAuthUser } from "../middleware/auth.js";
import { AppError } from "../middleware/errorHandler.js";

export const listNotifications: RequestHandler = async (req, res, next) => {
  try {
    const user = getAuthUser(req);
    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" }
    });

    res.json({ notifications });
  } catch (error) {
    next(error);
  }
};

export const markNotificationRead: RequestHandler = async (req, res, next) => {
  try {
    const user = getAuthUser(req);
    const existing = await prisma.notification.findUnique({ where: { id: req.params.id } });

    if (!existing) {
      throw new AppError(404, "Notification not found");
    }

    if (existing.userId !== user.id) {
      throw new AppError(403, "Insufficient permissions");
    }

    const notification = await prisma.notification.update({
      where: { id: req.params.id },
      data: { read: true }
    });

    res.json({ notification });
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
