import type { Prisma } from "../generated/prisma/client.js";
import type { RequestHandler } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { ProjectStatus, type ProjectStatus as ProjectStatusValue } from "../lib/enums.js";
import {
  makeLocalAsanaGid,
  projectInclude,
  projectPortfolioInclude,
  taskCustomFieldCatalogInclude,
  taskInclude,
  toProjectDto,
  toProjectPortfolioDto,
  toTaskDto
} from "../lib/asanaDto.js";
import { ensureCanonicalSectionsForProject } from "../lib/canonicalSections.js";
import {
  applyProjectCustomFieldPatches,
  type ProjectCustomFieldPatch
} from "../lib/projectCustomFields.js";
import { isBacklogTask } from "../lib/taskStatusWhere.js";
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
  customFieldValues?: ProjectCustomFieldPatch[];
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

const PORTFOLIO_LIMIT_DEFAULT = 25;
const PORTFOLIO_LIMIT_MAX = 50;
const PORTFOLIO_SORT_VALUES = ["updatedAt-desc", "name-asc", "endDate-asc"] as const;
const PORTFOLIO_PLATFORM_VALUES = ["CAD", "BIM", "none"] as const;

const portfolioProjectsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(PORTFOLIO_LIMIT_MAX).optional().default(PORTFOLIO_LIMIT_DEFAULT),
  cursor: z.string().optional(),
  sort: z.enum(PORTFOLIO_SORT_VALUES).optional().default("updatedAt-desc"),
  status: z.union([z.string(), z.array(z.string())]).optional(),
  platform: z.union([z.string(), z.array(z.string())]).optional(),
  builder: z.union([z.string(), z.array(z.string())]).optional()
});

type PortfolioSort = (typeof PORTFOLIO_SORT_VALUES)[number];

type PortfolioCursor = {
  sort: PortfolioSort;
  id: string;
  updatedAt?: string;
  name?: string;
  endDate?: string | null;
};

function queryStringArray(value: string | string[] | undefined): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  return Array.isArray(value) ? value : [value];
}

function encodePortfolioCursor(project: {
  id: string;
  updatedAt: Date;
  name: string;
  dueOn: string | null;
  dueDate: string | Date | null;
}, sort: PortfolioSort): string {
  const payload: PortfolioCursor = {
    sort,
    id: project.id,
    updatedAt: project.updatedAt.toISOString(),
    name: project.name,
    endDate:
      project.dueOn ??
      (project.dueDate instanceof Date ? project.dueDate.toISOString().slice(0, 10) : project.dueDate) ??
      null
  };

  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodePortfolioCursor(value: string | undefined): PortfolioCursor | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<PortfolioCursor>;

    if (!parsed.sort || !parsed.id || !PORTFOLIO_SORT_VALUES.includes(parsed.sort as PortfolioSort)) {
      return null;
    }

    return {
      sort: parsed.sort as PortfolioSort,
      id: parsed.id,
      updatedAt: parsed.updatedAt,
      name: parsed.name,
      endDate: parsed.endDate ?? null
    };
  } catch {
    throw new AppError(400, "Cursor invalido");
  }
}

function portfolioStatusWhere(statuses: string[] | undefined): Prisma.ProjectWhereInput {
  const allStatuses = Object.values(ProjectStatus);

  if (statuses !== undefined && statuses.length === 0) {
    return { id: { in: [] } };
  }

  if (!statuses?.length || statuses.length >= allStatuses.length) {
    return {};
  }

  const archivedValues = new Set(
    statuses.map((status) => status !== ProjectStatus.ACTIVE)
  );

  if (archivedValues.size === 1) {
    return { archived: archivedValues.has(true) };
  }

  return {
    OR: statuses.map((status) => ({
      archived: status !== ProjectStatus.ACTIVE
    }))
  };
}

function portfolioPlatformWhere(platforms: string[] | undefined): Prisma.ProjectWhereInput {
  if (platforms !== undefined && platforms.length === 0) {
    return { id: { in: [] } };
  }

  if (!platforms?.length || platforms.length >= PORTFOLIO_PLATFORM_VALUES.length) {
    return {};
  }

  return {
    OR: platforms.map((platform) =>
      platform === "none" ? { platform: null } : { platform: platform as "CAD" | "BIM" }
    )
  };
}

function portfolioBuilderWhere(builders: string[] | undefined): Prisma.ProjectWhereInput {
  if (builders === undefined) {
    return {};
  }

  if (builders.length === 0) {
    return { id: { in: [] } };
  }

  return {
    OR: builders.map((builder) =>
      builder === "none"
        ? { OR: [{ builder: null }, { builder: "" }] }
        : { builder }
    )
  };
}

function buildPortfolioWhere(query: {
  status?: string[];
  platform?: string[];
  builder?: string[];
}): Prisma.ProjectWhereInput {
  const clauses = [
    portfolioStatusWhere(query.status),
    portfolioPlatformWhere(query.platform),
    portfolioBuilderWhere(query.builder)
  ].filter((clause) => Object.keys(clause).length > 0);

  return clauses.length ? { AND: clauses } : {};
}

function portfolioCursorWhere(cursor: PortfolioCursor | null, sort: PortfolioSort): Prisma.ProjectWhereInput {
  if (!cursor || cursor.sort !== sort) {
    return {};
  }

  if (sort === "name-asc" && cursor.name) {
    return {
      OR: [{ name: { gt: cursor.name } }, { name: cursor.name, id: { gt: cursor.id } }]
    };
  }

  if (sort === "endDate-asc") {
    const endDate = cursor.endDate ?? "9999-12-31";
    return {
      OR: [
        { dueOn: { gt: endDate } },
        { dueOn: endDate, id: { gt: cursor.id } },
        { dueOn: null, id: { gt: cursor.id } }
      ]
    };
  }

  if (!cursor.updatedAt) {
    return {};
  }

  const updatedAt = new Date(cursor.updatedAt);
  return {
    OR: [{ updatedAt: { lt: updatedAt } }, { updatedAt, id: { lt: cursor.id } }]
  };
}

function portfolioOrderBy(sort: PortfolioSort): Prisma.ProjectOrderByWithRelationInput[] {
  if (sort === "name-asc") {
    return [{ name: "asc" }, { id: "asc" }];
  }

  if (sort === "endDate-asc") {
    return [{ dueOn: { sort: "asc", nulls: "last" } }, { id: "asc" }];
  }

  return [{ updatedAt: "desc" }, { id: "desc" }];
}

async function loadTaskFieldCatalog() {
  return prisma.asanaCustomField.findMany({
    where: { mikaTaskField: true },
    include: taskCustomFieldCatalogInclude,
    orderBy: [{ mikaSortOrder: "asc" }, { name: "asc" }]
  });
}

export const listPortfolioFacets: RequestHandler = async (_req, res, next) => {
  try {
    const rows = await prisma.project.findMany({
      where: { builder: { not: null } },
      select: { builder: true },
      distinct: ["builder"]
    });

    const builders = rows
      .map((row) => row.builder?.trim())
      .filter((builder): builder is string => Boolean(builder))
      .sort((a, b) => a.localeCompare(b, "pt-BR"));

    res.json({ builders });
  } catch (error) {
    next(error);
  }
};

export const listPortfolioProjects: RequestHandler = async (req, res, next) => {
  try {
    const parsed = portfolioProjectsQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      throw new AppError(400, "Parametros de portfólio invalidos");
    }

    const sort = parsed.data.sort;
    const cursor = decodePortfolioCursor(parsed.data.cursor);
    const filters = {
      status: queryStringArray(parsed.data.status),
      platform: queryStringArray(parsed.data.platform),
      builder: queryStringArray(parsed.data.builder)
    };
    const where = {
      AND: [buildPortfolioWhere(filters), portfolioCursorWhere(cursor, sort)]
    };

    const [totalCount, projects, taskFieldCatalog] = await Promise.all([
      prisma.project.count({ where: buildPortfolioWhere(filters) }),
      prisma.project.findMany({
        where,
        include: projectPortfolioInclude,
        orderBy: portfolioOrderBy(sort),
        take: parsed.data.limit + 1
      }),
      loadTaskFieldCatalog()
    ]);

    let pageProjects = projects.slice(0, parsed.data.limit);

    const lastVisibleProject = pageProjects[pageProjects.length - 1];
    const nextCursor =
      projects.length > parsed.data.limit && lastVisibleProject
        ? encodePortfolioCursor(lastVisibleProject, sort)
        : null;

    res.json({
      projects: pageProjects.map((project) => toProjectPortfolioDto(project, taskFieldCatalog)),
      nextCursor,
      totalCount
    });
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
        return includeUndated && !isBacklogTask(task);
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
    const projectId = req.params.id;
    if (!projectId) {
      throw new AppError(400, "Project id is required");
    }

    const body = req.body as ProjectBody;

    const project = await prisma.$transaction(async (tx) => {
      const updatedProject = await tx.project.update({
        where: { id: projectId },
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

      if (body.customFieldValues?.length) {
        await applyProjectCustomFieldPatches(tx, projectId, body.customFieldValues);
      }

      return tx.project.findUniqueOrThrow({
        where: { id: projectId },
        include: projectPortfolioInclude
      });
    });

    const taskFieldCatalog = await prisma.asanaCustomField.findMany({
      where: { mikaTaskField: true },
      include: taskCustomFieldCatalogInclude,
      orderBy: [{ mikaSortOrder: "asc" }, { name: "asc" }]
    });

    res.json({ project: toProjectPortfolioDto(project, taskFieldCatalog) });
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
