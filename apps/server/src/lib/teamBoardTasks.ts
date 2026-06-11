import type { Prisma } from "../generated/prisma/client.js";
import type { TeamBoardColumnDto, TeamBoardResponse, TeamBoardTaskDto, TeamBoardTaskMetrics, User } from "shared";
import { TaskStatus as SharedTaskStatus } from "shared";
import { Priority, Role, TaskStatus, type TaskStatus as TaskStatusValue } from "./enums.js";
import {
  taskCustomFieldCatalogInclude,
  taskInclude,
  toPublicUser,
  toTaskDto,
  userSelect
} from "./asanaDto.js";
import { buildNonWorkingDays, countBusinessDaysBetween } from "./businessDays.js";
import { prisma } from "./prisma.js";
import { activeStatusesWhere, todayDateOnly } from "./taskStatusWhere.js";
import { REPORT_ELIGIBLE_ROLES } from "./weeklyReportTasks.js";

export const TEAM_BOARD_DEFAULT_STATUSES: TaskStatusValue[] = [
  TaskStatus.IN_PROGRESS,
  TaskStatus.AWAITING_REVIEW,
  TaskStatus.OVERDUE
];

const teamBoardTaskInclude = {
  assignee: { select: userSelect },
  memberships: {
    include: {
      section: {
        include: {
          project: { select: { id: true, name: true, asanaGid: true, archived: true } }
        }
      },
      project: { select: { id: true, name: true, asanaGid: true, archived: true } }
    }
  },
  customFieldValues: taskInclude.customFieldValues,
  tags: taskInclude.tags,
  _count: { select: { comments: true } }
} satisfies Prisma.TaskInclude;

type TeamBoardTaskRecord = Prisma.TaskGetPayload<{ include: typeof teamBoardTaskInclude }>;

const statusSortWeight: Record<TaskStatusValue, number> = {
  [TaskStatus.OVERDUE]: 0,
  [TaskStatus.AWAITING_REVIEW]: 1,
  [TaskStatus.IN_PROGRESS]: 2,
  [TaskStatus.TODO]: 3,
  [TaskStatus.ON_SCHEDULE]: 4,
  [TaskStatus.IN_ANALYSIS]: 5,
  [TaskStatus.AWAITING_DEFINITION]: 6,
  [TaskStatus.FINISHED]: 7,
  [TaskStatus.BACKLOG]: 8
};

const prioritySortWeight: Record<Priority, number> = {
  [Priority.URGENT]: 0,
  [Priority.HIGH]: 1,
  [Priority.MEDIUM]: 2,
  [Priority.LOW]: 3
};

function matchingActiveMembership(task: TeamBoardTaskRecord) {
  return task.memberships.find((membership) => {
    const project = membership.section?.project ?? membership.project;
    return Boolean(project && !project.archived);
  });
}

function dateOnlyString(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return value.slice(0, 10);
}

function computeTaskMetrics(
  task: TeamBoardTaskRecord,
  dto: ReturnType<typeof toTaskDto>,
  nonWorkingDays: Set<string>,
  today: string
): TeamBoardTaskMetrics {
  const startDate = dateOnlyString(dto.startDate);
  const dueDate = dateOnlyString(dto.dueDate);
  const estimatedDays = dto.estimatedDays ?? dto.estimatedTime ?? null;

  const elapsedBusinessDays =
    startDate && startDate <= today ? countBusinessDaysBetween(startDate, today, nonWorkingDays) : null;

  const isOverdue = dto.status === TaskStatus.OVERDUE || Boolean(dueDate && dueDate < today && !dto.completed);

  const isOverEstimated =
    elapsedBusinessDays != null && estimatedDays != null && estimatedDays > 0
      ? elapsedBusinessDays > Math.ceil(estimatedDays)
      : false;

  let daysUntilDue: number | null = null;
  if (dueDate) {
    if (dueDate >= today) {
      daysUntilDue = countBusinessDaysBetween(today, dueDate, nonWorkingDays);
    } else {
      daysUntilDue = -countBusinessDaysBetween(dueDate, today, nonWorkingDays);
    }
  }

  return {
    elapsedBusinessDays,
    isOverdue,
    isOverEstimated,
    daysUntilDue
  };
}

function compareTeamBoardTasks(a: TeamBoardTaskDto, b: TeamBoardTaskDto): number {
  const statusDiff = (statusSortWeight[a.status] ?? 99) - (statusSortWeight[b.status] ?? 99);
  if (statusDiff !== 0) {
    return statusDiff;
  }

  const aDue = a.dueDate ?? "9999-12-31";
  const bDue = b.dueDate ?? "9999-12-31";
  if (!a.dueDate && b.dueDate) {
    return 1;
  }
  if (a.dueDate && !b.dueDate) {
    return -1;
  }
  const dueDiff = aDue.localeCompare(bDue);
  if (dueDiff !== 0) {
    return dueDiff;
  }

  return (prioritySortWeight[a.priority] ?? 99) - (prioritySortWeight[b.priority] ?? 99);
}

function toTeamBoardUser(user: NonNullable<ReturnType<typeof toPublicUser>>): User {
  return {
    ...user,
    role: user.role as User["role"],
    createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : String(user.createdAt),
    updatedAt: user.updatedAt instanceof Date ? user.updatedAt.toISOString() : String(user.updatedAt)
  };
}

function toTeamBoardTaskDto(
  dto: ReturnType<typeof toTaskDto>,
  commentCount: number,
  metrics: TeamBoardTaskMetrics
): TeamBoardTaskDto {
  return {
    ...dto,
    status: dto.status as SharedTaskStatus,
    priority: dto.priority as TeamBoardTaskDto["priority"],
    createdAt: dto.createdAt instanceof Date ? dto.createdAt.toISOString() : String(dto.createdAt),
    updatedAt: dto.updatedAt instanceof Date ? dto.updatedAt.toISOString() : String(dto.updatedAt),
    completedAt: dto.completedAt instanceof Date ? dto.completedAt.toISOString() : dto.completedAt,
    assignee: dto.assignee ? toTeamBoardUser(dto.assignee) : dto.assignee,
    commentCount,
    metrics
  } as TeamBoardTaskDto;
}

function buildColumnSummary(tasks: TeamBoardTaskDto[]): TeamBoardColumnDto["summary"] {
  return {
    activeCount: tasks.length,
    overdueCount: tasks.filter((task) => task.status === TaskStatus.OVERDUE || task.metrics.isOverdue).length,
    awaitingReviewCount: tasks.filter((task) => task.status === TaskStatus.AWAITING_REVIEW).length,
    totalEstimatedDays: tasks.reduce((sum, task) => sum + (task.estimatedDays ?? task.estimatedTime ?? 0), 0)
  };
}

export async function buildTeamBoardResponse(input: {
  statuses: TaskStatusValue[];
  includeEmpty: boolean;
}): Promise<TeamBoardResponse> {
  const today = todayDateOnly();

  const [designers, tasks, taskFieldCatalog, holidays] = await Promise.all([
    prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: [...REPORT_ELIGIBLE_ROLES] }
      },
      select: userSelect,
      orderBy: { name: "asc" }
    }),
    prisma.task.findMany({
      where: {
        parentId: null,
        completed: false,
        assignee: {
          isActive: true,
          role: { in: [Role.DESIGNER, Role.INTERN] }
        },
        memberships: {
          some: {
            OR: [{ project: { archived: false } }, { section: { project: { archived: false } } }]
          }
        },
        AND: [activeStatusesWhere(input.statuses)]
      },
      include: teamBoardTaskInclude,
      orderBy: [{ updatedAt: "desc" }, { name: "asc" }]
    }),
    prisma.asanaCustomField.findMany({
      where: { mikaTaskField: true },
      include: taskCustomFieldCatalogInclude,
      orderBy: [{ mikaSortOrder: "asc" }, { name: "asc" }]
    }),
    prisma.companyHoliday.findMany({
      select: { date: true }
    })
  ]);

  const holidayDates = holidays.map((holiday) => holiday.date);
  const dateBounds = [today, ...tasks.flatMap((task) => [task.startOn, task.dueOn].filter((value): value is string => Boolean(value)))];
  const rangeFrom = dateBounds.reduce((min, value) => (value < min ? value : min), today);
  const rangeTo = dateBounds.reduce((max, value) => (value > max ? value : max), today);
  const nonWorkingDays = buildNonWorkingDays(rangeFrom, rangeTo, holidayDates);

  const tasksByUserId = new Map<string, TeamBoardTaskDto[]>();

  for (const task of tasks) {
    const assigneeId = task.assignee?.id;
    if (!assigneeId) {
      continue;
    }

    const membership = matchingActiveMembership(task);
    const project = membership?.section?.project ?? membership?.project;
    if (!membership || !project) {
      continue;
    }

    const dto = toTaskDto(
      task,
      {
        id: membership.section?.id ?? "",
        name: membership.section?.name ?? "",
        projectId: project.id,
        projectName: project.name
      },
      taskFieldCatalog
    );

    const teamBoardTask = toTeamBoardTaskDto(
      dto,
      task._count.comments,
      computeTaskMetrics(task, dto, nonWorkingDays, today)
    );

    const bucket = tasksByUserId.get(assigneeId) ?? [];
    bucket.push(teamBoardTask);
    tasksByUserId.set(assigneeId, bucket);
  }

  for (const [userId, userTasks] of tasksByUserId) {
    userTasks.sort(compareTeamBoardTasks);
    tasksByUserId.set(userId, userTasks);
  }

  const columns: TeamBoardColumnDto[] = designers
    .map((designer) => {
      const userTasks = tasksByUserId.get(designer.id) ?? [];
      return {
        user: toTeamBoardUser(toPublicUser(designer)!),
        summary: buildColumnSummary(userTasks),
        tasks: userTasks
      };
    })
    .filter((column) => input.includeEmpty || column.tasks.length > 0);

  const allTasks = columns.flatMap((column) => column.tasks);

  return {
    columns,
    totals: {
      activeTasks: allTasks.length,
      overdueTasks: allTasks.filter((task) => task.status === TaskStatus.OVERDUE || task.metrics.isOverdue).length,
      designersWithTasks: columns.filter((column) => column.tasks.length > 0).length
    }
  };
}
