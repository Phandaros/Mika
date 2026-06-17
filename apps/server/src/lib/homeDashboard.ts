import { endOfDay, format, startOfDay } from "date-fns";
import type {
  HomeDashboardActivity,
  HomeDashboardProject,
  HomeDashboardResponse,
  HomeDashboardTask,
  HomeDashboardWeeklyReportsSummary
} from "shared";
import { Priority as SharedPriority, TaskStatus as SharedTaskStatus } from "shared";
import { Priority, Role, TaskStatus, type Priority as PriorityValue, type Role as RoleValue } from "./enums.js";
import { publicTaskStatus } from "./taskStatus.js";
import { excludeBacklogWhere, isBacklogTask } from "./taskStatusWhere.js";
import { normalizeRole } from "./asanaDto.js";
import { getCurrentWeekEnd, getCurrentWeekStart } from "./weekUtils.js";
import { prisma } from "./prisma.js";
import type { JwtUser } from "../middleware/auth.js";

type HomeTaskRecord = {
  id: string;
  name: string;
  completed: boolean;
  mikaStatus: string | null;
  assigneeStatus: string | null;
  dueOn: string | null;
  dueAt: Date | null;
  priority: string | null;
  memberships: Array<{
    projectName: string | null;
    sectionName: string | null;
    project: { id: string; name: string; builder: string | null } | null;
    section: {
      id: string;
      name: string;
      project: { id: string; name: string; builder: string | null };
    } | null;
  }>;
};

type RecentActivityTaskRecord = {
  id: string;
  name: string;
  updatedAt: Date;
};

type RecentActivityCommentRecord = {
  id: string;
  taskId: string;
  content: string;
  createdAt: Date;
  asanaCreatedAt: Date | null;
  task: { id: string; name: string; mikaStatus: string | null } | null;
  author: { name: string } | null;
};

type HomeCapabilities = {
  canSeeReviews: boolean;
  canSeeMyWeeklyReport: boolean;
  canSeeWeeklyReportsSummary: boolean;
};

const reportEligibleRoles: RoleValue[] = [Role.DESIGNER, Role.INTERN];

export function homeDashboardCapabilities(role: RoleValue): HomeCapabilities {
  const canSeeReviews = role === Role.ADMIN || role === Role.COORDINATOR;
  const canSeeMyWeeklyReport = reportEligibleRoles.includes(role);

  return {
    canSeeReviews,
    canSeeMyWeeklyReport,
    canSeeWeeklyReportsSummary: canSeeReviews
  };
}

export function sortHomeTasks(tasks: HomeDashboardTask[], today = todayDateOnly()): HomeDashboardTask[] {
  return [...tasks].sort((a, b) => {
    const dueScore = taskDueScore(a, today) - taskDueScore(b, today);
    if (dueScore !== 0) {
      return dueScore;
    }

    const priorityScore = priorityRank(b.priority) - priorityRank(a.priority);
    if (priorityScore !== 0) {
      return priorityScore;
    }

    return (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31", "pt-BR");
  });
}

export async function buildHomeDashboard(authUser: JwtUser): Promise<HomeDashboardResponse> {
  const dashboard = await buildUserHomeDashboard(authUser.id, { includeGlobalSections: true });
  return dashboard ?? emptyDashboard(homeDashboardCapabilities(authUser.role));
}

export async function buildUserHomeDashboard(
  targetUserId: string,
  options: { includeGlobalSections?: boolean } = {}
): Promise<HomeDashboardResponse | null> {
  const includeGlobalSections = options.includeGlobalSections ?? false;

  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, asanaGid: true, role: true }
  });

  if (!user) {
    return null;
  }

  const capabilities = homeDashboardCapabilities(normalizeRole(user.role) as RoleValue);
  const today = todayDateOnly();
  const weekStart = getCurrentWeekStart();
  const weekEnd = getCurrentWeekEnd();
  const assigneeGid = user.asanaGid;
  const assignedWhere = {
    parentId: null,
    assigneeGid: assigneeGid ?? "__missing_asana_gid__",
    ...excludeBacklogWhere()
  };
  const openAssignedWhere = {
    ...assignedWhere,
    completed: false
  };

  const [
    assignedOpen,
    overdue,
    dueToday,
    completedThisWeek,
    myTaskRows,
    recentActivity,
    activeProjects,
    myReviews,
    myWeeklyReport,
    weeklyReportsSummary
  ] = await Promise.all([
    assigneeGid ? prisma.task.count({ where: openAssignedWhere }) : Promise.resolve(0),
    assigneeGid
      ? prisma.task.count({
          where: {
            ...openAssignedWhere,
            OR: [{ dueOn: { lt: today } }, { dueOn: null, dueAt: { lt: startOfDay(new Date()) } }]
          }
        })
      : Promise.resolve(0),
    assigneeGid
      ? prisma.task.count({
          where: {
            ...openAssignedWhere,
            OR: [{ dueOn: today }, { dueOn: null, dueAt: { gte: startOfDay(new Date()), lte: endOfDay(new Date()) } }]
          }
        })
      : Promise.resolve(0),
    assigneeGid
      ? prisma.task.count({
          where: {
            ...assignedWhere,
            completed: true,
            completedAtAsana: { gte: weekStart, lte: weekEnd }
          }
        })
      : Promise.resolve(0),
    assigneeGid ? loadMyTaskRows(assigneeGid) : Promise.resolve([]),
    includeGlobalSections ? loadRecentActivity(10) : Promise.resolve([]),
    includeGlobalSections ? loadActiveProjectSummaries(today) : Promise.resolve([]),
    capabilities.canSeeReviews ? loadMyReviews(user.id) : Promise.resolve(undefined),
    capabilities.canSeeMyWeeklyReport ? loadMyWeeklyReport(user.id, weekStart) : Promise.resolve(null),
    capabilities.canSeeWeeklyReportsSummary ? loadWeeklyReportsSummary(weekStart) : Promise.resolve(undefined)
  ]);

  const myTasks = sortHomeTasks(myTaskRows.map(toHomeTask), today).slice(0, 7);

  return {
    stats: {
      assignedOpen,
      overdue,
      dueToday,
      completedThisWeek
    },
    myTasks,
    recentActivity,
    activeProjects,
    ...(myReviews ? { myReviews } : {}),
    ...(capabilities.canSeeMyWeeklyReport ? { myWeeklyReport } : {}),
    ...(weeklyReportsSummary ? { weeklyReportsSummary } : {})
  };
}

async function loadMyTaskRows(asanaGid: string): Promise<HomeTaskRecord[]> {
  return prisma.task.findMany({
    where: {
      parentId: null,
      assigneeGid: asanaGid,
      completed: false,
      ...excludeBacklogWhere()
    },
    orderBy: [{ dueOn: "asc" }, { updatedAt: "desc" }],
    take: 30,
    select: {
      id: true,
      name: true,
      completed: true,
      mikaStatus: true,
      assigneeStatus: true,
      dueOn: true,
      dueAt: true,
      priority: true,
      memberships: {
        take: 1,
        select: {
          projectName: true,
          sectionName: true,
          project: { select: { id: true, name: true, builder: true } },
          section: { select: { id: true, name: true, project: { select: { id: true, name: true, builder: true } } } }
        }
      }
    }
  });
}

export async function loadRecentActivity(limit: number): Promise<HomeDashboardActivity[]> {
  const [comments, tasks] = await Promise.all([
    prisma.comment.findMany({
      orderBy: { createdAt: "desc" },
      take: limit * 3,
      include: {
        task: { select: { id: true, name: true, mikaStatus: true } },
        author: { select: { name: true } }
      }
    }),
    prisma.task.findMany({
      where: excludeBacklogWhere(),
      orderBy: { updatedAt: "desc" },
      take: limit * 3,
      select: { id: true, name: true, updatedAt: true }
    })
  ]);

  return mergeRecentActivity(comments, tasks, limit);
}

export function mergeRecentActivity(
  comments: RecentActivityCommentRecord[],
  tasks: RecentActivityTaskRecord[],
  limit: number
): HomeDashboardActivity[] {
  const fromComments = comments
    .filter((comment) => !isBacklogTask(comment.task ?? { mikaStatus: null }))
    .map((comment) => ({
      id: `comment:${comment.id}`,
      type: "comment" as const,
      at: (comment.asanaCreatedAt ?? comment.createdAt).toISOString(),
      title: comment.task?.name ?? "Tarefa",
      subtitle: `${comment.author?.name ?? "Asana"}: ${truncate(comment.content, 120)}`,
      taskId: comment.taskId
    }));
  const fromTasks = tasks.map((task) => ({
    id: `task:${task.id}`,
    type: "task" as const,
    at: task.updatedAt.toISOString(),
    title: task.name,
    subtitle: "Tarefa atualizada",
    taskId: task.id
  }));

  return [...fromComments, ...fromTasks]
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, limit);
}

async function loadActiveProjectSummaries(today: string): Promise<HomeDashboardProject[]> {
  const projects = await prisma.project.findMany({
    where: { archived: false },
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: { id: true, asanaGid: true, name: true, builder: true, workspace: { select: { name: true } } }
  });

  return Promise.all(
    projects.map(async (project) => {
      const taskWhere = {
        parentId: null,
        ...excludeBacklogWhere(),
        memberships: {
          some: {
            OR: [{ projectGid: project.asanaGid }, { section: { projectGid: project.asanaGid } }]
          }
        }
      };
      const [openTasks, completedTasks, overdueTasks, awaitingReviewTasks] = await Promise.all([
        prisma.task.count({ where: { ...taskWhere, completed: false } }),
        prisma.task.count({ where: { ...taskWhere, completed: true } }),
        prisma.task.count({
          where: {
            ...taskWhere,
            completed: false,
            OR: [{ dueOn: { lt: today } }, { dueOn: null, dueAt: { lt: startOfDay(new Date()) } }]
          }
        }),
        prisma.task.count({
          where: {
            ...taskWhere,
            completed: false,
            mikaStatus: TaskStatus.AWAITING_REVIEW
          }
        })
      ]);
      const totalTasks = openTasks + completedTasks;

      return {
        id: project.id,
        name: project.name,
        client: project.builder ?? project.workspace.name,
        openTasks,
        overdueTasks,
        awaitingReviewTasks,
        progress: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
      };
    })
  );
}

async function loadMyReviews(userId: string) {
  const where = {
    reviewerId: userId,
    status: "PENDING"
  };
  const [totalPendingMine, reviews] = await Promise.all([
    prisma.taskReview.count({ where }),
    prisma.taskReview.findMany({
      where,
      orderBy: [{ dueOn: "asc" }, { createdAt: "desc" }],
      take: 5,
      select: {
        id: true,
        dueOn: true,
        requestedBy: { select: { name: true } },
        sourceTask: {
          select: {
            id: true,
            name: true,
            memberships: {
              take: 1,
              select: {
                projectName: true,
                project: { select: { name: true } },
                section: { select: { project: { select: { name: true } } } }
              }
            }
          }
        }
      }
    })
  ]);

  return {
    totalPendingMine,
    items: reviews.map((review) => {
      const membership = review.sourceTask.memberships[0];

      return {
        id: review.id,
        taskId: review.sourceTask.id,
        title: `[REV] ${review.sourceTask.name}`,
        dueDate: review.dueOn,
        projectName: membership?.section?.project.name ?? membership?.project?.name ?? membership?.projectName ?? null,
        requestedByName: review.requestedBy?.name ?? null
      };
    })
  };
}

async function loadMyWeeklyReport(userId: string, weekStart: Date) {
  const report = await prisma.weeklyReport.findUnique({
    where: { userId_weekStart: { userId, weekStart } },
    select: {
      id: true,
      status: true,
      weekStart: true,
      weekEnd: true,
      _count: { select: { items: true } }
    }
  });

  if (!report) {
    return null;
  }

  return {
    id: report.id,
    status: report.status,
    itemCount: report._count.items,
    weekStart: report.weekStart.toISOString(),
    weekEnd: report.weekEnd.toISOString()
  };
}

async function loadWeeklyReportsSummary(weekStart: Date): Promise<HomeDashboardWeeklyReportsSummary> {
  const [expected, submitted, late, pending] = await Promise.all([
    prisma.user.count({
      where: {
        isActive: true,
        role: { in: reportEligibleRoles }
      }
    }),
    prisma.weeklyReport.count({ where: { weekStart, status: "SUBMITTED" } }),
    prisma.weeklyReport.count({ where: { weekStart, status: "LATE" } }),
    prisma.weeklyReport.count({ where: { weekStart, status: "PENDING" } })
  ]);

  return {
    expected,
    submitted,
    late,
    pending,
    submissionRate: expected > 0 ? Math.round((submitted / expected) * 100) : 0
  };
}

function toHomeTask(task: HomeTaskRecord): HomeDashboardTask {
  const membership = task.memberships[0];

  return {
    id: task.id,
    sectionId: membership?.section?.id ?? "",
    projectId: membership?.section?.project.id ?? membership?.project?.id ?? null,
    title: task.name,
    status: toSharedTaskStatus(publicTaskStatus(task)),
    priority: toSharedPriority(normalizePriority(task.priority)),
    dueDate: task.dueOn ?? dateOnlyFromDate(task.dueAt),
    projectName: membership?.section?.project.name ?? membership?.project?.name ?? membership?.projectName ?? null,
    sectionName: membership?.section?.name ?? membership?.sectionName ?? null
  };
}

function toSharedTaskStatus(status: TaskStatus): SharedTaskStatus {
  const values: Record<TaskStatus, SharedTaskStatus> = {
    [TaskStatus.BACKLOG]: SharedTaskStatus.BACKLOG,
    [TaskStatus.TODO]: SharedTaskStatus.TODO,
    [TaskStatus.ON_SCHEDULE]: SharedTaskStatus.ON_SCHEDULE,
    [TaskStatus.OVERDUE]: SharedTaskStatus.OVERDUE,
    [TaskStatus.IN_PROGRESS]: SharedTaskStatus.IN_PROGRESS,
    [TaskStatus.AWAITING_REVIEW]: SharedTaskStatus.AWAITING_REVIEW,
    [TaskStatus.IN_ANALYSIS]: SharedTaskStatus.IN_ANALYSIS,
    [TaskStatus.AWAITING_DEFINITION]: SharedTaskStatus.AWAITING_DEFINITION,
    [TaskStatus.FINISHED]: SharedTaskStatus.FINISHED
  };

  return values[status];
}

function toSharedPriority(priority: PriorityValue): SharedPriority {
  const values: Record<PriorityValue, SharedPriority> = {
    [Priority.LOW]: SharedPriority.LOW,
    [Priority.MEDIUM]: SharedPriority.MEDIUM,
    [Priority.HIGH]: SharedPriority.HIGH,
    [Priority.URGENT]: SharedPriority.URGENT
  };

  return values[priority];
}

function normalizePriority(value: string | null): PriorityValue {
  return Object.values(Priority).includes(value as PriorityValue) ? (value as PriorityValue) : Priority.MEDIUM;
}

function priorityRank(priority: PriorityValue): number {
  const ranks: Record<PriorityValue, number> = {
    [Priority.LOW]: 1,
    [Priority.MEDIUM]: 2,
    [Priority.HIGH]: 3,
    [Priority.URGENT]: 4
  };

  return ranks[priority];
}

function taskDueScore(task: HomeDashboardTask, today: string): number {
  if (!task.dueDate) {
    return 3;
  }

  if (task.dueDate < today) {
    return 0;
  }

  if (task.dueDate === today) {
    return 1;
  }

  return 2;
}

function emptyDashboard(capabilities: HomeCapabilities): HomeDashboardResponse {
  return {
    stats: {
      assignedOpen: 0,
      overdue: 0,
      dueToday: 0,
      completedThisWeek: 0
    },
    myTasks: [],
    recentActivity: [],
    activeProjects: [],
    ...(capabilities.canSeeReviews ? { myReviews: { totalPendingMine: 0, items: [] } } : {}),
    ...(capabilities.canSeeMyWeeklyReport ? { myWeeklyReport: null } : {}),
    ...(capabilities.canSeeWeeklyReportsSummary
      ? { weeklyReportsSummary: { expected: 0, submitted: 0, late: 0, pending: 0, submissionRate: 0 } }
      : {})
  };
}

function todayDateOnly(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function dateOnlyFromDate(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}
