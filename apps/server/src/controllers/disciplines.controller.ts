import type { RequestHandler } from "express";
import { DisciplineStatus, type DisciplineType } from "../lib/enums.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";

interface DisciplineBody {
  name?: string;
  type?: DisciplineType;
  status?: DisciplineStatus;
  responsibleId?: string | null;
}

const disciplineInclude = {
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
      }
    },
    orderBy: { createdAt: "desc" as const }
  }
};

export const listDisciplines: RequestHandler = async (req, res, next) => {
  try {
    const disciplines = await prisma.discipline.findMany({
      where: { projectId: req.params.projectId },
      orderBy: { createdAt: "asc" },
      include: disciplineInclude
    });

    res.json({ disciplines });
  } catch (error) {
    next(error);
  }
};

export const createDiscipline: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as Required<Pick<DisciplineBody, "name" | "type">> & DisciplineBody;

    const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });

    if (!project) {
      throw new AppError(404, "Project not found");
    }

    const discipline = await prisma.discipline.create({
      data: {
        projectId: req.params.projectId,
        name: body.name,
        type: body.type,
        status: body.status ?? DisciplineStatus.NOT_STARTED,
        responsibleId: body.responsibleId
      },
      include: disciplineInclude
    });

    res.status(201).json({ discipline });
  } catch (error) {
    next(error);
  }
};

export const updateDiscipline: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as DisciplineBody;

    const discipline = await prisma.discipline.update({
      where: { id: req.params.id },
      data: {
        name: body.name,
        type: body.type,
        status: body.status,
        responsibleId: body.responsibleId
      },
      include: disciplineInclude
    });

    res.json({ discipline });
  } catch (error) {
    next(error);
  }
};

export const deleteDiscipline: RequestHandler = async (req, res, next) => {
  try {
    await prisma.discipline.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
