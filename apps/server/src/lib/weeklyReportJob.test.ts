import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  user: {
    findMany: vi.fn()
  }
}));

vi.mock("./prisma.js", () => ({ prisma: prismaMock }));
vi.mock("./weekUtils.js", () => ({
  getCurrentWeekStart: () => new Date("2026-07-03T03:00:00.000Z"),
  getPreviousWeekStart: () => new Date("2026-06-26T03:00:00.000Z"),
  isWeeklyReportGenerationWindow: () => true
}));
vi.mock("./weeklyReportTasks.js", () => ({
  createWeeklyReportForUser: vi.fn(),
  markPreviousWeekReportsLate: vi.fn()
}));
vi.mock("./notify.js", () => ({
  createAndEmitNotification: vi.fn()
}));

import { runWeeklyReportGenerationSafely } from "./weeklyReportJob.js";

describe("runWeeklyReportGenerationSafely", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("captura falhas do job sem rejeitar a promise", async () => {
    const error = new Error("database is busy");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    prismaMock.user.findMany.mockRejectedValue(error);

    await expect(runWeeklyReportGenerationSafely()).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalledWith("[weeklyReportJob] Falha ao gerar relatórios semanais", error);
    consoleError.mockRestore();
  });
});
