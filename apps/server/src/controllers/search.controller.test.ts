import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  project: { findMany: vi.fn() },
  task: { findMany: vi.fn() },
  comment: { findMany: vi.fn() },
  user: { findMany: vi.fn() }
}));

vi.mock("../lib/prisma.js", () => ({ prisma: prismaMock }));

import { advancedSearch, globalSearch } from "./search.controller.js";

function responseMock() {
  return {
    json: vi.fn()
  } as unknown as Response;
}

function taskRecord(overrides: {
  id: string;
  name: string;
  notes?: string | null;
  comment?: string;
  completed?: boolean;
  completedAtAsana?: Date | null;
}) {
  return {
    id: overrides.id,
    name: overrides.name,
    notes: overrides.notes ?? null,
    mikaStatus: null,
    assigneeStatus: null,
    priority: "MEDIUM",
    assigneeGid: null,
    dueOn: null,
    dueAt: null,
    completedAtAsana: overrides.completedAtAsana ?? null,
    estimatedDays: null,
    estimatedTime: null,
    conclusionDays: null,
    completed: overrides.completed ?? false,
    updatedAt: new Date("2026-07-17T12:00:00.000Z"),
    assignee: null,
    comments: overrides.comment
      ? [{ content: overrides.comment, createdAt: new Date("2026-07-16T12:00:00.000Z") }]
      : [],
    memberships: [
      {
        sectionName: "Civil",
        projectName: "Projeto teste",
        section: {
          name: "Civil",
          project: { id: "project-1", name: "Projeto teste", archived: false }
        },
        project: null
      }
    ]
  };
}

describe("search controller", () => {
  const next = vi.fn() as NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.project.findMany.mockResolvedValue([]);
    prismaMock.comment.findMany.mockResolvedValue([]);
    prismaMock.user.findMany.mockResolvedValue([]);
  });

  it("finds and contextualizes a global-search task by description", async () => {
    prismaMock.task.findMany.mockResolvedValue([
      taskRecord({ id: "task-description", name: "Tarefa sem o termo", notes: "Compatibilização hidráulica" })
    ]);
    const res = responseMock();

    await globalSearch(
      { query: { q: "compatibilizacao hidraulica" } } as unknown as Request,
      res,
      next
    );

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      tasks: [expect.objectContaining({
        id: "task-description",
        matchContext: { source: "description", excerpt: "Compatibilização hidráulica" }
      })]
    }));
  });

  it("searches comments and defaults advanced completion to all", async () => {
    prismaMock.comment.findMany.mockResolvedValue([
      { taskId: "task-open", content: "Revisar prancha pré-executiva", createdAt: new Date("2026-07-16T12:00:00.000Z") },
      { taskId: "task-completed", content: "Revisar prancha pré-executiva", createdAt: new Date("2026-07-16T12:00:00.000Z") }
    ]);
    prismaMock.task.findMany.mockResolvedValue([
      taskRecord({ id: "task-open", name: "Tarefa aberta", comment: "Revisar prancha pré-executiva" }),
      taskRecord({ id: "task-completed", name: "Tarefa concluída", comment: "Revisar prancha pré-executiva", completed: true })
    ]);
    const res = responseMock();

    await advancedSearch(
      { query: { q: "pre executiva", type: "tasks" } } as unknown as Request,
      res,
      next
    );

    expect(prismaMock.task.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: expect.not.arrayContaining([{ completed: false }, { completed: true }])
      })
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      tasks: expect.objectContaining({
        total: 2,
        items: expect.arrayContaining([
          expect.objectContaining({ matchContext: { source: "comment", excerpt: "Revisar prancha pré-executiva" } })
        ])
      })
    }));
  });

  it("keeps explicit open completion filtering", async () => {
    prismaMock.task.findMany.mockResolvedValue([]);
    const res = responseMock();

    await advancedSearch(
      { query: { type: "tasks", completion: "open" } } as unknown as Request,
      res,
      next
    );

    expect(prismaMock.task.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ AND: expect.arrayContaining([{ completed: false }]) })
    }));
  });

  it("sorts task results before pagination", async () => {
    prismaMock.task.findMany.mockResolvedValue([
      taskRecord({ id: "missing", name: "Sem conclusão" }),
      taskRecord({ id: "older", name: "Conclusão antiga", completedAtAsana: new Date("2026-06-01T12:00:00.000Z") }),
      taskRecord({ id: "newer", name: "Conclusão recente", completedAtAsana: new Date("2026-07-01T12:00:00.000Z") })
    ]);
    const res = responseMock();

    await advancedSearch(
      { query: { type: "tasks", sort: "completedAt-desc", page: "1", limit: "2" } } as unknown as Request,
      res,
      next
    );

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      tasks: expect.objectContaining({
        total: 3,
        items: [expect.objectContaining({ id: "newer" }), expect.objectContaining({ id: "older" })]
      })
    }));
  });

  it("loads task comments in SQLite-safe batches", async () => {
    prismaMock.task.findMany.mockResolvedValue(
      Array.from({ length: 401 }, (_, index) => taskRecord({ id: `task-${index}`, name: `Tarefa ${index}` }))
    );
    const res = responseMock();

    await globalSearch(
      { query: { q: "termo ausente" } } as unknown as Request,
      res,
      next
    );

    expect(prismaMock.comment.findMany).toHaveBeenCalledTimes(2);
    const batchSizes = prismaMock.comment.findMany.mock.calls.map((call) => call[0].where.taskId.in.length);
    expect(batchSizes).toEqual([400, 1]);
    expect(next).not.toHaveBeenCalled();
  });
});
