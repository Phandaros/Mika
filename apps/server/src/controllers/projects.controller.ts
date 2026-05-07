import type { Prisma } from "../generated/prisma/client.js";
import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma.js";
import { DisciplineType, ProjectStatus, type DisciplineType as DisciplineTypeValue, type ProjectStatus as ProjectStatusValue } from "../lib/enums.js";
import { makeLocalAsanaGid, projectInclude, toProjectDto } from "../lib/asanaDto.js";
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
  disciplineTypes?: DisciplineTypeValue[];
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

async function syncProjectSections(
  tx: Prisma.TransactionClient,
  projectGid: string,
  disciplineTypes: DisciplineTypeValue[] | undefined
): Promise<void> {
  if (!disciplineTypes) {
    return;
  }

  const names = [...new Set(disciplineTypes)].map((type) => disciplineName(type));
  const existingSections = await tx.section.findMany({
    where: { projectGid },
    select: { id: true, name: true }
  });
  const selectedNameSet = new Set(names);
  const sectionsToRemove = existingSections.filter((section) => !selectedNameSet.has(section.name));

  if (sectionsToRemove.length > 0) {
    await tx.section.deleteMany({
      where: {
        id: {
          in: sectionsToRemove.map((section) => section.id)
        }
      }
    });
  }

  for (const name of names) {
    const existingSection = existingSections.find((section) => section.name === name);

    if (!existingSection) {
      await tx.section.create({
        data: {
          asanaGid: makeLocalAsanaGid("section"),
          projectGid,
          name
        }
      });
    }
  }
}

export const listProjects: RequestHandler = async (_req, res, next) => {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { updatedAt: "desc" },
      include: projectInclude
    });

    res.json({ projects: projects.map(toProjectDto) });
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

    res.json({ project: toProjectDto(project) });
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
          archived: body.status === ProjectStatus.COMPLETED || body.status === ProjectStatus.CANCELLED,
          startOn: firstDateOnly(body.startDate),
          dueOn: firstDateOnly(body.endDate),
          workspaceGid: await workspaceGid(tx)
        }
      });

      await syncProjectSections(tx, createdProject.asanaGid, body.disciplineTypes);

      return tx.project.findUniqueOrThrow({
        where: { id: createdProject.id },
        include: projectInclude
      });
    });

    res.status(201).json({ project: toProjectDto(project) });
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
          archived:
            body.status === undefined ? undefined : body.status === ProjectStatus.COMPLETED || body.status === ProjectStatus.CANCELLED,
          startOn: firstDateOnly(body.startDate),
          dueOn: firstDateOnly(body.endDate)
        }
      });

      await syncProjectSections(tx, updatedProject.asanaGid, body.disciplineTypes);

      return tx.project.findUniqueOrThrow({
        where: { id: req.params.id },
        include: projectInclude
      });
    });

    res.json({ project: toProjectDto(project) });
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

function disciplineName(type: DisciplineTypeValue): string {
  const labels: Record<DisciplineTypeValue, string> = {
    [DisciplineType.HYDRAULIC]: "Hidraulico",
    [DisciplineType.SANITARY]: "Sanitario",
    [DisciplineType.FIRE_PROTECTION]: "PPCI",
    [DisciplineType.SPRINKLER]: "Sprinkler",
    [DisciplineType.PRESSURIZED_STAIR]: "Escada Pressurizada",
    [DisciplineType.ELECTRICAL]: "Eletrico",
    [DisciplineType.SPDA]: "SPDA",
    [DisciplineType.TELECOM]: "Telecom",
    [DisciplineType.HVAC]: "Climatizacao",
    [DisciplineType.GAS]: "Gas",
    [DisciplineType.AUTOMATION]: "Automacao",
    [DisciplineType.EXHAUST]: "Exaustao",
    [DisciplineType.VACUUM]: "Aspiracao Central",
    [DisciplineType.OTHER]: "Outros"
  };

  return labels[type];
}
