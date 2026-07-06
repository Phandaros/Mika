import type { Prisma } from "../generated/prisma/client.js";
import { taskInclude, toTaskDto } from "./asanaDto.js";
import { Role, TaskStatus } from "./enums.js";
import { prisma } from "./prisma.js";
import { activeTaskWhere } from "./taskDeletion.js";
import { getCurrentWeekEnd, getCurrentWeekStart } from "./weekUtils.js";

export const REPORT_ELIGIBLE_ROLES = [Role.DESIGNER, Role.INTERN] as const;

export interface TaskSnapshot {
  title: string;
  status: string;
  projectName: string;
  sectionName: string;
}

type TaskRecord = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;
type WeeklyReportRecord = Awaited<ReturnType<typeof prisma.weeklyReport.create>>;

function isUniqueWeeklyReportConstraintError(error: unknown): boolean {
  if (!(error instanceof Error) || !("code" in error) || error.code !== "P2002") {
    return false;
  }

  const meta = "meta" in error ? error.meta : null;
  const target = meta && typeof meta === "object" && "target" in meta ? meta.target : undefined;
  const fields =
    Array.isArray(target)
      ? target
      : meta && typeof meta === "object" && "driverAdapterError" in meta
        ? (meta.driverAdapterError as { cause?: { constraint?: { fields?: unknown } } }).cause?.constraint?.fields
        : undefined;

  return Array.isArray(fields) && fields.includes("userId") && fields.includes("weekStart");
}

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
    ...activeTaskWhere(),
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
): Promise<{ report: WeeklyReportRecord; created: boolean }> {
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

  try {
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
  } catch (error) {
    if (!isUniqueWeeklyReportConstraintError(error)) {
      throw error;
    }

    const report = await prisma.weeklyReport.findUnique({
      where: {
        userId_weekStart: {
          userId,
          weekStart
        }
      }
    });

    if (!report) {
      throw error;
    }

    return { report, created: false };
  }
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
