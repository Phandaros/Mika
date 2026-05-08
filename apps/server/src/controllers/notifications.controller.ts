import type { RequestHandler } from "express";

export const listNotifications: RequestHandler = async (_req, res, next) => {
  try {
    res.json({ notifications: [] });
  } catch (error) {
    next(error);
  }
};

export const markNotificationRead: RequestHandler = async (req, res, next) => {
  try {
    res.json({
      notification: {
        id: req.params.id,
        read: true
      }
    });
  } catch (error) {
    next(error);
  }
};

export const markAllNotificationsRead: RequestHandler = async (_req, res, next) => {
  try {
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};
