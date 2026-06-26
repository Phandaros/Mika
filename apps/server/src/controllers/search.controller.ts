import type { RequestHandler } from "express";
import type {
  AdvancedSearchCompletion,
  AdvancedSearchResponse,
  AdvancedSearchType,
  GlobalSearchResponse,
  GlobalSearchTaskResult
} from "shared";
import { z } from "zod";
import { Priority, ProjectStatus, TaskStatus } from "../lib/enums.js";
import { prisma } from "../lib/prisma.js";
import {
  buildAdvancedProjectSearchWhere,
  buildAdvancedTaskSearchWhere,
  buildProjectSearchWhere,
  buildTaskSearchWhere,
  buildUserSearchWhere,
  clampAdvancedSearchLimit,
  clampSearchLimit,
  normalizeSearchTerm,
  paginateSearchResults,
  parseAdvancedSearchPage,
  projectMatchesAdvancedStatus,
  projectMatchesSearch,
  shouldSearchBucket,
  taskSearchInclude,
  taskMatchesSearch,
  toAdvancedSearchProject,
  toAdvancedSearchTask,
  toAdvancedSearchUser,
  toGlobalSearchProject,
  toGlobalSearchTask,
  toGlobalSearchUser,
  userMatchesSearch
} from "../lib/globalSearch.js";
import { AppError } from "../middleware/errorHandler.js";

const advancedSearchTypeSchema = z.enum(["all", "tasks", "projects", "users"]);
const advancedSearchCompletionSchema = z.enum(["open", "completed", "all"]);
const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const advancedSearchQuerySchema = z.object({
  q: z.string().optional(),
  type: advancedSearchTypeSchema.optional(),
  page: z.union([z.string(), z.number()]).optional(),
  limit: z.union([z.string(), z.number()]).optional(),
  projectId: z.string().optional(),
  status: z.union([z.string(), z.array(z.string())]).optional(),
  assigneeId: z.string().optional(),
  priority: z.union([z.string(), z.array(z.string())]).optional(),
  dueFrom: dateOnlySchema.optional(),
  dueTo: dateOnlySchema.optional(),
  completion: advancedSearchCompletionSchema.optional()
});

export const globalSearch: RequestHandler = async (req, res, next) => {
  try {
    const q = normalizeSearchTerm(req.query.q);
    const limit = clampSearchLimit(req.query.limit);
    const projectId = normalizeSearchTerm(req.query.projectId) || undefined;

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
      .map((task) => toGlobalSearchTask(task, projectId))
      .filter((task): task is GlobalSearchTaskResult => Boolean(task));
    const sortedTasks = projectId
      ? mappedTasks.sort((a, b) => {
          const projectDiff = Number(b.projectId === projectId) - Number(a.projectId === projectId);

          if (projectDiff !== 0) {
            return projectDiff;
          }

          return a.title.localeCompare(b.title, "pt-BR");
        })
      : mappedTasks;

    const response: GlobalSearchResponse = {
      projects: projects.filter((project) => projectMatchesSearch(project, q)).slice(0, limit).map(toGlobalSearchProject),
      tasks: sortedTasks.slice(0, limit),
      users: users.filter((user) => userMatchesSearch(user, q)).slice(0, limit).map(toGlobalSearchUser)
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

export const advancedSearch: RequestHandler = async (req, res, next) => {
  try {
    const parsed = advancedSearchQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      throw new AppError(400, "Parametros de busca invalidos", parsed.error.flatten());
    }

    const q = normalizeSearchTerm(parsed.data.q);
    const type: AdvancedSearchType = parsed.data.type ?? "all";
    const page = parseAdvancedSearchPage(parsed.data.page);
    const limit = clampAdvancedSearchLimit(parsed.data.limit);
    const statusValues = queryStringArray(parsed.data.status);
    const priorityValues = queryStringArray(parsed.data.priority);
    const allowedStatuses = new Set<string>([...Object.values(TaskStatus), ...Object.values(ProjectStatus)]);
    const allowedPriorities = new Set<string>(Object.values(Priority));
    const invalidStatuses = statusValues.filter((value) => !allowedStatuses.has(value));
    const invalidPriorities = priorityValues.filter((value) => !allowedPriorities.has(value));

    if (invalidStatuses.length > 0 || invalidPriorities.length > 0) {
      throw new AppError(400, "Filtros de busca invalidos", {
        status: invalidStatuses,
        priority: invalidPriorities
      });
    }

    const taskStatuses = statusValues.filter((value): value is TaskStatus =>
      Object.values(TaskStatus).includes(value as TaskStatus)
    );
    const projectStatuses = statusValues.filter((value): value is ProjectStatus =>
      Object.values(ProjectStatus).includes(value as ProjectStatus)
    );
    const priorities = priorityValues.filter((value): value is Priority =>
      Object.values(Priority).includes(value as Priority)
    );
    const completion: AdvancedSearchCompletion = parsed.data.completion ?? "open";

    const [projects, tasks, users] = await Promise.all([
      shouldSearchBucket(type, "projects")
        ? prisma.project.findMany({
            where: buildAdvancedProjectSearchWhere({
              term: q,
              projectStatuses,
              projectId: parsed.data.projectId
            }),
            orderBy: [{ name: "asc" }, { updatedAt: "desc" }],
            select: {
              id: true,
              name: true,
              builder: true,
              archived: true,
              platform: true,
              dueOn: true,
              dueDate: true,
              updatedAt: true,
              team: { select: { name: true } },
              workspace: { select: { name: true } }
            }
          })
        : Promise.resolve([]),
      shouldSearchBucket(type, "tasks")
        ? prisma.task.findMany({
            where: buildAdvancedTaskSearchWhere({
              term: q,
              projectId: parsed.data.projectId,
              taskStatuses,
              priorities,
              assigneeId: parsed.data.assigneeId,
              dueFrom: parsed.data.dueFrom,
              dueTo: parsed.data.dueTo,
              completion
            }),
            orderBy: [{ name: "asc" }, { updatedAt: "desc" }],
            include: taskSearchInclude
          })
        : Promise.resolve([]),
      shouldSearchBucket(type, "users")
        ? prisma.user.findMany({
            where: buildUserSearchWhere(q),
            orderBy: { name: "asc" },
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          })
        : Promise.resolve([])
    ]);

    const taskItems = tasks
      .filter((task) => taskMatchesSearch(task, q))
      .map(toAdvancedSearchTask)
      .filter((task): task is NonNullable<typeof task> => Boolean(task));
    const projectItems = projects
      .filter((project) => projectMatchesSearch(project, q) && projectMatchesAdvancedStatus(project, projectStatuses))
      .map(toAdvancedSearchProject);
    const userItems = users
      .filter((user) => userMatchesSearch(user, q))
      .map(toAdvancedSearchUser);

    const response: AdvancedSearchResponse = {
      type,
      tasks: {
        items: paginateSearchResults(taskItems, page, limit),
        total: taskItems.length,
        page,
        limit
      },
      projects: {
        items: paginateSearchResults(projectItems, page, limit),
        total: projectItems.length,
        page,
        limit
      },
      users: {
        items: paginateSearchResults(userItems, page, limit),
        total: userItems.length,
        page,
        limit
      }
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

function queryStringArray(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}
