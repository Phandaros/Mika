import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma.js";
import { makeLocalAsanaGid, taskInclude, toDisciplineDto } from "../lib/asanaDto.js";
import { AppError } from "../middleware/errorHandler.js";

interface SectionBody {
  name?: string;
}

export const listSections: RequestHandler = async (req, res, next) => {
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

    const sections = project.sections.map((section) => toDisciplineDto(section, project.id));
    res.json({ sections, disciplines: sections });
  } catch (error) {
    next(error);
  }
};

export const createSection: RequestHandler = async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });

    if (!project) {
      throw new AppError(404, "Project not found");
    }

    const body = req.body as Required<Pick<SectionBody, "name">>;
    const section = await prisma.section.create({
      data: {
        asanaGid: makeLocalAsanaGid("section"),
        projectGid: project.asanaGid,
        name: body.name
      },
      include: { memberships: { include: { task: { include: taskInclude } } } }
    });

    const dto = toDisciplineDto(section, project.id);
    res.status(201).json({ section: dto, discipline: dto });
  } catch (error) {
    next(error);
  }
};

export const updateSection: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as SectionBody;
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

    const dto = toDisciplineDto(section, section.project.id);
    res.json({ section: dto, discipline: dto });
  } catch (error) {
    next(error);
  }
};

export const deleteSection: RequestHandler = async (req, res, next) => {
  try {
    await prisma.section.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
