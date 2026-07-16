import { describe, expect, it } from "vitest";
import { TaskStatus } from "./enums.js";
import { normalizeTaskStatus } from "./taskStatus.js";
import { isBacklogTask, normalizedStatusWhere } from "./taskStatusWhere.js";
import { isUndatedTodoTaskCandidate } from "./moveUndatedTodoToBacklog.js";

describe("task status where helpers", () => {
  it("detects backlog tasks by mikaStatus", () => {
    expect(isBacklogTask({ mikaStatus: TaskStatus.BACKLOG })).toBe(true);
    expect(isBacklogTask({ mikaStatus: "BACKLOG" })).toBe(true);
    expect(isBacklogTask({ mikaStatus: "backlog" })).toBe(true);
    expect(isBacklogTask({ mikaStatus: TaskStatus.TODO })).toBe(false);
    expect(isBacklogTask({ mikaStatus: null })).toBe(false);
  });

  it("does not treat backlog as todo", () => {
    const task = {
      completed: false,
      mikaStatus: TaskStatus.BACKLOG,
      assigneeStatus: null
    };

    expect(normalizeTaskStatus(task)).toBe(TaskStatus.BACKLOG);
    expect(isUndatedTodoTaskCandidate({ ...task, startOn: null, dueOn: null, dueAt: null })).toBe(false);
  });

  it("keeps completed review and analysis tasks out of the finished query", () => {
    const finishedWhere = normalizedStatusWhere(TaskStatus.FINISHED);
    const serializedFinishedWhere = JSON.stringify(finishedWhere);

    expect(finishedWhere).toHaveProperty("completed", true);
    expect(serializedFinishedWhere).toContain(TaskStatus.AWAITING_REVIEW);
    expect(serializedFinishedWhere).toContain(TaskStatus.IN_ANALYSIS);
    expect(finishedWhere).toHaveProperty("NOT");
  });

  it.each([TaskStatus.AWAITING_REVIEW, TaskStatus.IN_ANALYSIS])(
    "does not require completed=false when querying %s",
    (status) => {
      const statusWhere = normalizedStatusWhere(status);

      expect(statusWhere).not.toHaveProperty("completed");
      expect(JSON.stringify(statusWhere)).toContain(status);
    }
  );

  it("selects open undated todo tasks for backlog migration", () => {
    expect(
      isUndatedTodoTaskCandidate({
        completed: false,
        mikaStatus: TaskStatus.TODO,
        assigneeStatus: null,
        startOn: null,
        dueOn: null,
        dueAt: null
      })
    ).toBe(true);

    expect(
      isUndatedTodoTaskCandidate({
        completed: false,
        mikaStatus: null,
        assigneeStatus: "upcoming",
        startOn: null,
        dueOn: null,
        dueAt: null
      })
    ).toBe(true);

    expect(
      isUndatedTodoTaskCandidate({
        completed: false,
        mikaStatus: null,
        assigneeStatus: "later",
        startOn: null,
        dueOn: null,
        dueAt: null
      })
    ).toBe(false);

    expect(
      isUndatedTodoTaskCandidate({
        completed: false,
        mikaStatus: TaskStatus.TODO,
        assigneeStatus: null,
        startOn: "2026-06-01",
        dueOn: null,
        dueAt: null
      })
    ).toBe(false);
  });
});
