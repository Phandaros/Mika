import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  project: {
    count: vi.fn(),
    findMany: vi.fn()
  },
  asanaCustomField: {
    findMany: vi.fn()
  }
}));

vi.mock("../lib/prisma.js", () => ({ prisma: prismaMock }));
vi.mock("../lib/asanaDto.js", () => ({
  makeLocalAsanaGid: vi.fn(),
  projectInclude: {},
  projectOptionsInclude: {},
  projectPortfolioInclude: {},
  taskCustomFieldCatalogInclude: {},
  taskInclude: {
    assignee: {},
    customFieldValues: {},
    tags: {},
    requestedReviews: {}
  },
  toProjectDto: vi.fn(),
  toProjectOptionDto: vi.fn(),
  toProjectPortfolioDto: (project: unknown) => project,
  toTaskDto: vi.fn()
}));
vi.mock("../lib/canonicalSections.js", () => ({
  ensureCanonicalSectionsForProject: vi.fn()
}));
vi.mock("../lib/projectCustomFields.js", () => ({
  applyProjectCustomFieldPatches: vi.fn()
}));
vi.mock("../lib/taskStatusWhere.js", () => ({
  excludeBacklogWhere: vi.fn(() => ({})),
  isBacklogTask: vi.fn(() => false)
}));

import { listPortfolioProjects } from "./projects.controller.js";

function responseMock() {
  return {
    json: vi.fn()
  } as unknown as Response;
}

function projectRow(id: string, name: string, builder: string | null) {
  return {
    id,
    name,
    builder,
    updatedAt: new Date("2026-06-19T12:00:00.000Z"),
    dueOn: null,
    dueDate: null
  };
}

describe("portfolio projects controller", () => {
  const next = vi.fn() as NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.asanaCustomField.findMany.mockResolvedValue([]);
  });

  it("mantém o fluxo paginado padrão quando o termo está vazio", async () => {
    prismaMock.project.count.mockResolvedValue(2);
    prismaMock.project.findMany.mockResolvedValue([
      projectRow("project-1", "Projeto A", "Construtora A")
    ]);
    const res = responseMock();

    await listPortfolioProjects(
      {
        query: { q: "   " }
      } as unknown as Request,
      res,
      next
    );

    expect(prismaMock.project.count).toHaveBeenCalledTimes(1);
    expect(prismaMock.project.findMany).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ totalCount: 2 })
    );
  });

  it("filtra nome ignorando acentos e caixa", async () => {
    const matchingProject = projectRow(
      "project-atlantico",
      "Residencial Atlântico",
      "Construtora Sul"
    );
    prismaMock.project.findMany
      .mockResolvedValueOnce([
        matchingProject,
        projectRow("project-serra", "Residencial Serra", "Construtora Norte")
      ])
      .mockResolvedValueOnce([matchingProject]);
    const res = responseMock();

    await listPortfolioProjects(
      {
        query: { q: "atlantico" }
      } as unknown as Request,
      res,
      next
    );

    const pageQuery = prismaMock.project.findMany.mock.calls[1]?.[0];
    expect(pageQuery).toEqual(
      expect.objectContaining({
        where: {
          AND: [
            {
              AND: [
                {},
                { id: { in: ["project-atlantico"] } }
              ]
            },
            {}
          ]
        }
      })
    );
    expect(prismaMock.project.count).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        projects: [matchingProject],
        totalCount: 1
      })
    );
  });

  it("filtra por construtora e combina com os filtros estruturados", async () => {
    const matchingProject = projectRow(
      "project-acme",
      "Edifício Central",
      "Construtora Ácme"
    );
    prismaMock.project.findMany
      .mockResolvedValueOnce([matchingProject])
      .mockResolvedValueOnce([matchingProject]);
    const res = responseMock();

    await listPortfolioProjects(
      {
        query: {
          q: "acme",
          status: "ACTIVE",
          platform: "CAD",
          builder: "Construtora Ácme"
        }
      } as unknown as Request,
      res,
      next
    );

    const candidateQuery = prismaMock.project.findMany.mock.calls[0]?.[0];
    expect(candidateQuery).toEqual(
      expect.objectContaining({
        where: {
          AND: [
            { archived: false },
            { OR: [{ platform: "CAD" }] },
            { OR: [{ builder: "Construtora Ácme" }] }
          ]
        },
        select: {
          id: true,
          name: true,
          builder: true
        }
      })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ totalCount: 1 })
    );
  });

  it("retorna contagem zero quando nenhum projeto corresponde", async () => {
    prismaMock.project.findMany
      .mockResolvedValueOnce([
        projectRow("project-1", "Residencial Serra", "Construtora Norte")
      ])
      .mockResolvedValueOnce([]);
    const res = responseMock();

    await listPortfolioProjects(
      {
        query: { q: "inexistente" }
      } as unknown as Request,
      res,
      next
    );

    expect(res.json).toHaveBeenCalledWith({
      projects: [],
      nextCursor: null,
      totalCount: 0
    });
  });
});
