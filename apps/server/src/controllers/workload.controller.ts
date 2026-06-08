import type { Prisma } from "../generated/prisma/client.js";
import type { RequestHandler } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { taskCustomFieldCatalogInclude, taskInclude, toTaskDto } from "../lib/asanaDto.js";
import { AppError } from "../middleware/errorHandler.js";
import { parseWorkloadScope, sectionMatchesWorkloadScope, type WorkloadScope } from "../lib/workloadScope.js";

const globalWorkloadQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scope: z.enum(["general", "civil", "electrical"]).optional().default("general"),
  includeUndated: z
    .string()
    .optional()
    .transform((value) => value !== "false")
});

const globalWorkloadTaskInclude = {
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

type GlobalWorkloadTaskRecord = Prisma.TaskGetPayload<{ include: typeof globalWorkloadTaskInclude }>;

function dueAtDayString(value: Date | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return value.toISOString().slice(0, 10);
}

function taskTimelineBounds(task: Pick<GlobalWorkloadTaskRecord, "startOn" | "dueOn" | "dueAt">): { start: string; end: string } | null {
  const start = task.startOn?.slice(0, 10) ?? null;
  const dueOn = task.dueOn?.slice(0, 10) ?? null;
  const dueFromAt = dueAtDayString(task.dueAt);
  const effectiveStart = start ?? dueOn ?? dueFromAt;
  const effectiveEnd = dueOn ?? dueFromAt ?? start;

  if (!effectiveStart) {
    return null;
  }

  const end = effectiveEnd ?? effectiveStart;
  const orderedStart = effectiveStart <= end ? effectiveStart : end;
  const orderedEnd = effectiveStart <= end ? end : effectiveStart;
  return { start: orderedStart, end: orderedEnd };
}

function calendarDaysInclusive(from: string, to: string): number {
  const start = new Date(`${from}T12:00:00.000Z`).getTime();
  const end = new Date(`${to}T12:00:00.000Z`).getTime();
  return Math.floor(Math.abs(end - start) / 86400000) + 1;
}

function rangeOverlaps(bounds: { start: string; end: string }, from: string, to: string): boolean {
  return !(bounds.end < from || bounds.start > to);
}

function taskHasActiveProjectMembership(task: GlobalWorkloadTaskRecord): boolean {
  if (task.memberships.length === 0) {
    return true;
  }

  return task.memberships.some((m) => {
    const proj = m.section?.project ?? m.project;
    return Boolean(proj && !proj.archived);
  });
}

function taskMatchesScope(task: GlobalWorkloadTaskRecord, scope: WorkloadScope): boolean {
  if (scope === "general") {
    if (task.memberships.length === 0) {
      return true;
    }

    return task.memberships.some((m) => {
      const proj = m.section?.project ?? m.project;
      return Boolean(proj && !proj.archived);
    });
  }

  return task.memberships.some((m) => {
    const proj = m.section?.project ?? m.project;
    if (!proj || proj.archived) {
      return false;
    }

    return Boolean(m.section && sectionMatchesWorkloadScope(m.section.name, scope));
  });
}

function resolveGlobalWorkloadFallback(task: GlobalWorkloadTaskRecord): { id: string; name: string; projectId: string; projectName: string } | null {
  for (const membership of task.memberships) {
    const project = membership.section?.project ?? membership.project;
    if (!project || project.archived) {
      continue;
    }

    if (!membership.section) {
      continue;
    }

    return {
      id: membership.section.id,
      name: membership.section.name,
      projectId: project.id,
      projectName: project.name
    };
  }

  return null;
}

export const listGlobalWorkloadTasks: RequestHandler = async (req, res, next) => {
  try {
    const parsed = globalWorkloadQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      throw new AppError(400, "Parametros from e to sao obrigatorios (YYYY-MM-DD)");
    }

    let { from, to } = parsed.data;
    const includeUndated = parsed.data.includeUndated;
    const scope = parseWorkloadScope(parsed.data.scope);

    if (from > to) {
      const swap = from;
      from = to;
      to = swap;
    }

    if (calendarDaysInclusive(from, to) > 366) {
      throw new AppError(400, "Intervalo maximo de 366 dias");
    }

    const tasks = await prisma.task.findMany({
      where: {
        parentId: null,
        ...(scope === "general"
          ? {
              OR: [
                { memberships: { none: {} } },
                { memberships: { some: { OR: [{ project: { archived: false } }, { section: { project: { archived: false } } }] } } }
              ]
            }
          : {
              memberships: {
                some: {
                  OR: [{ project: { archived: false } }, { section: { project: { archived: false } } }]
                }
              }
            })
      },
      include: globalWorkloadTaskInclude
    });
    const taskFieldCatalog = await prisma.asanaCustomField.findMany({
      where: { mikaTaskField: true },
      include: taskCustomFieldCatalogInclude,
      orderBy: [{ mikaSortOrder: "asc" }, { name: "asc" }]
    });

    const filtered = tasks.filter((task) => {
      if (!taskHasActiveProjectMembership(task)) {
        return false;
      }

      if (!taskMatchesScope(task, scope)) {
        return false;
      }

      const bounds = taskTimelineBounds(task);
      if (!bounds) {
        return includeUndated;
      }

      return rangeOverlaps(bounds, from, to);
    });

    const dtos = filtered
      .map((task) => {
        const fallback = resolveGlobalWorkloadFallback(task);
        return toTaskDto(task, fallback ?? undefined, taskFieldCatalog);
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    res.json({ tasks: dtos });
  } catch (error) {
    next(error);
  }
};
