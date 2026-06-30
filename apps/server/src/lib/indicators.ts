import type { Prisma } from "../generated/prisma/client.js";
import { endOfMonth, endOfYear, format, startOfMonth, startOfYear } from "date-fns";
import type {
  IndicatorPeriod,
  IndicatorPortfolioYear,
  IndicatorPortfolioStatusGroup,
  IndicatorScope,
  IndicatorScopePoint,
  IndicatorStatusPoint,
  IndicatorUserPoint,
  IndicatorsResponse,
  IndicatorValuePoint,
  TaskStatus as SharedTaskStatus
} from "shared";
import { TaskStatus, type TaskStatus as TaskStatusValue } from "./enums.js";
import { excludeBacklogWhere } from "./taskStatusWhere.js";
import { publicTaskStatus } from "./taskStatus.js";
import {
  findPortfolioCatalogField,
  PORTFOLIO_CATALOG,
  portfolioCatalogGid
} from "./portfolioCatalog.js";
import { sectionMatchesWorkloadScope } from "./workloadScope.js";
import { prisma } from "./prisma.js";

type PeriodWindow = {
  from: string | null;
  to: string | null;
  fromDate: Date | null;
  toDate: Date | null;
  label: string;
};

const indicatorScopes: IndicatorScope[] = ["general", "civil", "electrical"];

const taskStatusLabels: Record<TaskStatusValue, string> = {
  [TaskStatus.BACKLOG]: "Backlog",
  [TaskStatus.TODO]: "A fazer",
  [TaskStatus.ON_SCHEDULE]: "No cronograma",
  [TaskStatus.OVERDUE]: "Atrasado",
  [TaskStatus.IN_PROGRESS]: "Em andamento",
  [TaskStatus.AWAITING_REVIEW]: "Aguardando revisão",
  [TaskStatus.IN_ANALYSIS]: "Em análise",
  [TaskStatus.AWAITING_DEFINITION]: "Aguardando definição",
  [TaskStatus.FINISHED]: "Finalizado"
};

const scopeLabels: Record<IndicatorScope, string> = {
  general: "Geral",
  civil: "Civil",
  electrical: "Elétrico"
};

const taskInclude = {
  assignee: { select: { id: true, name: true } },
  memberships: {
    include: {
      project: { select: { id: true, archived: true } },
      section: {
        select: {
          id: true,
          name: true,
          project: { select: { id: true, archived: true } }
        }
      }
    }
  }
} satisfies Prisma.TaskInclude;

type IndicatorTaskRecord = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

const projectInclude = {
  customFieldValues: {
    select: {
      customFieldGid: true,
      customFieldName: true,
      displayValue: true,
      enumOptionName: true,
      multiEnumValues: true,
      customField: { select: { mikaKey: true, mikaLabel: true } }
    }
  }
} satisfies Prisma.ProjectInclude;

type IndicatorProjectRecord = Prisma.ProjectGetPayload<{ include: typeof projectInclude }>;

export function normalizeIndicatorPeriod(value: unknown): IndicatorPeriod {
  return value === "year" || value === "all" || value === "month" ? value : "month";
}

export function normalizeIndicatorScope(value: unknown): IndicatorScope {
  return value === "civil" || value === "electrical" || value === "general" ? value : "general";
}

export function normalizeIndicatorPortfolioYear(value: unknown): IndicatorPortfolioYear {
  if (value === "all") {
    return "all";
  }

  return typeof value === "string" && /^\d{4}$/.test(value) ? (value as IndicatorPortfolioYear) : "all";
}

export async function buildIndicators(
  period: IndicatorPeriod,
  scope: IndicatorScope,
  portfolioYear: IndicatorPortfolioYear = "all"
): Promise<IndicatorsResponse> {
  const window = periodWindow(period);
  const [tasks, projects, portfolioYearRows] = await Promise.all([
    prisma.task.findMany({
      where: {
        parentId: null,
        ...excludeBacklogWhere(),
        ...indicatorTaskPeriodWhere(period)
      },
      include: taskInclude
    }),
    prisma.project.findMany({
      where: portfolioYearWhere(portfolioYear),
      include: projectInclude
    }),
    prisma.project.findMany({
      select: { asanaCreatedAt: true, createdAt: true }
    })
  ]);

  const scopedTasks = tasks.filter((task) => indicatorTaskMatchesScope(task, scope));

  return {
    period,
    scope,
    portfolioYear,
    availablePortfolioYears: availablePortfolioYears(portfolioYearRows),
    periodLabel: window.label,
    generatedAt: new Date().toISOString(),
    tasks: buildTasksSection(scopedTasks, window),
    portfolio: buildPortfolioSection(projects),
    team: {
      byScope: indicatorScopes.map((itemScope) => buildScopePoint(itemScope, tasks.filter((task) => indicatorTaskMatchesScope(task, itemScope)))),
      byUser: sortUserPoints(buildUserPoints(scopedTasks)).slice(0, 12)
    }
  };
}

function periodWindow(period: IndicatorPeriod, today = new Date()): PeriodWindow {
  if (period === "all") {
    return { from: null, to: null, fromDate: null, toDate: null, label: "Todos os tempos" };
  }

  const fromDate = period === "year" ? startOfYear(today) : startOfMonth(today);
  const toDate = period === "year" ? endOfYear(today) : endOfMonth(today);

  return {
    from: format(fromDate, "yyyy-MM-dd"),
    to: format(toDate, "yyyy-MM-dd"),
    fromDate,
    toDate,
    label: period === "year" ? "Ano atual" : "Mês atual"
  };
}

export function indicatorTaskPeriodWhere(period: IndicatorPeriod): Prisma.TaskWhereInput {
  const window = periodWindow(period);

  if (!window.from || !window.to || !window.fromDate || !window.toDate) {
    return {};
  }

  return {
    OR: [
      { dueOn: { gte: window.from, lte: window.to } },
      { dueAt: { gte: window.fromDate, lte: window.toDate } },
      { completedAtAsana: { gte: window.fromDate, lte: window.toDate } }
    ]
  };
}

function portfolioYearWhere(portfolioYear: IndicatorPortfolioYear): Prisma.ProjectWhereInput {
  if (portfolioYear === "all") {
    return {};
  }

  const fromDate = new Date(`${portfolioYear}-01-01T00:00:00.000Z`);
  const toDate = new Date(`${portfolioYear}-12-31T23:59:59.999Z`);

  return {
    OR: [
      { asanaCreatedAt: { gte: fromDate, lte: toDate } },
      {
        AND: [
          { asanaCreatedAt: null },
          { createdAt: { gte: fromDate, lte: toDate } }
        ]
      }
    ]
  };
}

export function indicatorTaskMatchesScope(task: {
  memberships: Array<{
    project: { archived: boolean } | null;
    section: { name: string; project: { archived: boolean } } | null;
  }>;
}, scope: IndicatorScope): boolean {
  if (scope === "general") {
    if (task.memberships.length === 0) {
      return true;
    }

    return task.memberships.some((membership) => {
      const project = membership.section?.project ?? membership.project;
      return Boolean(project && !project.archived);
    });
  }

  return task.memberships.some((membership) => {
    const project = membership.section?.project ?? membership.project;
    return Boolean(project && !project.archived && sectionMatchesWorkloadScope(membership.section?.name, scope));
  });
}

export function indicatorTaskMatchesMetric(
  task: {
    completed?: boolean | null;
    mikaStatus?: string | null;
    assigneeStatus?: string | null;
    dueOn?: string | null;
    dueAt?: Date | null;
  },
  metric: "openTasks" | "completedTasks" | "overdueTasks" | "dueTasks" | "allTasks",
  period: IndicatorPeriod
): boolean {
  if (metric === "allTasks") {
    return true;
  }

  if (metric === "openTasks") {
    return !task.completed;
  }

  if (metric === "completedTasks") {
    return Boolean(task.completed);
  }

  if (metric === "overdueTasks") {
    return publicTaskStatus({
      completed: Boolean(task.completed),
      mikaStatus: task.mikaStatus ?? null,
      assigneeStatus: task.assigneeStatus ?? null,
      dueOn: task.dueOn ?? null,
      dueAt: task.dueAt ?? null
    }) === TaskStatus.OVERDUE;
  }

  return dateInWindow(taskDueDate(task), periodWindow(period));
}

function buildTasksSection(tasks: IndicatorTaskRecord[], window: PeriodWindow) {
  const statusDistribution = buildStatusDistribution(tasks);
  const users = buildUserPoints(tasks);

  return {
    kpis: {
      openTasks: tasks.filter((task) => !task.completed).length,
      completedTasks: tasks.filter((task) => task.completed).length,
      overdueTasks: tasks.filter((task) => publicTaskStatus(task) === TaskStatus.OVERDUE).length,
      dueTasks: tasks.filter((task) => taskDueDate(task) !== null && dateInWindow(taskDueDate(task), window)).length,
      onTimeRate: calculateOnTimeRate(tasks)
    },
    statusDistribution,
    byUser: sortUserPoints(users).slice(0, 12),
    overdueByUser: sortUserPoints(users.filter((user) => user.overdueTasks > 0), "overdueTasks").slice(0, 8)
  };
}

function buildStatusDistribution(tasks: IndicatorTaskRecord[]): IndicatorStatusPoint[] {
  const counts = new Map<TaskStatusValue, number>();

  tasks.forEach((task) => {
    const status = publicTaskStatus(task);
    counts.set(status, (counts.get(status) ?? 0) + 1);
  });

  return Object.values(TaskStatus)
    .filter((status) => status !== TaskStatus.BACKLOG)
    .map((status) => ({
      status: status as SharedTaskStatus,
      label: taskStatusLabels[status],
      value: counts.get(status) ?? 0
    }))
    .filter((point) => point.value > 0);
}

function buildUserPoints(tasks: IndicatorTaskRecord[]): IndicatorUserPoint[] {
  const byUser = new Map<string, IndicatorUserPoint>();

  tasks.forEach((task) => {
    const key = task.assignee?.id ?? "__unassigned__";
    const current = byUser.get(key) ?? {
      userId: task.assignee?.id ?? null,
      userName: task.assignee?.name ?? "Sem responsável",
      initials: initials(task.assignee?.name ?? "SR"),
      openTasks: 0,
      completedTasks: 0,
      overdueTasks: 0,
      estimatedDays: 0
    };

    if (task.completed) {
      current.completedTasks += 1;
    } else {
      current.openTasks += 1;
    }

    if (publicTaskStatus(task) === TaskStatus.OVERDUE) {
      current.overdueTasks += 1;
    }

    current.estimatedDays = roundMetric(current.estimatedDays + (task.estimatedDays ?? 0));
    byUser.set(key, current);
  });

  return [...byUser.values()];
}

function sortUserPoints(points: IndicatorUserPoint[], primary: keyof IndicatorUserPoint = "openTasks"): IndicatorUserPoint[] {
  return [...points].sort((a, b) => {
    const primaryDiff = numericPointValue(b, primary) - numericPointValue(a, primary);
    if (primaryDiff !== 0) {
      return primaryDiff;
    }

    const totalA = a.openTasks + a.completedTasks + a.overdueTasks;
    const totalB = b.openTasks + b.completedTasks + b.overdueTasks;
    if (totalB !== totalA) {
      return totalB - totalA;
    }

    return a.userName.localeCompare(b.userName, "pt-BR");
  });
}

function numericPointValue(point: IndicatorUserPoint, key: keyof IndicatorUserPoint): number {
  const value = point[key];
  return typeof value === "number" ? value : 0;
}

function calculateOnTimeRate(tasks: IndicatorTaskRecord[]): number {
  const completedWithDue = tasks.filter((task) => {
    return Boolean(task.completed && task.completedAtAsana && taskDueDate(task));
  });

  if (completedWithDue.length === 0) {
    return 0;
  }

  const onTime = completedWithDue.filter((task) => {
    const completedAt = task.completedAtAsana?.toISOString().slice(0, 10);
    const dueDate = taskDueDate(task);
    return Boolean(completedAt && dueDate && completedAt <= dueDate);
  }).length;

  return Math.round((onTime / completedWithDue.length) * 100);
}

function taskDueDate(task: { dueOn?: string | null; dueAt?: Date | null }): string | null {
  return task.dueOn?.slice(0, 10) ?? task.dueAt?.toISOString().slice(0, 10) ?? null;
}

function dateInWindow(value: string | null, window: PeriodWindow): boolean {
  if (!value) {
    return false;
  }

  if (!window.from || !window.to) {
    return true;
  }

  return value >= window.from && value <= window.to;
}

function buildScopePoint(scope: IndicatorScope, tasks: IndicatorTaskRecord[]): IndicatorScopePoint {
  const users = buildUserPoints(tasks);

  return {
    scope,
    label: scopeLabels[scope],
    openTasks: users.reduce((sum, user) => sum + user.openTasks, 0),
    completedTasks: users.reduce((sum, user) => sum + user.completedTasks, 0),
    overdueTasks: users.reduce((sum, user) => sum + user.overdueTasks, 0),
    estimatedDays: roundMetric(users.reduce((sum, user) => sum + user.estimatedDays, 0))
  };
}

function buildPortfolioSection(projects: IndicatorProjectRecord[]) {
  const disciplineRows = buildDisciplineRows(projects);
  const projectedAreaByDiscipline = disciplineRows.map((row) => ({
    key: row.key,
    label: row.label,
    value: row.projectedAreaM2
  }));

  return {
    kpis: {
      totalProjects: projects.length,
      cadProjects: projects.filter((project) => project.platform === "CAD").length,
      bimProjects: projects.filter((project) => project.platform === "BIM").length,
      areaM2: roundMetric(projects.reduce((sum, project) => sum + (project.areaM2 ?? 0), 0)),
      projectedAreaM2: roundMetric(disciplineRows.reduce((sum, row) => sum + row.projectedAreaM2, 0))
    },
    byPlatform: buildPlatformDistribution(projects),
    byDiscipline: disciplineRows.map((row) => ({ key: row.key, label: row.label, value: row.value })),
    projectedAreaByDiscipline,
    statusGroups: buildPortfolioStatusGroups(projects)
  };
}

function buildPlatformDistribution(projects: IndicatorProjectRecord[]): IndicatorValuePoint[] {
  const counts = new Map<string, number>([
    ["CAD", 0],
    ["BIM", 0],
    ["none", 0]
  ]);

  projects.forEach((project) => {
    const key = project.platform === "CAD" || project.platform === "BIM" ? project.platform : "none";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return [
    { key: "CAD", label: "CAD", value: counts.get("CAD") ?? 0 },
    { key: "BIM", label: "BIM", value: counts.get("BIM") ?? 0 },
    { key: "none", label: "Sem plataforma", value: counts.get("none") ?? 0 }
  ].filter((point) => point.value > 0);
}

function buildDisciplineRows(projects: IndicatorProjectRecord[]): Array<IndicatorValuePoint & { projectedAreaM2: number }> {
  const rows = new Map<string, IndicatorValuePoint & { projectedAreaM2: number }>();

  projects.forEach((project) => {
    const disciplineNames = projectDisciplineNames(project);
    disciplineNames.forEach((name) => {
      const key = normalizeKey(name);
      const current = rows.get(key) ?? { key, label: name, value: 0, projectedAreaM2: 0 };
      current.value += 1;
      current.projectedAreaM2 = roundMetric(current.projectedAreaM2 + (project.areaM2 ?? 0));
      rows.set(key, current);
    });
  });

  return [...rows.values()].sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "pt-BR"));
}

function projectDisciplineNames(project: IndicatorProjectRecord): string[] {
  const value = findProjectCatalogValue(project, "disciplinas");
  if (!Array.isArray(value?.multiEnumValues)) {
    return [];
  }

  return value.multiEnumValues
    .map((entry) => {
      if (!entry || typeof entry !== "object" || !("name" in entry) || typeof entry.name !== "string") {
        return null;
      }

      return entry.name.trim() || null;
    })
    .filter((name): name is string => Boolean(name));
}

function buildPortfolioStatusGroups(projects: IndicatorProjectRecord[]): IndicatorPortfolioStatusGroup[] {
  return PORTFOLIO_CATALOG.filter((field) => field.type === "enum").map((field) => {
    const counts = new Map<string, number>();

    projects.forEach((project) => {
      const value = findProjectCatalogValue(project, field.key);
      const label = (value?.enumOptionName ?? value?.displayValue ?? "Sem status").trim() || "Sem status";
      counts.set(label, (counts.get(label) ?? 0) + 1);
    });

    return {
      fieldKey: field.key,
      label: field.label,
      values: [...counts.entries()]
        .map(([label, value]) => ({ key: normalizeKey(label), label, value }))
        .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "pt-BR"))
    };
  });
}

function findProjectCatalogValue(project: IndicatorProjectRecord, fieldKey: string) {
  return project.customFieldValues.find((value) => {
    if (value.customFieldGid === portfolioCatalogGid(fieldKey)) {
      return true;
    }

    const field = findPortfolioCatalogField({
      mikaKey: value.customField?.mikaKey,
      customFieldGid: value.customFieldGid,
      label: value.customField?.mikaLabel ?? value.customFieldName
    });

    return field?.key === fieldKey;
  });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "S").concat(parts[1]?.[0] ?? parts[0]?.[1] ?? "").toUpperCase();
}

function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "none";
}

function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

function availablePortfolioYears(rows: Array<{ asanaCreatedAt: Date | null; createdAt: Date }>): string[] {
  const years = new Set<string>();

  rows.forEach((row) => {
    const year = (row.asanaCreatedAt ?? row.createdAt).getUTCFullYear();
    years.add(String(year));
  });

  return [...years].sort((a, b) => Number(b) - Number(a));
}
