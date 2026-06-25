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

function projectCandidate(
  id: string,
  name: string,
  builder: string | null,
  values: Array<{
    customFieldGid: string;
    customFieldName: string | null;
    type: string;
    displayValue?: string | null;
    enumOptionName?: string | null;
    multiEnumValues?: Array<{ name: string; color?: string | null; gid?: string | null }> | null;
  }>
) {
  return {
    ...projectRow(id, name, builder),
    customFieldValues: values.map((value) => ({
      displayValue: null,
      enumOptionName: null,
      multiEnumValues: null,
      customField: null,
      ...value
    }))
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
          builder: true,
          customFieldValues: expect.any(Object)
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

  it("filtra Disciplinas contendo Sprinkler", async () => {
    const matchingProject = projectCandidate("project-sprinkler", "Torre Sul", "Construtora Sul", [
      {
        customFieldGid: "mika:portfolio:disciplinas",
        customFieldName: "Disciplinas",
        type: "multi_enum",
        multiEnumValues: [{ name: "Sprinkler" }, { name: "Elétrico" }]
      }
    ]);
    prismaMock.project.findMany
      .mockResolvedValueOnce([
        matchingProject,
        projectCandidate("project-ele", "Torre Norte", "Construtora Norte", [
          {
            customFieldGid: "mika:portfolio:disciplinas",
            customFieldName: "Disciplinas",
            type: "multi_enum",
            multiEnumValues: [{ name: "Elétrico" }]
          }
        ])
      ])
      .mockResolvedValueOnce([matchingProject]);
    const res = responseMock();

    await listPortfolioProjects(
      {
        query: {
          customFieldFilters: JSON.stringify([
            { fieldKey: "disciplinas", type: "multi_enum", operator: "containsAny", values: ["Sprinkler"] }
          ])
        }
      } as unknown as Request,
      res,
      next
    );

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        projects: [matchingProject],
        totalCount: 1
      })
    );
  });

  it("filtra Disciplinas contendo todos os valores selecionados", async () => {
    const matchingProject = projectCandidate("project-all", "Torre Sul", "Construtora Sul", [
      {
        customFieldGid: "mika:portfolio:disciplinas",
        customFieldName: "Disciplinas",
        type: "multi_enum",
        multiEnumValues: [{ name: "Sprinkler" }, { name: "Elétrico" }]
      }
    ]);
    prismaMock.project.findMany
      .mockResolvedValueOnce([
        matchingProject,
        projectCandidate("project-one", "Torre Norte", "Construtora Norte", [
          {
            customFieldGid: "mika:portfolio:disciplinas",
            customFieldName: "Disciplinas",
            type: "multi_enum",
            multiEnumValues: [{ name: "Sprinkler" }]
          }
        ])
      ])
      .mockResolvedValueOnce([matchingProject]);
    const res = responseMock();

    await listPortfolioProjects(
      {
        query: {
          customFieldFilters: JSON.stringify([
            { fieldKey: "disciplinas", type: "multi_enum", operator: "containsAll", values: ["Sprinkler", "Elétrico"] }
          ])
        }
      } as unknown as Request,
      res,
      next
    );

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ projects: [matchingProject], totalCount: 1 }));
  });

  it("filtra Disciplinas que não contêm nenhum valor selecionado", async () => {
    const matchingProject = projectCandidate("project-hid", "Torre Hid", "Construtora Sul", [
      {
        customFieldGid: "mika:portfolio:disciplinas",
        customFieldName: "Disciplinas",
        type: "multi_enum",
        multiEnumValues: [{ name: "Hidráulico" }]
      }
    ]);
    prismaMock.project.findMany
      .mockResolvedValueOnce([
        matchingProject,
        projectCandidate("project-sprinkler", "Torre Sprinkler", "Construtora Norte", [
          {
            customFieldGid: "mika:portfolio:disciplinas",
            customFieldName: "Disciplinas",
            type: "multi_enum",
            multiEnumValues: [{ name: "Sprinkler" }]
          }
        ])
      ])
      .mockResolvedValueOnce([matchingProject]);
    const res = responseMock();

    await listPortfolioProjects(
      {
        query: {
          customFieldFilters: JSON.stringify([
            { fieldKey: "disciplinas", type: "multi_enum", operator: "containsNone", values: ["Sprinkler"] }
          ])
        }
      } as unknown as Request,
      res,
      next
    );

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ projects: [matchingProject], totalCount: 1 }));
  });

  it("filtra campos em branco e não em branco", async () => {
    const blankProject = projectCandidate("project-blank", "Sem disciplina", "Construtora Sul", []);
    const filledProject = projectCandidate("project-filled", "Com disciplina", "Construtora Sul", [
      {
        customFieldGid: "mika:portfolio:disciplinas",
        customFieldName: "Disciplinas",
        type: "multi_enum",
        multiEnumValues: [{ name: "Sprinkler" }]
      }
    ]);
    prismaMock.project.findMany
      .mockResolvedValueOnce([blankProject, filledProject])
      .mockResolvedValueOnce([blankProject]);
    const res = responseMock();

    await listPortfolioProjects(
      {
        query: {
          customFieldFilters: JSON.stringify([{ fieldKey: "disciplinas", type: "multi_enum", operator: "isBlank" }])
        }
      } as unknown as Request,
      res,
      next
    );

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ projects: [blankProject], totalCount: 1 }));

    prismaMock.project.findMany
      .mockResolvedValueOnce([blankProject, filledProject])
      .mockResolvedValueOnce([filledProject]);
    const notBlankRes = responseMock();

    await listPortfolioProjects(
      {
        query: {
          customFieldFilters: JSON.stringify([{ fieldKey: "disciplinas", type: "multi_enum", operator: "isNotBlank" }])
        }
      } as unknown as Request,
      notBlankRes,
      next
    );

    expect(notBlankRes.json).toHaveBeenCalledWith(expect.objectContaining({ projects: [filledProject], totalCount: 1 }));
  });

  it("combina filtros custom com filtros estruturados e texto usando AND", async () => {
    const matchingProject = projectCandidate("project-approved", "Residencial Atlântico", "Construtora Ácme", [
      {
        customFieldGid: "mika:portfolio:eleAprov",
        customFieldName: "ELE APROV.",
        type: "enum",
        enumOptionName: "Aprovado",
        displayValue: "Aprovado"
      }
    ]);
    prismaMock.project.findMany
      .mockResolvedValueOnce([
        matchingProject,
        projectCandidate("project-todo", "Residencial Atlântico", "Construtora Ácme", [
          {
            customFieldGid: "mika:portfolio:eleAprov",
            customFieldName: "ELE APROV.",
            type: "enum",
            enumOptionName: "To Do",
            displayValue: "To Do"
          }
        ])
      ])
      .mockResolvedValueOnce([matchingProject]);
    const res = responseMock();

    await listPortfolioProjects(
      {
        query: {
          q: "atlantico",
          status: "ACTIVE",
          platform: "CAD",
          builder: "Construtora Ácme",
          customFieldFilters: JSON.stringify([
            { fieldKey: "eleAprov", type: "enum", operator: "isAnyOf", values: ["Aprovado"] }
          ])
        }
      } as unknown as Request,
      res,
      next
    );

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ projects: [matchingProject], totalCount: 1 }));
  });
});
