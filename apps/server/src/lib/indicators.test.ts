import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeliveryStatus, TaskStatus } from "./enums.js";

const prismaMock = vi.hoisted(() => ({
  task: {
    findMany: vi.fn()
  },
  project: {
    findMany: vi.fn()
  }
}));

vi.mock("./prisma.js", () => ({ prisma: prismaMock }));

import { buildIndicators, normalizeIndicatorPeriod, normalizeIndicatorScope } from "./indicators.js";

type TestMembership = ReturnType<typeof membership>;

type TestTaskRecord = {
  id: string;
  completed: boolean;
  mikaStatus: string | null;
  assigneeStatus: string | null;
  dueOn: string | null;
  dueAt: Date | null;
  completedAtAsana: Date | null;
  estimatedDays: number | null;
  estimatedTime: number | null;
  conclusionDays: number | null;
  assignee: { id: string; name: string } | null;
  memberships: TestMembership[];
};

type TestProjectCustomFieldValue = {
  customFieldGid: string;
  customFieldName: string | null;
  displayValue: string | null;
  enumOptionName: string | null;
  multiEnumValues: Array<{ name: string }> | null;
  customField: { mikaKey: string | null; mikaLabel: string | null } | null;
};

type TestProjectRecord = {
  id: string;
  platform: string | null;
  areaM2: number | null;
  asanaCreatedAt: Date | null;
  createdAt: Date;
  customFieldValues: TestProjectCustomFieldValue[];
};

describe("indicator filters", () => {
  it("normalizes unknown period and scope to the default dashboard view", () => {
    expect(normalizeIndicatorPeriod("invalid")).toBe("month");
    expect(normalizeIndicatorScope("invalid")).toBe("general");
  });
});

describe("buildIndicators", () => {
  beforeEach(() => {
    prismaMock.task.findMany.mockReset();
    prismaMock.project.findMany.mockReset();
  });

  it("groups completed deliveries by assignee and delivery status", async () => {
    prismaMock.task.findMany.mockResolvedValue([
      taskRecord({
        id: "task-1",
        completed: true,
        completedAtAsana: new Date("2026-06-01T12:00:00.000Z"),
        estimatedDays: 2,
        conclusionDays: 3,
        assignee: null,
        memberships: []
      }),
      taskRecord({
        id: "task-2",
        completed: true,
        completedAtAsana: new Date("2026-06-02T12:00:00.000Z"),
        estimatedDays: 3,
        conclusionDays: 2,
        assignee: { id: "user-1", name: "Ana Projetista" },
        memberships: [membership("Civil")]
      }),
      taskRecord({
        id: "task-3",
        completed: true,
        completedAtAsana: new Date("2026-06-03T12:00:00.000Z"),
        estimatedDays: null,
        conclusionDays: 2,
        assignee: { id: "user-1", name: "Ana Projetista" },
        memberships: [membership("Civil")]
      })
    ]);
    prismaMock.project.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const data = await buildIndicators("all", "general");

    expect(data.tasks.kpis.completedTasks).toBe(3);
    expect(data.tasks.kpis.onTimeDeliveries).toBe(1);
    expect(data.tasks.kpis.lateDeliveries).toBe(1);
    expect(data.tasks.kpis.unclassifiedDeliveries).toBe(1);
    expect(data.tasks.kpis.onTimeRate).toBe(50);
    expect(data.tasks.deliveryDistribution.find((item) => item.key === DeliveryStatus.LATE)).toMatchObject({ value: 1 });
    expect(data.tasks.byUser.find((item) => item.userId === null)).toMatchObject({
      userName: "Sem responsável",
      lateDeliveries: 1
    });
  });

  it("filters delivery indicators by completion date", async () => {
    prismaMock.task.findMany.mockResolvedValue([]);
    prismaMock.project.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await buildIndicators("month", "general");

    expect(prismaMock.task.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        completed: true,
        completedAtAsana: expect.objectContaining({
          gte: expect.any(Date),
          lte: expect.any(Date)
        })
      })
    }));
  });

  it("computes portfolio discipline counts and projected area from catalog fields", async () => {
    prismaMock.task.findMany.mockResolvedValue([]);
    const project = projectRecord({
        id: "project-1",
        platform: "CAD",
        areaM2: 100,
        asanaCreatedAt: new Date("2025-03-01T00:00:00.000Z"),
        customFieldValues: [
          {
            customFieldGid: "mika:portfolio:disciplinas",
            customFieldName: "Disciplinas",
            displayValue: "Elétrico, Hidráulico",
            enumOptionName: null,
            multiEnumValues: [
              { name: "Elétrico" },
              { name: "Hidráulico" }
            ],
            customField: { mikaKey: "disciplinas", mikaLabel: "Disciplinas" }
          },
          {
            customFieldGid: "mika:portfolio:ppciGas",
            customFieldName: "PPCI / GÁS",
            displayValue: "Aprovado",
            enumOptionName: "Aprovado",
            multiEnumValues: null,
            customField: { mikaKey: "ppciGas", mikaLabel: "PPCI / GÁS" }
          }
        ]
      });
    prismaMock.project.findMany.mockResolvedValueOnce([project]).mockResolvedValueOnce([project]);

    const data = await buildIndicators("all", "general");

    expect(data.portfolio.kpis.totalProjects).toBe(1);
    expect(data.portfolio.kpis.areaM2).toBe(100);
    expect(data.portfolio.kpis.projectedAreaM2).toBe(200);
    expect(data.portfolio.byPlatform).toEqual([{ key: "CAD", label: "CAD", value: 1 }]);
    expect(data.portfolio.byDiscipline.map((item) => item.label).sort()).toEqual(["Elétrico", "Hidráulico"]);
    expect(data.portfolio.statusGroups.find((group) => group.fieldKey === "ppciGas")?.values[0]).toMatchObject({
      label: "Aprovado",
      value: 1
    });
    expect(data.availablePortfolioYears).toEqual(["2025"]);
  });

  it("filters portfolio indicators by Asana origin year with local createdAt fallback", async () => {
    prismaMock.task.findMany.mockResolvedValue([]);
    prismaMock.project.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      projectRecord({ id: "asana-year", asanaCreatedAt: new Date("2025-01-01T00:00:00.000Z") }),
      projectRecord({ id: "local-year", asanaCreatedAt: null, createdAt: new Date("2026-01-01T00:00:00.000Z") })
    ]);

    const data = await buildIndicators("all", "general", "2025");

    expect(prismaMock.project.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: {
        OR: [
          { asanaCreatedAt: { gte: new Date("2025-01-01T00:00:00.000Z"), lte: new Date("2025-12-31T23:59:59.999Z") } },
          {
            AND: [
              { asanaCreatedAt: null },
              { createdAt: { gte: new Date("2025-01-01T00:00:00.000Z"), lte: new Date("2025-12-31T23:59:59.999Z") } }
            ]
          }
        ]
      }
    }));
    expect(data.portfolioYear).toBe("2025");
    expect(data.availablePortfolioYears).toEqual(["2026", "2025"]);
  });

  it("compares Civil and Elétrico operational scopes", async () => {
    prismaMock.task.findMany.mockResolvedValue([
      taskRecord({
        id: "civil-task",
        completed: true,
        completedAtAsana: new Date("2026-06-02T12:00:00.000Z"),
        estimatedDays: 2,
        conclusionDays: 2,
        dueOn: null,
        memberships: [membership("Civil")]
      }),
      taskRecord({
        id: "electrical-task",
        completed: true,
        completedAtAsana: new Date("2026-06-03T12:00:00.000Z"),
        estimatedDays: 3,
        conclusionDays: 4,
        dueOn: null,
        memberships: [membership("Elétrico")]
      })
    ]);
    prismaMock.project.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const data = await buildIndicators("all", "general");

    expect(data.team.byScope.find((item) => item.scope === "civil")).toMatchObject({
      completedTasks: 1,
      onTimeDeliveries: 1,
      estimatedDays: 2
    });
    expect(data.team.byScope.find((item) => item.scope === "electrical")).toMatchObject({
      completedTasks: 1,
      lateDeliveries: 1,
      estimatedDays: 3
    });
  });
});

function taskRecord(overrides: Partial<TestTaskRecord>): TestTaskRecord {
  return {
    ...baseTaskRecord(),
    ...overrides
  };
}

function baseTaskRecord(): TestTaskRecord {
  return {
    id: "task",
    completed: false,
    mikaStatus: TaskStatus.TODO,
    assigneeStatus: null,
    dueOn: null,
    dueAt: null,
    completedAtAsana: null,
    estimatedDays: null,
    estimatedTime: null,
    conclusionDays: null,
    assignee: { id: "user", name: "Usuário" },
    memberships: [membership("Civil")]
  };
}

function projectRecord(overrides: Partial<TestProjectRecord>): TestProjectRecord {
  return {
    ...baseProjectRecord(),
    ...overrides
  };
}

function baseProjectRecord(): TestProjectRecord {
  return {
    id: "project",
    platform: null,
    areaM2: null,
    asanaCreatedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    customFieldValues: []
  };
}

function membership(sectionName: string) {
  return {
    project: null,
    section: {
      id: `section-${sectionName}`,
      name: sectionName,
      project: {
        id: "project-1",
        archived: false
      }
    }
  };
}
