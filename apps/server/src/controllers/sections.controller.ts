import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma.js";
import { taskCustomFieldCatalogInclude, taskInclude, toDisciplineDto } from "../lib/asanaDto.js";
import { isCanonicalSectionName } from "../lib/canonicalSections.js";
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

    const taskFieldCatalog = await prisma.asanaCustomField.findMany({
      where: { mikaTaskField: true },
      include: taskCustomFieldCatalogInclude,
      orderBy: [{ mikaSortOrder: "asc" }, { name: "asc" }]
    });
    const sections = project.sections
      .filter((section) => isCanonicalSectionName(section.name))
      .map((section) => toDisciplineDto(section, project.id, taskFieldCatalog));
    res.json({ sections, disciplines: sections });
  } catch (error) {
    next(error);
  }
};

export const createSection: RequestHandler = async (req, res, next) => {
  try {
    throw new AppError(409, "Projetos usam somente as secoes fixas Civil e Eletrico");
  } catch (error) {
    next(error);
  }
};

export const updateSection: RequestHandler = async (req, res, next) => {
  try {
    const section = await prisma.section.findUnique({
      where: { id: req.params.id },
      include: {
        project: true,
        memberships: {
          include: {
            task: { include: taskInclude }
          }
        }
      }
    });

    if (!section) {
      throw new AppError(404, "Section not found");
    }

    const body = req.body as SectionBody;
    if (body.name !== undefined && body.name !== section.name) {
      throw new AppError(409, "As secoes fixas Civil e Eletrico nao podem ser renomeadas");
    }

    const taskFieldCatalog = await prisma.asanaCustomField.findMany({
      where: { mikaTaskField: true },
      include: taskCustomFieldCatalogInclude,
      orderBy: [{ mikaSortOrder: "asc" }, { name: "asc" }]
    });
    const dto = toDisciplineDto(section, section.project.id, taskFieldCatalog);
    res.json({ section: dto, discipline: dto });
  } catch (error) {
    next(error);
  }
};

export const deleteSection: RequestHandler = async (req, res, next) => {
  try {
    const section = await prisma.section.findUnique({ where: { id: req.params.id } });

    if (!section) {
      throw new AppError(404, "Section not found");
    }

    throw new AppError(409, "As secoes fixas Civil e Eletrico nao podem ser excluidas");
  } catch (error) {
    next(error);
  }
};
