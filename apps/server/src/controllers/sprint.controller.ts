import type { Prisma } from "../generated/prisma/client.js";
import type { RequestHandler } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { taskCustomFieldCatalogInclude, taskInclude, toTaskDto } from "../lib/asanaDto.js";
import { TaskStatus, type TaskStatus as TaskStatusValue } from "../lib/enums.js";
import { excludeBacklogWhere, normalizedStatusWhere } from "../lib/taskStatusWhere.js";
import { sectionMatchesWorkloadScope, type WorkloadScope } from "../lib/workloadScope.js";
import { AppError } from "../middleware/errorHandler.js";

const SPRINT_TASK_LIMIT_DEFAULT = 25;
const SPRINT_TASK_LIMIT_MAX = 50;

const taskStatusValues = [
  TaskStatus.TODO,
  TaskStatus.ON_SCHEDULE,
  TaskStatus.OVERDUE,
  TaskStatus.IN_PROGRESS,
  TaskStatus.AWAITING_REVIEW,
  TaskStatus.IN_ANALYSIS,
  TaskStatus.AWAITING_DEFINITION,
  TaskStatus.FINISHED
] as const;

const sprintTasksQuerySchema = z.object({
  scope: z.enum(["civil", "electrical"]),
  status: z.enum(taskStatusValues),
  limit: z.coerce.number().int().min(1).max(SPRINT_TASK_LIMIT_MAX).optional().default(SPRINT_TASK_LIMIT_DEFAULT),
  cursor: z.string().optional()
});

const sprintSummaryQuerySchema = z.object({
  scope: z.enum(["civil", "electrical"])
});

const sprintTaskInclude = {
  assignee: taskInclude.assignee,
  memberships: {
    include: {
      section: {
        include: {
          project: { select: { id: true, name: true, asanaGid: true, archived: true } }
        }
      },
      project: { select: { id: true, name: true, asanaGid: true, archived: true } }
    }
  },
  customFieldValues: taskInclude.customFieldValues,
  tags: taskInclude.tags
} satisfies Prisma.TaskInclude;

type SprintTaskRecord = Prisma.TaskGetPayload<{ include: typeof sprintTaskInclude }>;
type SprintCursor = {
  updatedAt: string;
  id: string;
};

function encodeCursor(task: Pick<SprintTaskRecord, "updatedAt" | "id">): string {
  const payload: SprintCursor = {
    updatedAt: task.updatedAt.toISOString(),
    id: task.id
  };

  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeCursor(value: string | undefined): SprintCursor | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<SprintCursor>;

    if (!parsed.updatedAt || !parsed.id || Number.isNaN(Date.parse(parsed.updatedAt))) {
      return null;
    }

    return {
      updatedAt: parsed.updatedAt,
      id: parsed.id
    };
  } catch {
    throw new AppError(400, "Cursor invalido");
  }
}

function sprintScopeWhere(scope: Exclude<WorkloadScope, "general">): Prisma.TaskWhereInput {
  const sectionName = scope === "electrical" ? "Elétrico" : "Civil";

  return {
    memberships: {
      some: {
        AND: [
          { OR: [{ project: { archived: false } }, { section: { project: { archived: false } } }] },
          { section: { name: sectionName } }
        ]
      }
    }
  };
}

function cursorWhere(cursor: SprintCursor | null): Prisma.TaskWhereInput {
  if (!cursor) {
    return {};
  }

  const updatedAt = new Date(cursor.updatedAt);

  return {
    OR: [
      { updatedAt: { lt: updatedAt } },
      {
        updatedAt,
        id: { lt: cursor.id }
      }
    ]
  };
}

function sprintBaseWhere(scope: Exclude<WorkloadScope, "general">, status?: TaskStatusValue, cursor?: SprintCursor | null): Prisma.TaskWhereInput {
  return {
    parentId: null,
    AND: [
      sprintScopeWhere(scope),
      excludeBacklogWhere(),
      ...(status ? [normalizedStatusWhere(status)] : []),
      ...(cursor ? [cursorWhere(cursor)] : [])
    ]
  };
}

function matchingActiveMembership(task: SprintTaskRecord, scope: WorkloadScope) {
  return task.memberships.find((membership) => {
    const project = membership.section?.project ?? membership.project;
    if (!project || project.archived) {
      return false;
    }

    return Boolean(membership.section && sectionMatchesWorkloadScope(membership.section.name, scope));
  });
}

export const listSprintTasks: RequestHandler = async (req, res, next) => {
  try {
    const parsed = sprintTasksQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      throw new AppError(400, "Parametros scope, status, limit ou cursor invalidos");
    }

    const { scope, status, limit } = parsed.data;
    const cursor = decodeCursor(parsed.data.cursor);
    const [tasks, taskFieldCatalog] = await Promise.all([
      prisma.task.findMany({
        where: sprintBaseWhere(scope, status, cursor),
        include: sprintTaskInclude,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: limit + 1
      }),
      prisma.asanaCustomField.findMany({
        where: { mikaTaskField: true },
        include: taskCustomFieldCatalogInclude,
        orderBy: [{ mikaSortOrder: "asc" }, { name: "asc" }]
      })
    ]);
    const pageTasks = tasks.slice(0, limit);
    const lastVisibleTask = pageTasks[pageTasks.length - 1];
    const nextCursor = tasks.length > limit && lastVisibleTask ? encodeCursor(lastVisibleTask) : null;

    const dtos = pageTasks
      .map((task) => {
        const membership = matchingActiveMembership(task, scope);
        const project = membership?.section?.project ?? membership?.project;

        if (!membership || !project) {
          return null;
        }

        return toTaskDto(
          task,
          {
            id: membership.section?.id ?? "",
            name: membership.section?.name ?? "",
            projectId: project.id,
            projectName: project.name
          },
          taskFieldCatalog
        );
      })
      .filter((task): task is NonNullable<typeof task> => task !== null);

    res.json({ tasks: dtos, nextCursor });
  } catch (error) {
    next(error);
  }
};

export const getSprintSummary: RequestHandler = async (req, res, next) => {
  try {
    const parsed = sprintSummaryQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      throw new AppError(400, "Parametro scope deve ser civil ou electrical");
    }

    const scope = parsed.data.scope;
    const counts = await Promise.all(
      taskStatusValues.map(async (status) => ({
        status,
        count: await prisma.task.count({
          where: sprintBaseWhere(scope, status)
        })
      }))
    );
    const byStatus = Object.fromEntries(counts.map((item) => [item.status, item.count])) as Record<TaskStatusValue, number>;
    const total = counts.reduce((sum, item) => sum + item.count, 0);
    const completed = byStatus[TaskStatus.FINISHED] ?? 0;

    res.json({
      total,
      active: total - completed,
      completed,
      byStatus
    });
  } catch (error) {
    next(error);
  }
};
