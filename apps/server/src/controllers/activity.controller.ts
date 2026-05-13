import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma.js";

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
    const [comments, tasks] = await Promise.all([
      prisma.comment.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          task: { select: { id: true, name: true } },
          author: { select: { name: true } }
        }
      }),
      prisma.task.findMany({
        orderBy: { updatedAt: "desc" },
        take: 20,
        select: { id: true, name: true, updatedAt: true }
      })
    ]);

    const fromComments: ActivityItem[] = comments.map((c) => ({
      id: `comment:${c.id}`,
      type: "comment" as const,
      at: (c.asanaCreatedAt ?? c.createdAt).toISOString(),
      title: c.task?.name ?? "Tarefa",
      subtitle: `${c.author?.name ?? "Asana"}: ${c.content.slice(0, 120)}${c.content.length > 120 ? "…" : ""}`,
      taskId: c.taskId
    }));

    const fromTasks: ActivityItem[] = tasks.map((t) => ({
      id: `task:${t.id}`,
      type: "task" as const,
      at: t.updatedAt.toISOString(),
      title: t.name,
      subtitle: "Tarefa atualizada",
      taskId: t.id
    }));

    const merged = [...fromComments, ...fromTasks]
      .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
      .slice(0, 30);

    res.json({ activities: merged });
  } catch (error) {
    next(error);
  }
};
