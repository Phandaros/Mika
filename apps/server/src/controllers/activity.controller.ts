import type { RequestHandler } from "express";
import { buildHomeDashboard, loadRecentActivity } from "../lib/homeDashboard.js";
import { getAuthUser } from "../middleware/auth.js";

export interface ActivityItem {
  id: string;
  type: "comment" | "task";
  at: string;
  title: string;
  subtitle: string;
  taskId: string | null;
}

export const listRecentActivity: RequestHandler = async (_req, res, next) => {
  try {
    const activities = await loadRecentActivity(30);

    res.json({ activities });
  } catch (error) {
    next(error);
  }
};

export const getHomeDashboard: RequestHandler = async (req, res, next) => {
  try {
    const dashboard = await buildHomeDashboard(getAuthUser(req));

    res.json(dashboard);
  } catch (error) {
    next(error);
  }
};
