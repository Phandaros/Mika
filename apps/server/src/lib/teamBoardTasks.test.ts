import { describe, expect, it } from "vitest";
import { TaskStatus } from "./enums.js";
import { buildTeamBoardResponse } from "./teamBoardTasks.js";

describe("buildTeamBoardResponse", () => {
  it("returns columns and totals for active designer tasks", async () => {
    const response = await buildTeamBoardResponse({
      statuses: [TaskStatus.IN_PROGRESS, TaskStatus.AWAITING_REVIEW, TaskStatus.OVERDUE],
      includeEmpty: false
    });

    expect(response).toHaveProperty("columns");
    expect(response).toHaveProperty("totals");
    expect(response.totals.activeTasks).toBeGreaterThanOrEqual(0);
    expect(response.totals.overdueTasks).toBeLessThanOrEqual(response.totals.activeTasks);

    for (const column of response.columns) {
      expect(column.user.id).toBeTruthy();
      expect(column.summary.activeCount).toBe(column.tasks.length);

      for (const task of column.tasks) {
        expect([TaskStatus.IN_PROGRESS, TaskStatus.AWAITING_REVIEW, TaskStatus.OVERDUE]).toContain(task.status);
        expect(task.metrics).toHaveProperty("elapsedBusinessDays");
        expect(task.metrics).toHaveProperty("isOverdue");
        expect(task.commentCount).toBeGreaterThanOrEqual(0);
        expect(task.assigneeId).toBe(column.user.id);
      }
    }
  });
});
