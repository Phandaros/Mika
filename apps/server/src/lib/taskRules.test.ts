import type { Prisma } from "../generated/prisma/client.js";
import { describe, expect, it, vi } from "vitest";
import { Role, TaskStatus } from "./enums.js";
import { applyTaskRules, createAdjustmentTask, ensurePendingTaskReview, statusForCompletedTaskByAssigneeRole, statusForOpenTaskDates } from "./taskRules.js";

function taskFixture(overrides: Partial<{
  id: string;
  completed: boolean;
  completedAtAsana: Date | null;
  mikaStatus: string | null;
  startOn: string | null;
  dueOn: string | null;
  createdByUserId: string | null;
  workflowRootTaskId: string | null;
  assigneeRole: string | null;
}> = {}) {
  return {
    id: overrides.id ?? "task-1",
    completed: overrides.completed ?? false,
    completedAtAsana: overrides.completedAtAsana ?? null,
    mikaStatus: overrides.mikaStatus ?? null,
    createdByUserId: overrides.createdByUserId ?? "coordinator-1",
    workflowRootTaskId: overrides.workflowRootTaskId ?? null,
    startOn: overrides.startOn ?? null,
    dueOn: overrides.dueOn ?? null,
    assignee: overrides.assigneeRole ? { role: overrides.assigneeRole, isActive: true } : null,
    memberships: []
  };
}

function txMock() {
  return {
    task: {
      findUnique: vi.fn(),
      update: vi.fn(),
      aggregate: vi.fn(),
      create: vi.fn()
    },
    taskReview: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn()
    },
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn()
    },
    taskMembership: {
      create: vi.fn()
    }
  };
}

describe("task rules", () => {
  it("moves completed tasks assigned to designers to awaiting review, regardless of actor", async () => {
    const tx = txMock();
    tx.task.findUnique.mockResolvedValue(taskFixture({ assigneeRole: Role.DESIGNER }));
    tx.taskReview.findFirst.mockResolvedValue(null);
    tx.user.findUnique.mockResolvedValue({ id: "coordinator-1", role: Role.COORDINATOR, isActive: true });

    await applyTaskRules(tx as unknown as Prisma.TransactionClient, "task-1", {
      actor: { id: "coordinator-1", email: "c@mk.local", name: "Coordinator", role: Role.COORDINATOR },
      completed: true
    });

    expect(tx.task.update).toHaveBeenCalledWith({
      where: { id: "task-1" },
      data: expect.objectContaining({
        mikaStatus: TaskStatus.AWAITING_REVIEW,
        completed: true
      })
    });
    expect(tx.taskReview.create).toHaveBeenCalledTimes(1);
  });

  it("moves completed tasks assigned to coordinators directly to finished", async () => {
    const tx = txMock();
    tx.task.findUnique.mockResolvedValue(taskFixture({ assigneeRole: Role.COORDINATOR }));

    await applyTaskRules(tx as unknown as Prisma.TransactionClient, "task-1", {
      actor: { id: "designer-1", email: "d@mk.local", name: "Designer", role: Role.DESIGNER },
      completed: true
    });

    expect(statusForCompletedTaskByAssigneeRole(taskFixture({ assigneeRole: Role.COORDINATOR }))).toBe(TaskStatus.FINISHED);
    expect(tx.task.update).toHaveBeenCalledWith({
      where: { id: "task-1" },
      data: expect.objectContaining({
        mikaStatus: TaskStatus.FINISHED,
        completed: true
      })
    });
    expect(tx.taskReview.create).not.toHaveBeenCalled();
  });

  it("marks completion when status enters analysis, review or finished", async () => {
    for (const status of [TaskStatus.IN_ANALYSIS, TaskStatus.AWAITING_REVIEW, TaskStatus.FINISHED]) {
      const tx = txMock();
      tx.task.findUnique.mockResolvedValue(taskFixture({ assigneeRole: Role.DESIGNER }));
      tx.taskReview.findFirst.mockResolvedValue({ id: "existing-review" });

      await applyTaskRules(tx as unknown as Prisma.TransactionClient, "task-1", {
        actor: { id: "designer-1", email: "d@mk.local", name: "Designer", role: Role.DESIGNER },
        status
      });

      expect(tx.task.update).toHaveBeenCalledWith({
        where: { id: "task-1" },
        data: expect.objectContaining({
          mikaStatus: status,
          completed: true
        })
      });
    }
  });

  it("normalizes awaiting review to finished for coordinator-owned tasks", async () => {
    const tx = txMock();
    tx.task.findUnique.mockResolvedValue(taskFixture({ assigneeRole: Role.COORDINATOR }));

    await applyTaskRules(tx as unknown as Prisma.TransactionClient, "task-1", {
      actor: { id: "designer-1", email: "d@mk.local", name: "Designer", role: Role.DESIGNER },
      status: TaskStatus.AWAITING_REVIEW
    });

    expect(tx.task.update).toHaveBeenCalledWith({
      where: { id: "task-1" },
      data: expect.objectContaining({
        mikaStatus: TaskStatus.FINISHED,
        completed: true
      })
    });
    expect(tx.taskReview.create).not.toHaveBeenCalled();
  });

  it("reopens tasks by deleting pending review and recalculating status from dates", async () => {
    const tx = txMock();
    tx.task.findUnique.mockResolvedValue(taskFixture({ completed: false, mikaStatus: TaskStatus.AWAITING_REVIEW, startOn: null, dueOn: "2099-06-20" }));

    await applyTaskRules(tx as unknown as Prisma.TransactionClient, "task-1", {
      actor: { id: "designer-1", email: "d@mk.local", name: "Designer", role: Role.DESIGNER },
      completed: false
    });

    expect(tx.task.update).toHaveBeenCalledWith({
      where: { id: "task-1" },
      data: expect.objectContaining({
        mikaStatus: TaskStatus.ON_SCHEDULE,
        completed: false,
        completedAtAsana: null
      })
    });
    expect(tx.taskReview.deleteMany).toHaveBeenCalledWith({ where: { sourceTaskId: "task-1", status: "PENDING" } });
  });

  it("calculates open task status from dates", () => {
    expect(statusForOpenTaskDates(taskFixture(), "2026-06-09")).toBe(TaskStatus.TODO);
    expect(statusForOpenTaskDates(taskFixture({ dueOn: "2026-06-20" }), "2026-06-09")).toBe(TaskStatus.ON_SCHEDULE);
    expect(statusForOpenTaskDates(taskFixture({ startOn: "2026-06-01", dueOn: "2026-06-20" }), "2026-06-09")).toBe(TaskStatus.IN_PROGRESS);
    expect(statusForOpenTaskDates(taskFixture({ dueOn: "2026-06-08" }), "2026-06-09")).toBe(TaskStatus.OVERDUE);
    expect(statusForOpenTaskDates(taskFixture({ mikaStatus: TaskStatus.AWAITING_DEFINITION, dueOn: "2026-06-08" }), "2026-06-09")).toBe(TaskStatus.AWAITING_DEFINITION);
    expect(statusForOpenTaskDates(taskFixture({ mikaStatus: TaskStatus.BACKLOG, dueOn: "2026-06-20" }), "2026-06-09")).toBe(TaskStatus.BACKLOG);
  });

  it("does not create a duplicate pending review", async () => {
    const tx = txMock();
    tx.taskReview.findFirst.mockResolvedValue({ id: "review-1" });

    await ensurePendingTaskReview(tx as unknown as Prisma.TransactionClient, "task-1", "designer-1");

    expect(tx.task.findUnique).not.toHaveBeenCalled();
    expect(tx.taskReview.create).not.toHaveBeenCalled();
  });

  it("creates pending review with an explicit reviewer", async () => {
    const tx = txMock();
    tx.taskReview.findFirst.mockResolvedValue(null);
    tx.task.findUnique.mockResolvedValue(taskFixture({ createdByUserId: "requester-1" }));
    tx.taskReview.create.mockResolvedValue({
      id: "review-1",
      sourceTaskId: "task-1",
      rootTaskId: "task-1",
      reviewerId: "coordinator-2",
      requestedById: "requester-1",
      status: "PENDING",
      message: null,
      startOn: null,
      dueOn: null,
      decidedAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await ensurePendingTaskReview(tx as unknown as Prisma.TransactionClient, "task-1", "requester-1", {
      reviewerId: "coordinator-2"
    });

    expect(tx.user.findUnique).not.toHaveBeenCalled();
    expect(tx.user.findFirst).not.toHaveBeenCalled();
    expect(tx.taskReview.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reviewerId: "coordinator-2",
        requestedById: "requester-1"
      })
    });
  });

  it("reassigns an existing pending review without creating another review", async () => {
    const tx = txMock();
    tx.taskReview.findFirst.mockResolvedValue({
      id: "review-1",
      sourceTaskId: "task-1",
      rootTaskId: "task-1",
      reviewerId: "coordinator-1",
      requestedById: "requester-1",
      status: "PENDING",
      message: null,
      startOn: null,
      dueOn: null,
      decidedAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    tx.taskReview.update.mockResolvedValue({
      id: "review-1",
      sourceTaskId: "task-1",
      rootTaskId: "task-1",
      reviewerId: "coordinator-2",
      requestedById: "requester-1",
      status: "PENDING",
      message: null,
      startOn: null,
      dueOn: null,
      decidedAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await ensurePendingTaskReview(tx as unknown as Prisma.TransactionClient, "task-1", "requester-1", {
      reviewerId: "coordinator-2"
    });

    expect(tx.taskReview.update).toHaveBeenCalledWith({
      where: { id: "review-1" },
      data: { reviewerId: "coordinator-2" },
      select: expect.any(Object)
    });
    expect(tx.taskReview.create).not.toHaveBeenCalled();
  });

  it("selects another coordinator for manual review when excluding the requester", async () => {
    const tx = txMock();
    tx.taskReview.findFirst.mockResolvedValue(null);
    tx.task.findUnique.mockResolvedValue(taskFixture({ createdByUserId: "requester-1" }));
    tx.user.findUnique.mockResolvedValue({ id: "requester-1", role: Role.COORDINATOR, isActive: true });
    tx.user.findFirst.mockResolvedValue({ id: "coordinator-2", role: Role.COORDINATOR, isActive: true });
    tx.taskReview.create.mockResolvedValue({
      id: "review-1",
      sourceTaskId: "task-1",
      rootTaskId: "task-1",
      reviewerId: "coordinator-2",
      requestedById: "requester-1",
      status: "PENDING",
      message: null,
      startOn: null,
      dueOn: null,
      decidedAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await ensurePendingTaskReview(tx as unknown as Prisma.TransactionClient, "task-1", "requester-1", {
      excludeReviewerId: "requester-1"
    });

    expect(tx.taskReview.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reviewerId: "coordinator-2",
        requestedById: "requester-1"
      })
    });
  });

  it("falls back to the requester when no other coordinator can review", async () => {
    const tx = txMock();
    tx.taskReview.findFirst.mockResolvedValue(null);
    tx.task.findUnique.mockResolvedValue(taskFixture({ createdByUserId: "requester-1" }));
    tx.user.findUnique
      .mockResolvedValueOnce({ id: "requester-1", role: Role.COORDINATOR, isActive: true })
      .mockResolvedValueOnce({ id: "requester-1", role: Role.COORDINATOR, isActive: true });
    tx.user.findFirst.mockResolvedValue(null);
    tx.taskReview.create.mockResolvedValue({
      id: "review-1",
      sourceTaskId: "task-1",
      rootTaskId: "task-1",
      reviewerId: "requester-1",
      requestedById: "requester-1",
      status: "PENDING",
      message: null,
      startOn: null,
      dueOn: null,
      decidedAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await ensurePendingTaskReview(tx as unknown as Prisma.TransactionClient, "task-1", "requester-1", {
      excludeReviewerId: "requester-1"
    });

    expect(tx.taskReview.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reviewerId: "requester-1",
        requestedById: "requester-1"
      })
    });
  });

  it("creates adjustment tasks with the next sequence and copied memberships", async () => {
    const tx = txMock();
    tx.taskReview.findUniqueOrThrow.mockResolvedValue({
      reviewerId: "coordinator-1",
      sourceTask: {
        id: "task-2",
        name: "Tarefa 01 [AJUSTES 01]",
        priority: "MEDIUM",
        assigneeGid: "designer-gid",
        startOn: "2026-06-01",
        dueOn: "2026-06-10",
        estimatedDays: null,
        platform: null,
        discipline: "ELE",
        estimatedTime: null,
        maxDeadline: null,
        conclusionDays: null,
        stage: null,
        workflowRootTaskId: "task-1",
        memberships: [
          {
            projectGid: "project-gid",
            projectName: "Projeto",
            sectionGid: "section-gid",
            sectionName: "Civil"
          }
        ]
      }
    });
    tx.task.aggregate.mockResolvedValue({ _max: { adjustmentNumber: 1 } });
    tx.task.create.mockResolvedValue({ id: "task-3" });

    const adjustmentTaskId = await createAdjustmentTask(tx as unknown as Prisma.TransactionClient, "review-1");

    expect(adjustmentTaskId).toBe("task-3");
    expect(tx.task.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Tarefa 01 [AJUSTES 02]",
        notes: null,
        mikaStatus: TaskStatus.TODO,
        assigneeGid: "designer-gid",
        workflowRootTaskId: "task-1",
        adjustmentNumber: 2
      })
    });
    expect(tx.taskMembership.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        taskId: "task-3",
        projectGid: "project-gid",
        sectionGid: "section-gid"
      })
    });
  });
});
