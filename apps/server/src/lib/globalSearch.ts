import type { Prisma } from "../generated/prisma/client.js";
import type {
  AdvancedSearchCompletion,
  AdvancedSearchProjectResult,
  AdvancedSearchTaskResult,
  AdvancedSearchType,
  AdvancedSearchUserResult,
  GlobalSearchProjectResult,
  GlobalSearchTaskResult,
  GlobalSearchUserResult
} from "shared";
import { Priority, ProjectStatus, TaskStatus } from "./enums.js";

export const GLOBAL_SEARCH_DEFAULT_LIMIT = 12;
export const GLOBAL_SEARCH_MAX_LIMIT = 25;
export const ADVANCED_SEARCH_DEFAULT_LIMIT = 25;
export const ADVANCED_SEARCH_MAX_LIMIT = 50;

export function normalizeSearchTerm(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function searchTextMatches(term: string, values: Array<string | null | undefined>): boolean {
  const normalizedTerm = normalizeSearchText(term);

  if (!normalizedTerm) {
    return true;
  }

  return values.some((value) => normalizeSearchText(value).includes(normalizedTerm));
}

export function clampSearchLimit(value: unknown): number {
  const parsed = typeof value === "string" || typeof value === "number" ? Number(value) : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return GLOBAL_SEARCH_DEFAULT_LIMIT;
  }

  return Math.min(Math.max(Math.trunc(parsed), 1), GLOBAL_SEARCH_MAX_LIMIT);
}

export function clampAdvancedSearchLimit(value: unknown): number {
  const parsed = typeof value === "string" || typeof value === "number" ? Number(value) : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return ADVANCED_SEARCH_DEFAULT_LIMIT;
  }

  return Math.min(Math.max(Math.trunc(parsed), 1), ADVANCED_SEARCH_MAX_LIMIT);
}

export function parseAdvancedSearchPage(value: unknown): number {
  const parsed = typeof value === "string" || typeof value === "number" ? Number(value) : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return 1;
  }

  return Math.max(Math.trunc(parsed), 1);
}

export function paginateSearchResults<TItem>(items: TItem[], page: number, limit: number): TItem[] {
  return items.slice((page - 1) * limit, page * limit);
}

export function buildProjectSearchWhere(term: string): Prisma.ProjectWhereInput {
  if (!term) {
    return {};
  }

  return {
    OR: [
      { name: { contains: term } },
      { builder: { contains: term } },
      { team: { name: { contains: term } } },
      { workspace: { name: { contains: term } } }
    ]
  };
}

export function buildAdvancedProjectSearchWhere(filters: {
  term: string;
  projectStatuses: ProjectStatus[];
  projectId?: string;
}): Prisma.ProjectWhereInput {
  const where: Prisma.ProjectWhereInput = buildProjectSearchWhere(filters.term);
  const and: Prisma.ProjectWhereInput[] = [where];

  if (filters.projectId) {
    and.push({ id: filters.projectId });
  }

  if (filters.projectStatuses.length > 0) {
    and.push({
      OR: filters.projectStatuses.map((status) => ({
        archived: status === ProjectStatus.ACTIVE || status === ProjectStatus.ON_HOLD ? false : true
      }))
    });
  }

  return and.length === 1 ? where : { AND: and };
}

export function buildTaskSearchWhere(term: string): Prisma.TaskWhereInput {
  const base: Prisma.TaskWhereInput = { parentId: null };

  if (!term) {
    return base;
  }

  return {
    ...base,
    OR: [
      { name: { contains: term } },
      { memberships: { some: { sectionName: { contains: term } } } },
      { memberships: { some: { projectName: { contains: term } } } },
      { memberships: { some: { section: { name: { contains: term } } } } },
      { memberships: { some: { section: { project: { name: { contains: term } } } } } },
      { memberships: { some: { project: { name: { contains: term } } } } }
    ]
  };
}

export function buildAdvancedTaskSearchWhere(filters: {
  term: string;
  projectId?: string;
  taskStatuses: TaskStatus[];
  priorities: Priority[];
  assigneeId?: string;
  dueFrom?: string;
  dueTo?: string;
  completion: AdvancedSearchCompletion;
}): Prisma.TaskWhereInput {
  const base = buildTaskSearchWhere(filters.term);
  const and: Prisma.TaskWhereInput[] = [base];

  if (filters.projectId) {
    and.push({
      memberships: {
        some: {
          OR: [
            { project: { id: filters.projectId } },
            { section: { project: { id: filters.projectId } } }
          ]
        }
      }
    });
  }

  if (filters.taskStatuses.length > 0) {
    and.push({ mikaStatus: { in: filters.taskStatuses } });
  }

  if (filters.priorities.length > 0) {
    and.push({ priority: { in: filters.priorities } });
  }

  if (filters.assigneeId) {
    and.push({ assignee: { id: filters.assigneeId } });
  }

  if (filters.dueFrom || filters.dueTo) {
    and.push({
      dueOn: {
        ...(filters.dueFrom ? { gte: filters.dueFrom } : {}),
        ...(filters.dueTo ? { lte: filters.dueTo } : {})
      }
    });
  }

  if (filters.completion === "open") {
    and.push({ completed: false });
  }

  if (filters.completion === "completed") {
    and.push({ completed: true });
  }

  return { AND: and };
}

export function buildUserSearchWhere(term: string): Prisma.UserWhereInput {
  const base: Prisma.UserWhereInput = { isActive: true };

  if (!term) {
    return base;
  }

  return {
    ...base,
    OR: [
      { name: { contains: term } },
      { email: { contains: term } }
    ]
  };
}

interface ProjectSearchRecord {
  id: string;
  name: string;
  builder: string | null;
  team: { name: string } | null;
  workspace: { name: string } | null;
}

export function projectMatchesSearch(project: ProjectSearchRecord, term: string): boolean {
  return searchTextMatches(term, [project.name, project.builder, project.team?.name, project.workspace?.name]);
}

export function toGlobalSearchProject(project: ProjectSearchRecord): GlobalSearchProjectResult {
  return {
    id: project.id,
    name: project.name,
    client: project.builder ?? project.team?.name ?? project.workspace?.name ?? null
  };
}

export const taskSearchInclude = {
  assignee: true,
  memberships: {
    include: {
      section: {
        include: {
          project: true
        }
      },
      project: true
    }
  }
} satisfies Prisma.TaskInclude;

interface TaskSearchRecord {
  id: string;
  name: string;
  mikaStatus?: string | null;
  priority?: string | null;
  assigneeGid?: string | null;
  dueOn?: string | null;
  completed?: boolean;
  updatedAt?: Date;
  assignee?: {
    id: string;
    name: string;
  } | null;
  memberships: Array<{
    sectionName: string | null;
    projectName: string | null;
    section: {
      name: string;
      project: {
        id: string;
        name: string;
      };
    } | null;
    project: {
      id: string;
      name: string;
    } | null;
  }>;
}

export function toGlobalSearchTask(task: TaskSearchRecord): GlobalSearchTaskResult | null {
  for (const membership of task.memberships) {
    const project = membership.section?.project ?? membership.project;
    const projectId = project?.id ?? null;
    const projectName = project?.name ?? membership.projectName ?? null;

    if (!projectId || !projectName) {
      continue;
    }

    return {
      id: task.id,
      title: task.name,
      projectId,
      projectName,
      sectionName: membership.section?.name ?? membership.sectionName ?? "Sem secao"
    };
  }

  return null;
}

export function toAdvancedSearchTask(task: TaskSearchRecord): AdvancedSearchTaskResult | null {
  const base = toGlobalSearchTask(task);

  if (!base) {
    return null;
  }

  const status = isTaskStatus(task.mikaStatus) ? task.mikaStatus : TaskStatus.TODO;
  const priority = isPriority(task.priority) ? task.priority : Priority.MEDIUM;

  return {
    ...base,
    status: status as AdvancedSearchTaskResult["status"],
    priority: priority as AdvancedSearchTaskResult["priority"],
    assigneeId: task.assignee?.id ?? null,
    assigneeName: task.assignee?.name ?? null,
    dueDate: task.dueOn ?? null,
    completed: task.completed ?? false,
    updatedAt: task.updatedAt?.toISOString() ?? ""
  };
}

export function taskMatchesSearch(task: TaskSearchRecord, term: string): boolean {
  const values: Array<string | null | undefined> = [task.name];

  for (const membership of task.memberships) {
    values.push(
      membership.sectionName,
      membership.projectName,
      membership.section?.name,
      membership.section?.project.name,
      membership.project?.name
    );
  }

  return searchTextMatches(term, values);
}

interface UserSearchRecord {
  id: string;
  name: string;
  email: string;
  role?: string;
}

export function userMatchesSearch(user: UserSearchRecord, term: string): boolean {
  return searchTextMatches(term, [user.name, user.email]);
}

export function toGlobalSearchUser(user: UserSearchRecord): GlobalSearchUserResult {
  return {
    id: user.id,
    name: user.name,
    email: user.email
  };
}

export function toAdvancedSearchProject(project: ProjectSearchRecord & {
  archived?: boolean;
  platform?: string | null;
  dueOn?: string | null;
  dueDate?: string | null;
  updatedAt?: Date;
}): AdvancedSearchProjectResult {
  return {
    ...toGlobalSearchProject(project),
    status: (project.archived ? ProjectStatus.COMPLETED : ProjectStatus.ACTIVE) as AdvancedSearchProjectResult["status"],
    platform: project.platform === "CAD" || project.platform === "BIM" ? project.platform : null,
    dueDate: project.dueOn ?? project.dueDate ?? null,
    updatedAt: project.updatedAt?.toISOString() ?? ""
  };
}

export function projectMatchesAdvancedStatus(project: { archived?: boolean }, statuses: ProjectStatus[]): boolean {
  if (statuses.length === 0) {
    return true;
  }

  const status = project.archived ? ProjectStatus.COMPLETED : ProjectStatus.ACTIVE;
  return statuses.includes(status);
}

export function toAdvancedSearchUser(user: UserSearchRecord): AdvancedSearchUserResult {
  return {
    ...toGlobalSearchUser(user),
    role: (isRole(user.role) ? user.role : "DESIGNER") as AdvancedSearchUserResult["role"]
  };
}

export function shouldSearchBucket(type: AdvancedSearchType, bucket: Exclude<AdvancedSearchType, "all">): boolean {
  return type === "all" || type === bucket;
}

function isTaskStatus(value: string | null | undefined): value is TaskStatus {
  return Object.values(TaskStatus).includes(value as TaskStatus);
}

function isPriority(value: string | null | undefined): value is Priority {
  return Object.values(Priority).includes(value as Priority);
}

function isRole(value: string | null | undefined): value is AdvancedSearchUserResult["role"] {
  return value === "ADMIN" || value === "COORDINATOR" || value === "DESIGNER" || value === "INTERN";
}
