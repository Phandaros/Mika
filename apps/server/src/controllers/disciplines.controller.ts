import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma.js";
import { makeLocalAsanaGid, taskInclude, toDisciplineDto } from "../lib/asanaDto.js";
import { AppError } from "../middleware/errorHandler.js";

interface DisciplineBody {
  name?: string;
}

export const listDisciplines: RequestHandler = async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.projectId },
      include: {
        sections: {
          include: {
            memberships: {
              include: {
                task: { include: taskInclude }
              }
            }
          },
          orderBy: { name: "asc" }
        }
      }
    });

    if (!project) {
      throw new AppError(404, "Project not found");
    }

    res.json({ disciplines: project.sections.map((section) => toDisciplineDto(section, project.id)) });
  } catch (error) {
    next(error);
  }
};

export const createDiscipline: RequestHandler = async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });

    if (!project) {
      throw new AppError(404, "Project not found");
    }

    const body = req.body as Required<Pick<DisciplineBody, "name">>;
    const section = await prisma.section.create({
      data: {
        asanaGid: makeLocalAsanaGid("section"),
        projectGid: project.asanaGid,
        name: body.name
      },
      include: { memberships: { include: { task: { include: taskInclude } } } }
    });

    res.status(201).json({ discipline: toDisciplineDto(section, project.id) });
  } catch (error) {
    next(error);
  }
};

export const updateDiscipline: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as DisciplineBody;
    const section = await prisma.section.update({
      where: { id: req.params.id },
      data: { name: body.name },
      include: {
        project: true,
        memberships: {
          include: {
            task: { include: taskInclude }
          }
        }
      }
    });

    res.json({ discipline: toDisciplineDto(section, section.project.id) });
  } catch (error) {
    next(error);
  }
};

export const deleteDiscipline: RequestHandler = async (req, res, next) => {
  try {
    await prisma.section.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
