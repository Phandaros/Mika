import type { Prisma } from "../generated/prisma/client.js";
import { Role, TaskStatus, type TaskStatus as TaskStatusValue } from "./enums.js";
import { makeLocalAsanaGid } from "./asanaDto.js";
import type { JwtUser } from "../middleware/auth.js";

const completionStatuses = new Set<TaskStatusValue>([
  TaskStatus.IN_ANALYSIS,
  TaskStatus.AWAITING_REVIEW,
  TaskStatus.FINISHED
]);

const coordinatorRoles = new Set<string>([Role.ADMIN, Role.COORDINATOR]);

export interface TaskRuleEvent {
  actor: JwtUser;
  completed?: boolean;
  status?: TaskStatusValue;
  recalculateOpenStatus?: boolean;
}

type RuleTask = {
  completed: boolean;
  completedAtAsana: Date | null;
  mikaStatus: string | null;
  startOn: string | null;
  dueOn: string | null;
  assignee: { role: string; isActive: boolean } | null;
};

export function isTerminalStatus(status: TaskStatusValue): boolean {
  return completionStatuses.has(status);
}

export function isOpenStatus(status: TaskStatusValue): boolean {
  return !isTerminalStatus(status);
}

export function statusForCompletedTaskByAssigneeRole(task: Pick<RuleTask, "assignee">): TaskStatusValue {
  const role = task.assignee?.isActive ? task.assignee.role : null;
  return role === Role.ADMIN || role === Role.COORDINATOR ? TaskStatus.FINISHED : TaskStatus.AWAITING_REVIEW;
}

export function statusForOpenTaskDates(
  task: Pick<RuleTask, "mikaStatus" | "startOn" | "dueOn">,
  today = todayDateOnly()
): TaskStatusValue {
  if (task.mikaStatus === TaskStatus.AWAITING_DEFINITION) {
    return TaskStatus.AWAITING_DEFINITION;
  }

  if (task.mikaStatus === TaskStatus.BACKLOG) {
    return TaskStatus.BACKLOG;
  }

  const startOn = dateOnlyString(task.startOn);
  const dueOn = dateOnlyString(task.dueOn);

  if (dueOn && dueOn < today) {
    return TaskStatus.OVERDUE;
  }

  if (startOn && dueOn && startOn <= today && today <= dueOn) {
    return TaskStatus.IN_PROGRESS;
  }

  if (startOn || dueOn) {
    return TaskStatus.ON_SCHEDULE;
  }

  return TaskStatus.TODO;
}

export async function applyTaskRules(tx: Prisma.TransactionClient, taskId: string, event: TaskRuleEvent): Promise<void> {
  const task = await tx.task.findUnique({
    where: { id: taskId },
    include: {
      assignee: { select: { id: true, asanaGid: true, role: true, isActive: true } },
      memberships: {
        include: {
          section: {
            include: {
              project: { select: { ownerGid: true } }
            }
          },
          project: { select: { ownerGid: true } }
        }
      }
    }
  });

  if (!task) {
    return;
  }

  let nextStatus = event.status;
  let nextCompleted: boolean | undefined;
  let nextCompletedAt: Date | null | undefined;

  if (event.completed === true) {
    nextStatus = statusForCompletedTaskByAssigneeRole(task);
    nextCompleted = true;
    nextCompletedAt = task.completedAtAsana ?? new Date();
  } else if (event.completed === false) {
    nextCompleted = false;
    nextCompletedAt = null;
    nextStatus = statusForOpenTaskDates(task);
  }

  if (nextStatus && isTerminalStatus(nextStatus)) {
    if (nextStatus === TaskStatus.AWAITING_REVIEW && statusForCompletedTaskByAssigneeRole(task) === TaskStatus.FINISHED) {
      nextStatus = TaskStatus.FINISHED;
    }
    nextCompleted = true;
    nextCompletedAt = task.completedAtAsana ?? new Date();
  }

  if (nextStatus && isOpenStatus(nextStatus)) {
    nextCompleted = false;
    nextCompletedAt = null;
  }

  if (event.recalculateOpenStatus && nextStatus === undefined) {
    if (task.completed) {
      nextStatus = statusForCompletedTaskByAssigneeRole(task);
      nextCompleted = true;
      nextCompletedAt = task.completedAtAsana ?? new Date();
    } else {
      nextStatus = statusForOpenTaskDates(task);
    }
  }

  if (nextStatus || nextCompleted !== undefined) {
    await tx.task.update({
      where: { id: taskId },
      data: {
        ...(nextStatus ? { mikaStatus: nextStatus } : {}),
        ...(nextCompleted !== undefined ? { completed: nextCompleted, completedAtAsana: nextCompletedAt ?? null } : {})
      }
    });
  }

  if (nextStatus === TaskStatus.AWAITING_REVIEW) {
    await ensurePendingTaskReview(tx, taskId, event.actor.id);
  } else if (nextCompleted === false || nextStatus) {
    await deletePendingTaskReview(tx, taskId);
  }
}

export async function deletePendingTaskReview(tx: Prisma.TransactionClient, sourceTaskId: string): Promise<void> {
  await tx.taskReview.deleteMany({
    where: { sourceTaskId, status: "PENDING" }
  });
}

export async function ensurePendingTaskReview(tx: Prisma.TransactionClient, sourceTaskId: string, requestedById: string): Promise<void> {
  const existing = await tx.taskReview.findFirst({
    where: { sourceTaskId, status: "PENDING" },
    select: { id: true }
  });

  if (existing) {
    return;
  }

  const task = await tx.task.findUnique({
    where: { id: sourceTaskId },
    include: {
      memberships: {
        include: {
          section: {
            include: {
              project: { select: { ownerGid: true } }
            }
          },
          project: { select: { ownerGid: true } }
        }
      }
    }
  });

  if (!task) {
    return;
  }

  const reviewer = await resolveReviewer(tx, task);

  if (!reviewer) {
    return;
  }

  await tx.taskReview.create({
    data: {
      sourceTaskId,
      rootTaskId: task.workflowRootTaskId ?? task.id,
      reviewerId: reviewer.id,
      requestedById,
      status: "PENDING",
      startOn: task.startOn,
      dueOn: task.dueOn
    }
  });
}

async function resolveReviewer(
  tx: Prisma.TransactionClient,
  task: {
    createdByUserId: string | null;
    memberships: Array<{
      section: { project: { ownerGid: string | null } } | null;
      project: { ownerGid: string | null } | null;
    }>;
  }
) {
  if (task.createdByUserId) {
    const creator = await tx.user.findUnique({
      where: { id: task.createdByUserId },
      select: { id: true, role: true, isActive: true }
    });

    if (creator?.isActive && coordinatorRoles.has(creator.role)) {
      return creator;
    }
  }

  const ownerGid = task.memberships
    .map((membership) => membership.section?.project.ownerGid ?? membership.project?.ownerGid)
    .find((gid): gid is string => Boolean(gid));

  if (ownerGid) {
    const owner = await tx.user.findUnique({
      where: { asanaGid: ownerGid },
      select: { id: true, role: true, isActive: true }
    });

    if (owner?.isActive && coordinatorRoles.has(owner.role)) {
      return owner;
    }
  }

  return tx.user.findFirst({
    where: {
      isActive: true,
      role: { in: [Role.COORDINATOR, Role.ADMIN] }
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: { id: true, role: true, isActive: true }
  });
}

export async function createAdjustmentTask(tx: Prisma.TransactionClient, reviewId: string): Promise<string> {
  const review = await tx.taskReview.findUniqueOrThrow({
    where: { id: reviewId },
    include: {
      sourceTask: {
        include: {
          memberships: true
        }
      }
    }
  });
  const sourceTask = review.sourceTask;
  const rootTaskId = sourceTask.workflowRootTaskId ?? sourceTask.id;
  const maxAdjustment = await tx.task.aggregate({
    where: {
      OR: [{ id: rootTaskId }, { workflowRootTaskId: rootTaskId }]
    },
    _max: { adjustmentNumber: true }
  });
  const nextAdjustmentNumber = (maxAdjustment._max.adjustmentNumber ?? 0) + 1;
  const baseName = sourceTask.name.replace(/\s+\[AJUSTES\s+\d+\]$/i, "");
  const adjustmentName = `${baseName} [AJUSTES ${String(nextAdjustmentNumber).padStart(2, "0")}]`;
  const createdTask = await tx.task.create({
    data: {
      asanaGid: makeLocalAsanaGid("task"),
      name: adjustmentName,
      notes: null,
      mikaStatus: TaskStatus.TODO,
      priority: sourceTask.priority,
      assigneeGid: sourceTask.assigneeGid,
      startOn: sourceTask.startOn,
      dueOn: sourceTask.dueOn,
      estimatedDays: sourceTask.estimatedDays,
      platform: sourceTask.platform,
      discipline: sourceTask.discipline,
      estimatedTime: sourceTask.estimatedTime,
      maxDeadline: sourceTask.maxDeadline,
      conclusionDays: sourceTask.conclusionDays,
      stage: sourceTask.stage,
      completed: false,
      completedAtAsana: null,
      createdByUserId: review.reviewerId,
      workflowRootTaskId: rootTaskId,
      adjustmentNumber: nextAdjustmentNumber
    }
  });

  for (const membership of sourceTask.memberships) {
    await tx.taskMembership.create({
      data: {
        taskId: createdTask.id,
        projectGid: membership.projectGid,
        projectName: membership.projectName,
        sectionGid: membership.sectionGid,
        sectionName: membership.sectionName
      }
    });
  }

  return createdTask.id;
}

function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateOnlyString(value: string | null | undefined): string | null {
  return value ? value.slice(0, 10) : null;
}
