import type { RequestHandler } from "express";
import type { GlobalSearchResponse, GlobalSearchTaskResult } from "shared";
import { prisma } from "../lib/prisma.js";
import {
  buildProjectSearchWhere,
  buildTaskSearchWhere,
  buildUserSearchWhere,
  clampSearchLimit,
  normalizeSearchTerm,
  projectMatchesSearch,
  taskSearchInclude,
  taskMatchesSearch,
  toGlobalSearchProject,
  toGlobalSearchTask,
  toGlobalSearchUser,
  userMatchesSearch
} from "../lib/globalSearch.js";

export const globalSearch: RequestHandler = async (req, res, next) => {
  try {
    const q = normalizeSearchTerm(req.query.q);
    const limit = clampSearchLimit(req.query.limit);

    const [projects, tasks, users] = await Promise.all([
      prisma.project.findMany({
        where: q ? {} : buildProjectSearchWhere(q),
        orderBy: q ? [{ name: "asc" }, { updatedAt: "desc" }] : [{ updatedAt: "desc" }],
        take: q ? undefined : limit,
        select: {
          id: true,
          name: true,
          builder: true,
          team: { select: { name: true } },
          workspace: { select: { name: true } }
        }
      }),
      prisma.task.findMany({
        where: q ? buildTaskSearchWhere("") : buildTaskSearchWhere(q),
        orderBy: q ? [{ name: "asc" }, { updatedAt: "desc" }] : [{ updatedAt: "desc" }],
        take: q ? undefined : limit,
        include: taskSearchInclude
      }),
      prisma.user.findMany({
        where: q ? buildUserSearchWhere("") : buildUserSearchWhere(q),
        orderBy: { name: "asc" },
        take: q ? undefined : limit,
        select: {
          id: true,
          name: true,
          email: true
        }
      })
    ]);

    const mappedTasks: GlobalSearchTaskResult[] = tasks
      .filter((task) => taskMatchesSearch(task, q))
      .slice(0, limit)
      .map(toGlobalSearchTask)
      .filter((task): task is GlobalSearchTaskResult => Boolean(task));

    const response: GlobalSearchResponse = {
      projects: projects.filter((project) => projectMatchesSearch(project, q)).slice(0, limit).map(toGlobalSearchProject),
      tasks: mappedTasks,
      users: users.filter((user) => userMatchesSearch(user, q)).slice(0, limit).map(toGlobalSearchUser)
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};
