import { describe, expect, it, vi } from "vitest";
import { TaskStatus } from "./enums.js";
import { isUndatedTodoTaskCandidate, runMoveUndatedTodoToBacklog } from "./moveUndatedTodoToBacklog.js";

describe("moveUndatedTodoToBacklog", () => {
  it("identifies only open undated todo tasks", () => {
    expect(
      isUndatedTodoTaskCandidate({
        completed: true,
        mikaStatus: TaskStatus.TODO,
        assigneeStatus: null,
        startOn: null,
        dueOn: null,
        dueAt: null
      })
    ).toBe(false);

    expect(
      isUndatedTodoTaskCandidate({
        completed: false,
        mikaStatus: TaskStatus.BACKLOG,
        assigneeStatus: null,
        startOn: null,
        dueOn: null,
        dueAt: null
      })
    ).toBe(false);
  });

  it("runs dry-run without updating tasks", async () => {
    const prisma = {
      task: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "task-1",
            name: "Pré-criada",
            mikaStatus: TaskStatus.TODO,
            assigneeStatus: null,
            completed: false,
            startOn: null,
            dueOn: null,
            dueAt: null
          },
          {
            id: "task-2",
            name: "Com data",
            mikaStatus: TaskStatus.TODO,
            assigneeStatus: null,
            completed: false,
            startOn: "2026-06-01",
            dueOn: null,
            dueAt: null
          }
        ]),
        updateMany: vi.fn()
      }
    };

    const summary = await runMoveUndatedTodoToBacklog(prisma as never, { apply: false });

    expect(summary.scanned).toBe(2);
    expect(summary.eligible).toBe(1);
    expect(summary.updated).toBe(0);
    expect(prisma.task.updateMany).not.toHaveBeenCalled();
  });

  it("applies backlog status to eligible tasks", async () => {
    const prisma = {
      task: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "task-1",
            name: "Pré-criada",
            mikaStatus: TaskStatus.TODO,
            assigneeStatus: null,
            completed: false,
            startOn: null,
            dueOn: null,
            dueAt: null
          }
        ]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 })
      }
    };

    const summary = await runMoveUndatedTodoToBacklog(prisma as never, { apply: true });

    expect(summary.updated).toBe(1);
    expect(prisma.task.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["task-1"] } },
      data: {
        mikaStatus: TaskStatus.BACKLOG,
        updatedAt: expect.any(Date)
      }
    });
  });
});
