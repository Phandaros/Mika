import type { Prisma } from "../generated/prisma/client.js";
import type { RequestHandler } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { ProjectStatus, type ProjectStatus as ProjectStatusValue } from "../lib/enums.js";
import {
  makeLocalAsanaGid,
  projectInclude,
  taskCustomFieldCatalogInclude,
  taskInclude,
  toProjectDto,
  toTaskDto
} from "../lib/asanaDto.js";
import { ensureCanonicalSectionsForProject } from "../lib/canonicalSections.js";
import { AppError } from "../middleware/errorHandler.js";

interface ProjectBody {
  name?: string;
  description?: string | null;
  client?: string | null;
  platform?: "CAD" | "BIM" | null;
  builder?: string | null;
  areaM2?: number | null;
  status?: ProjectStatusValue;
  startDate?: string | null;
  endDate?: string | null;
  disciplineTypes?: string[];
}

function firstDateOnly(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!value) {
    return null;
  }

  return value.slice(0, 10);
}

async function workspaceGid(tx: Prisma.TransactionClient): Promise<string> {
  const workspace = await tx.asanaWorkspace.findFirst({ orderBy: { name: "asc" } });

  if (workspace) {
    return workspace.asanaGid;
  }

  const createdWorkspace = await tx.asanaWorkspace.create({
    data: {
      asanaGid: makeLocalAsanaGid("workspace"),
      name: "MK Engenharia"
    }
  });

  return createdWorkspace.asanaGid;
}

export const listProjects: RequestHandler = async (_req, res, next) => {
  try {
    const [projects, taskFieldCatalog] = await Promise.all([
      prisma.project.findMany({
        orderBy: { updatedAt: "desc" },
        include: projectInclude
      }),
      prisma.asanaCustomField.findMany({
        where: { mikaTaskField: true },
        include: taskCustomFieldCatalogInclude,
        orderBy: [{ mikaSortOrder: "asc" }, { name: "asc" }]
      })
    ]);

    res.json({ projects: projects.map((project) => toProjectDto(project, taskFieldCatalog)) });
  } catch (error) {
    next(error);
  }
};

const workloadTasksQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  includeUndated: z
    .string()
    .optional()
    .transform((value) => value !== "false")
});

const workloadTaskInclude = {
  assignee: taskInclude.assignee,
  memberships: {
    include: {
      section: {
        include: {
          project: true
        }
      },
      project: true
    }
  },
  customFieldValues: taskInclude.customFieldValues,
  tags: taskInclude.tags
} satisfies Prisma.TaskInclude;

type WorkloadTaskRecord = Prisma.TaskGetPayload<{ include: typeof workloadTaskInclude }>;

function dueAtDayString(value: Date | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return value.toISOString().slice(0, 10);
}

function taskTimelineBounds(task: Pick<WorkloadTaskRecord, "startOn" | "dueOn" | "dueAt">): { start: string; end: string } | null {
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

function resolveWorkloadDisciplineFallback(
  task: WorkloadTaskRecord,
  project: { id: string; asanaGid: string }
): { id: string; name: string; projectId: string } | undefined {
  for (const membership of task.memberships) {
    if (membership.section && membership.section.projectGid === project.asanaGid) {
      return {
        id: membership.section.id,
        name: membership.section.name,
        projectId: project.id
      };
    }
  }

  return undefined;
}

export const listWorkloadTasks: RequestHandler = async (req, res, next) => {
  try {
    const parsed = workloadTasksQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      throw new AppError(400, "Parametros from e to sao obrigatorios (YYYY-MM-DD)");
    }

    let { from, to } = parsed.data;
    const includeUndated = parsed.data.includeUndated;

    if (from > to) {
      const swap = from;
      from = to;
      to = swap;
    }

    if (calendarDaysInclusive(from, to) > 366) {
      throw new AppError(400, "Intervalo maximo de 366 dias");
    }

    const projectId = req.params.id;
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, asanaGid: true }
    });

    if (!project) {
      throw new AppError(404, "Project not found");
    }

    const tasks = await prisma.task.findMany({
      where: {
        parentId: null,
        memberships: {
          some: {
            OR: [{ project: { id: project.id } }, { section: { project: { id: project.id } } }]
          }
        }
      },
      include: workloadTaskInclude
    });

    const filtered = tasks.filter((task) => {
      const bounds = taskTimelineBounds(task);
      if (!bounds) {
        return includeUndated;
      }

      return rangeOverlaps(bounds, from, to);
    });

    const taskFieldCatalog = await prisma.asanaCustomField.findMany({
      where: { mikaTaskField: true },
      include: taskCustomFieldCatalogInclude,
      orderBy: [{ mikaSortOrder: "asc" }, { name: "asc" }]
    });
    const dtos = filtered
      .map((task) => toTaskDto(task, resolveWorkloadDisciplineFallback(task, project), taskFieldCatalog))
      .filter((task) => Boolean(task.discipline.id));

    res.json({ tasks: dtos });
  } catch (error) {
    next(error);
  }
};

export const getProjectById: RequestHandler = async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: projectInclude
    });

    if (!project) {
      throw new AppError(404, "Project not found");
    }

    const taskFieldCatalog = await prisma.asanaCustomField.findMany({
      where: { mikaTaskField: true },
      include: taskCustomFieldCatalogInclude,
      orderBy: [{ mikaSortOrder: "asc" }, { name: "asc" }]
    });

    res.json({ project: toProjectDto(project, taskFieldCatalog) });
  } catch (error) {
    next(error);
  }
};

export const createProject: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as Required<Pick<ProjectBody, "name">> & ProjectBody;

    const project = await prisma.$transaction(async (tx) => {
      const createdProject = await tx.project.create({
        data: {
          asanaGid: makeLocalAsanaGid("project"),
          name: body.name,
          notes: body.description,
          platform: body.platform,
          builder: body.builder ?? body.client,
          areaM2: body.areaM2,
          archived: body.status === ProjectStatus.COMPLETED || body.status === ProjectStatus.CANCELLED,
          startOn: firstDateOnly(body.startDate),
          dueOn: firstDateOnly(body.endDate),
          workspaceGid: await workspaceGid(tx)
        }
      });

      await ensureCanonicalSectionsForProject(tx, {
        id: createdProject.id,
        asanaGid: createdProject.asanaGid,
        name: createdProject.name
      });

      return tx.project.findUniqueOrThrow({
        where: { id: createdProject.id },
        include: projectInclude
      });
    });

    const taskFieldCatalog = await prisma.asanaCustomField.findMany({
      where: { mikaTaskField: true },
      include: taskCustomFieldCatalogInclude,
      orderBy: [{ mikaSortOrder: "asc" }, { name: "asc" }]
    });

    res.status(201).json({ project: toProjectDto(project, taskFieldCatalog) });
  } catch (error) {
    next(error);
  }
};

export const updateProject: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as ProjectBody;

    const project = await prisma.$transaction(async (tx) => {
      const updatedProject = await tx.project.update({
        where: { id: req.params.id },
        data: {
          name: body.name,
          notes: body.description,
          platform: body.platform,
          builder: body.builder ?? body.client,
          areaM2: body.areaM2,
          archived:
            body.status === undefined ? undefined : body.status === ProjectStatus.COMPLETED || body.status === ProjectStatus.CANCELLED,
          startOn: firstDateOnly(body.startDate),
          dueOn: firstDateOnly(body.endDate)
        }
      });

      await ensureCanonicalSectionsForProject(tx, {
        id: updatedProject.id,
        asanaGid: updatedProject.asanaGid,
        name: updatedProject.name
      });

      return tx.project.findUniqueOrThrow({
        where: { id: req.params.id },
        include: projectInclude
      });
    });

    const taskFieldCatalog = await prisma.asanaCustomField.findMany({
      where: { mikaTaskField: true },
      include: taskCustomFieldCatalogInclude,
      orderBy: [{ mikaSortOrder: "asc" }, { name: "asc" }]
    });

    res.json({ project: toProjectDto(project, taskFieldCatalog) });
  } catch (error) {
    next(error);
  }
};

export const deleteProject: RequestHandler = async (req, res, next) => {
  try {
    await prisma.project.update({ where: { id: req.params.id }, data: { archived: true } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
