import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  task: {
    findMany: vi.fn()
  },
  weeklyReport: {
    findUnique: vi.fn(),
    create: vi.fn()
  }
}));

vi.mock("./prisma.js", () => ({ prisma: prismaMock }));
vi.mock("./asanaDto.js", () => ({
  taskInclude: {},
  toTaskDto: () => ({
    title: "Tarefa",
    status: "TODO",
    discipline: null,
    projects: []
  })
}));

import { createWeeklyReportForUser } from "./weeklyReportTasks.js";

function uniqueWeeklyReportError(): Error & {
  code: string;
  meta: { driverAdapterError: { cause: { constraint: { fields: string[] } } } };
} {
  return Object.assign(new Error("Unique constraint failed"), {
    code: "P2002",
    meta: {
      driverAdapterError: {
        cause: {
          constraint: {
            fields: ["userId", "weekStart"]
          }
        }
      }
    }
  });
}

describe("createWeeklyReportForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna relatório existente quando outra execução cria o mesmo userId/weekStart", async () => {
    const weekStart = new Date("2026-07-03T03:00:00.000Z");
    const weekEnd = new Date("2026-07-09T02:59:59.999Z");
    const existingReport = { id: "report-1", userId: "user-1", weekStart, weekEnd };

    prismaMock.weeklyReport.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(existingReport);
    prismaMock.task.findMany.mockResolvedValue([]);
    prismaMock.weeklyReport.create.mockRejectedValue(uniqueWeeklyReportError());

    await expect(createWeeklyReportForUser("user-1", weekStart, weekEnd)).resolves.toEqual({
      report: existingReport,
      created: false
    });
  });
});
