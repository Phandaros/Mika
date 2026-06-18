import type { RequestHandler } from "express";
import type { Prisma } from "../generated/prisma/client.js";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getAuthUser } from "../middleware/auth.js";
import { AppError } from "../middleware/errorHandler.js";
import { notificationInclude, notificationToPayload } from "../lib/notify.js";

const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(25),
  read: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  type: z.string().trim().min(1).optional()
});

const markNotificationReadSchema = z.object({
  read: z.boolean().optional().default(true)
});

export const listNotifications: RequestHandler = async (req, res, next) => {
  try {
    const user = getAuthUser(req);
    const parsed = listNotificationsQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      throw new AppError(400, "Parâmetros de notificações inválidos", parsed.error.flatten());
    }

    const { page, limit, read, type } = parsed.data;
    const where: Prisma.NotificationWhereInput = {
      userId: user.id,
      ...(read === undefined ? {} : { read }),
      ...(type ? { type } : {})
    };
    const [total, unreadCount, notifications] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId: user.id, read: false } }),
      prisma.notification.findMany({
        where,
        include: notificationInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit
      })
    ]);

    res.json({
      notifications: notifications.map((notification) => notificationToPayload(notification)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      unreadCount
    });
  } catch (error) {
    next(error);
  }
};

export const markNotificationRead: RequestHandler = async (req, res, next) => {
  try {
    const user = getAuthUser(req);
    const parsed = markNotificationReadSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new AppError(400, "Estado de leitura inválido", parsed.error.flatten());
    }

    const updated = await prisma.notification.updateMany({
      where: { id: req.params.id, userId: user.id },
      data: { read: parsed.data.read }
    });

    if (updated.count === 0) {
      throw new AppError(404, "Notificação não encontrada");
    }

    const notification = await prisma.notification.findFirstOrThrow({
      where: { id: req.params.id, userId: user.id },
      include: notificationInclude
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
