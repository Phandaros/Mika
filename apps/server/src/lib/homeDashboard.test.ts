import { describe, expect, it } from "vitest";
import { Priority, TaskStatus } from "shared";
import { Role } from "./enums.js";
import { homeDashboardCapabilities, sortHomeTasks } from "./homeDashboard.js";
import type { HomeDashboardTask } from "shared";

describe("homeDashboardCapabilities", () => {
  it("keeps designer home focused on personal execution", () => {
    expect(homeDashboardCapabilities(Role.DESIGNER)).toEqual({
      canSeeReviews: false,
      canSeeMyWeeklyReport: true,
      canSeeWeeklyReportsSummary: false
    });
  });

  it("adds coordinator operational queues", () => {
    expect(homeDashboardCapabilities(Role.COORDINATOR)).toEqual({
      canSeeReviews: true,
      canSeeMyWeeklyReport: false,
      canSeeWeeklyReportsSummary: true
    });
  });
});

describe("sortHomeTasks", () => {
  it("prioritizes overdue, today, upcoming, then undated tasks", () => {
    const tasks: HomeDashboardTask[] = [
      task("sem-data", null, Priority.URGENT),
      task("proxima", "2026-06-20", Priority.URGENT),
      task("hoje", "2026-06-12", Priority.LOW),
      task("atrasada", "2026-06-10", Priority.LOW)
    ];

    expect(sortHomeTasks(tasks, "2026-06-12").map((item) => item.id)).toEqual(["atrasada", "hoje", "proxima", "sem-data"]);
  });

  it("uses priority as tie-breaker inside the same due group", () => {
    const tasks: HomeDashboardTask[] = [
      task("media", "2026-06-12", Priority.MEDIUM),
      task("urgente", "2026-06-12", Priority.URGENT),
      task("baixa", "2026-06-12", Priority.LOW)
    ];

    expect(sortHomeTasks(tasks, "2026-06-12").map((item) => item.id)).toEqual(["urgente", "media", "baixa"]);
  });
});

function task(id: string, dueDate: string | null, priority: Priority): HomeDashboardTask {
  return {
    id,
    sectionId: "section-1",
    projectId: "project-1",
    title: id,
    status: TaskStatus.TODO,
    priority,
    dueDate,
    projectName: "Projeto",
    sectionName: "Civil"
  };
}
