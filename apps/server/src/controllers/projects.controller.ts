import type { Prisma } from "@prisma/client";
import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma.js";
import { ProjectStatus, type ProjectStatus as ProjectStatusValue } from "../lib/enums.js";
import { AppError } from "../middleware/errorHandler.js";

interface ProjectBody {
  name?: string;
  description?: string | null;
  client?: string | null;
  status?: ProjectStatusValue;
  startDate?: string | null;
  endDate?: string | null;
}

function dateValue(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  return value === null ? null : new Date(value);
}

const projectInclude = {
  disciplines: {
    include: {
      responsible: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          avatarUrl: true,
          isActive: true,
          createdAt: true,
          updatedAt: true
        }
      },
      tasks: {
        include: {
          assignee: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              avatarUrl: true,
              isActive: true,
              createdAt: true,
              updatedAt: true
            }
          },
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              avatarUrl: true,
              isActive: true,
              createdAt: true,
              updatedAt: true
            }
          }
        },
        orderBy: { createdAt: "desc" as const }
      }
    },
    orderBy: { createdAt: "asc" as const }
  }
} satisfies Prisma.ProjectInclude;

export const listProjects: RequestHandler = async (_req, res, next) => {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        disciplines: {
          include: { tasks: true }
        }
      }
    });

    res.json({ projects });
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

    res.json({ project });
  } catch (error) {
    next(error);
  }
};

export const createProject: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as Required<Pick<ProjectBody, "name">> & ProjectBody;

    const project = await prisma.project.create({
      data: {
        name: body.name,
        description: body.description,
        client: body.client,
        status: body.status ?? ProjectStatus.ACTIVE,
        startDate: dateValue(body.startDate),
        endDate: dateValue(body.endDate)
      },
      include: projectInclude
    });

    res.status(201).json({ project });
  } catch (error) {
    next(error);
  }
};

export const updateProject: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as ProjectBody;

    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: {
        name: body.name,
        description: body.description,
        client: body.client,
        status: body.status,
        startDate: dateValue(body.startDate),
        endDate: dateValue(body.endDate)
      },
      include: projectInclude
    });

    res.json({ project });
  } catch (error) {
    next(error);
  }
};

export const deleteProject: RequestHandler = async (req, res, next) => {
  try {
    await prisma.project.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
