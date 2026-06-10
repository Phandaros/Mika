import type { Prisma } from "../generated/prisma/client.js";
import { taskInclude, toTaskDto } from "./asanaDto.js";
import { Role, TaskStatus } from "./enums.js";
import { prisma } from "./prisma.js";
import { getCurrentWeekEnd, getCurrentWeekStart } from "./weekUtils.js";

export const REPORT_ELIGIBLE_ROLES = [Role.DESIGNER, Role.INTERN] as const;

export interface TaskSnapshot {
  title: string;
  status: string;
  projectName: string;
  sectionName: string;
}

type TaskRecord = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

export function buildTaskSnapshot(task: TaskRecord): TaskSnapshot {
  const dto = toTaskDto(task);
  const projectName = dto.discipline?.projectName ?? dto.projects?.[0]?.name ?? "";
  const sectionName = dto.discipline?.name ?? dto.projects?.[0]?.sectionName ?? "";

  return {
    title: dto.title,
    status: dto.status,
    projectName,
    sectionName
  };
}

export function eligibleTasksWhere(userId: string, weekStart: Date, weekEnd: Date): Prisma.TaskWhereInput {
  return {
    assignee: { id: userId },
    OR: [
      {
        updatedAt: {
          gte: weekStart,
          lte: weekEnd
        }
      },
      {
        mikaStatus: {
          in: [TaskStatus.IN_PROGRESS, TaskStatus.AWAITING_REVIEW]
        }
      },
      {
        mikaStatus: TaskStatus.FINISHED,
        completedAtAsana: {
          gte: weekStart,
          lte: weekEnd
        }
      }
    ]
  };
}

export async function findEligibleTasksForUser(userId: string, weekStart: Date, weekEnd: Date) {
  return prisma.task.findMany({
    where: eligibleTasksWhere(userId, weekStart, weekEnd),
    include: taskInclude,
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }]
  });
}

export async function createWeeklyReportForUser(
  userId: string,
  weekStart: Date = getCurrentWeekStart(),
  weekEnd: Date = getCurrentWeekEnd()
): Promise<{ report: Awaited<ReturnType<typeof prisma.weeklyReport.create>>; created: boolean }> {
  const existing = await prisma.weeklyReport.findUnique({
    where: {
      userId_weekStart: {
        userId,
        weekStart
      }
    }
  });

  if (existing) {
    return { report: existing, created: false };
  }

  const tasks = await findEligibleTasksForUser(userId, weekStart, weekEnd);

  const report = await prisma.weeklyReport.create({
    data: {
      userId,
      weekStart,
      weekEnd,
      status: "PENDING",
      items: {
        create: tasks.map((task) => ({
          taskId: task.id,
          comment: "",
          taskSnapshot: {}
        }))
      }
    }
  });

  return { report, created: true };
}

export async function markPreviousWeekReportsLate(previousWeekStart: Date) {
  await prisma.weeklyReport.updateMany({
    where: {
      weekStart: previousWeekStart,
      status: "PENDING"
    },
    data: {
      status: "LATE"
    }
  });
}

export function isReportEligibleRole(role: string): boolean {
  return (REPORT_ELIGIBLE_ROLES as readonly string[]).includes(role);
}
