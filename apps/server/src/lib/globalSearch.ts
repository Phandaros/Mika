import type { Prisma } from "../generated/prisma/client.js";
import type {
  AdvancedSearchCompletion,
  AdvancedSearchIndicatorMetric,
  AdvancedSearchProjectResult,
  AdvancedSearchTaskResult,
  AdvancedSearchType,
  AdvancedSearchUserResult,
  GlobalSearchProjectResult,
  GlobalSearchTaskResult,
  GlobalSearchUserResult,
  TaskSearchMatchContext
} from "shared";
import { Priority, ProjectStatus, TaskStatus, type DeliveryStatus as DeliveryStatusValue } from "./enums.js";
import {
  indicatorTaskMatchesMetric,
  indicatorTaskMatchesScope,
  indicatorTaskPeriodWhere
} from "./indicators.js";
import { activeTaskWhere } from "./taskDeletion.js";
import { publicTaskStatus } from "./taskStatus.js";
import { taskDeliveryStatus } from "./taskDeliveryStatus.js";
import { activeStatusesWhere, excludeBacklogWhere } from "./taskStatusWhere.js";

export const GLOBAL_SEARCH_DEFAULT_LIMIT = 12;
export const GLOBAL_SEARCH_MAX_LIMIT = 25;
export const ADVANCED_SEARCH_DEFAULT_LIMIT = 25;
export const ADVANCED_SEARCH_MAX_LIMIT = 50;
export const TASK_SEARCH_EXCERPT_MAX_LENGTH = 180;

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
  const base: Prisma.TaskWhereInput = { ...activeTaskWhere(), parentId: null };

  if (!term) {
    return base;
  }

  return {
    ...base,
    OR: [
      { name: { contains: term } },
      { notes: { contains: term } },
      { comments: { some: { content: { contains: term } } } },
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
  indicatorPeriod?: import("shared").IndicatorPeriod;
  indicatorFrom?: string;
  indicatorTo?: string;
}): Prisma.TaskWhereInput {
  const base = buildTaskSearchWhere(filters.term);
  const and: Prisma.TaskWhereInput[] = [base];

  if (filters.indicatorPeriod) {
    and.push(excludeBacklogWhere());
    and.push(indicatorTaskPeriodWhere(filters.indicatorPeriod, filters.indicatorFrom, filters.indicatorTo));
  }

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
    and.push(activeStatusesWhere(filters.taskStatuses));
  }

  if (filters.priorities.length > 0) {
    and.push({ priority: { in: filters.priorities } });
  }

  if (filters.assigneeId) {
    and.push({ assignee: { id: filters.assigneeId } });
  }

  if (filters.dueFrom || filters.dueTo) {
    const fromDate = filters.dueFrom ? new Date(`${filters.dueFrom}T00:00:00.000Z`) : null;
    const toDate = filters.dueTo ? new Date(`${filters.dueTo}T23:59:59.999Z`) : null;
    and.push({
      OR: [
        {
          dueOn: {
            ...(filters.dueFrom ? { gte: filters.dueFrom } : {}),
            ...(filters.dueTo ? { lte: filters.dueTo } : {})
          }
        },
        {
          dueAt: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: toDate } : {})
          }
        }
      ]
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
  notes?: string | null;
  mikaStatus?: string | null;
  assigneeStatus?: string | null;
  priority?: string | null;
  assigneeGid?: string | null;
  dueOn?: string | null;
  dueAt?: Date | null;
  completedAtAsana?: Date | null;
  estimatedDays?: number | null;
  estimatedTime?: number | null;
  conclusionDays?: number | null;
  completed?: boolean;
  updatedAt?: Date;
  assignee?: {
    id: string;
    name: string;
  } | null;
  comments?: Array<{
    content: string;
    createdAt: Date;
  }>;
  memberships: Array<{
    sectionName: string | null;
    projectName: string | null;
    section: {
      name: string;
      project: {
        id: string;
        name: string;
        archived: boolean;
      };
    } | null;
    project: {
      id: string;
      name: string;
      archived: boolean;
    } | null;
  }>;
}

export function filterTasksByDeliveryStatus(tasks: TaskSearchRecord[], deliveryStatuses: DeliveryStatusValue[]): TaskSearchRecord[] {
  if (deliveryStatuses.length === 0) {
    return tasks;
  }

  const allowed = new Set(deliveryStatuses);
  return tasks.filter((task) => {
    const status = taskDeliveryStatus({
      completed: Boolean(task.completed),
      estimatedDays: task.estimatedDays ?? null,
      estimatedTime: task.estimatedTime ?? null,
      conclusionDays: task.conclusionDays ?? null
    });
    return Boolean(status && allowed.has(status));
  });
}

export function filterTasksByIndicator(
  tasks: TaskSearchRecord[],
  filters: {
    indicatorMetric?: AdvancedSearchIndicatorMetric;
    indicatorPeriod?: import("shared").IndicatorPeriod;
    indicatorScope?: import("shared").IndicatorScope;
    indicatorFrom?: string;
    indicatorTo?: string;
  }
): TaskSearchRecord[] {
  if (!filters.indicatorMetric || !filters.indicatorPeriod || !filters.indicatorScope) {
    return tasks;
  }

  return tasks.filter((task) => {
    return (
      indicatorTaskMatchesScope(task, filters.indicatorScope!) &&
      indicatorTaskMatchesMetric(
        task,
        filters.indicatorMetric!,
        filters.indicatorPeriod!,
        filters.indicatorFrom,
        filters.indicatorTo
      )
    );
  });
}

function membershipProjectId(membership: TaskSearchRecord["memberships"][number]): string | null {
  return membership.section?.project.id ?? membership.project?.id ?? null;
}

function preferredTaskMembership(task: TaskSearchRecord, preferredProjectId?: string): TaskSearchRecord["memberships"][number] | null {
  if (preferredProjectId) {
    const preferred = task.memberships.find((membership) => membershipProjectId(membership) === preferredProjectId);

    if (preferred) {
      return preferred;
    }
  }

  return task.memberships.find((membership) => Boolean(membershipProjectId(membership))) ?? null;
}

export function toGlobalSearchTask(task: TaskSearchRecord, preferredProjectId?: string, term = ""): GlobalSearchTaskResult | null {
  const membership = preferredTaskMembership(task, preferredProjectId);

  if (membership) {
    const project = membership.section?.project ?? membership.project;
    const projectId = project?.id ?? null;
    const projectName = project?.name ?? membership.projectName ?? null;

    if (projectId && projectName) {
      const matchContext = taskSearchMatchContext(task, term);

      return {
        id: task.id,
        title: task.name,
        projectId,
        projectName,
        sectionName: membership.section?.name ?? membership.sectionName ?? "Sem secao",
        ...(matchContext ? { matchContext } : {})
      };
    }
  }

  return null;
}

export function toAdvancedSearchTask(task: TaskSearchRecord, term = ""): AdvancedSearchTaskResult | null {
  const base = toGlobalSearchTask(task, undefined, term);

  if (!base) {
    return null;
  }

  const status = publicTaskStatus({
    completed: task.completed ?? false,
    mikaStatus: task.mikaStatus ?? null,
    assigneeStatus: task.assigneeStatus ?? null,
    dueOn: task.dueOn ?? null,
    dueAt: task.dueAt ?? null
  });
  const priority = isPriority(task.priority) ? task.priority : Priority.MEDIUM;

  return {
    ...base,
    status: status as AdvancedSearchTaskResult["status"],
    priority: priority as AdvancedSearchTaskResult["priority"],
    assigneeId: task.assignee?.id ?? null,
    assigneeName: task.assignee?.name ?? null,
    dueDate: task.dueOn ?? task.dueAt?.toISOString().slice(0, 10) ?? null,
    completed: task.completed ?? false,
    updatedAt: task.updatedAt?.toISOString() ?? ""
  };
}

export function taskMatchesSearch(task: TaskSearchRecord, term: string): boolean {
  return taskSearchRank(task, term) !== null;
}

export function taskSearchRank(task: TaskSearchRecord, term: string): number | null {
  if (!normalizeSearchText(term)) {
    return 0;
  }

  if (searchTextMatches(term, [task.name])) {
    return 0;
  }

  const membershipValues: Array<string | null | undefined> = [];

  for (const membership of task.memberships) {
    membershipValues.push(
      membership.sectionName,
      membership.projectName,
      membership.section?.name,
      membership.section?.project.name,
      membership.project?.name
    );
  }

  if (searchTextMatches(term, membershipValues)) {
    return 1;
  }

  if (searchTextMatches(term, [task.notes])) {
    return 2;
  }

  if (searchTextMatches(term, (task.comments ?? []).map((comment) => comment.content))) {
    return 3;
  }

  return null;
}

export function compareTasksBySearchRelevance(left: TaskSearchRecord, right: TaskSearchRecord, term: string): number {
  const rankDifference = (taskSearchRank(left, term) ?? Number.MAX_SAFE_INTEGER) - (taskSearchRank(right, term) ?? Number.MAX_SAFE_INTEGER);

  if (rankDifference !== 0) {
    return rankDifference;
  }

  return left.name.localeCompare(right.name, "pt-BR");
}

export function taskSearchMatchContext(task: TaskSearchRecord, term: string): TaskSearchMatchContext | null {
  const rank = taskSearchRank(task, term);

  if (rank === null || rank < 2) {
    return null;
  }

  if (searchTextMatches(term, [task.notes])) {
    return {
      source: "description",
      excerpt: createSearchExcerpt(task.notes ?? "", term)
    };
  }

  const matchingComment = [...(task.comments ?? [])]
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .find((comment) => searchTextMatches(term, [comment.content]));

  if (!matchingComment) {
    return null;
  }

  return {
    source: "comment",
    excerpt: createSearchExcerpt(matchingComment.content, term)
  };
}

export function createSearchExcerpt(value: string, term: string): string {
  const text = value.replace(/\s+/g, " ").trim();

  if (text.length <= TASK_SEARCH_EXCERPT_MAX_LENGTH) {
    return text;
  }

  const match = normalizedMatchRange(text, term);
  const contentLength = TASK_SEARCH_EXCERPT_MAX_LENGTH - 2;
  const matchCenter = match ? Math.floor((match.start + match.end) / 2) : 0;
  let start = Math.max(0, matchCenter - Math.floor(contentLength / 2));
  const end = Math.min(text.length, start + contentLength);

  if (end - start < contentLength) {
    start = Math.max(0, end - contentLength);
  }

  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return `${prefix}${text.slice(start, end)}${suffix}`;
}

function normalizedMatchRange(value: string, term: string): { start: number; end: number } | null {
  const valueWithMap = normalizeSearchTextWithMap(value);
  const normalizedTerm = normalizeSearchText(term);
  const normalizedStart = valueWithMap.text.indexOf(normalizedTerm);

  if (!normalizedTerm || normalizedStart < 0) {
    return null;
  }

  const normalizedEnd = normalizedStart + normalizedTerm.length - 1;
  return {
    start: valueWithMap.startMap[normalizedStart] ?? 0,
    end: valueWithMap.endMap[normalizedEnd] ?? value.length
  };
}

function normalizeSearchTextWithMap(value: string): { text: string; startMap: number[]; endMap: number[] } {
  let text = "";
  let sourceOffset = 0;
  const startMap: number[] = [];
  const endMap: number[] = [];

  for (const sourceCharacter of Array.from(value)) {
    const normalizedCharacter = sourceCharacter.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const lettersAndNumbers = normalizedCharacter.match(/[\p{L}\p{N}]/gu)?.join("").toLowerCase() ?? "";

    if (lettersAndNumbers) {
      for (const character of Array.from(lettersAndNumbers)) {
        text += character;
        startMap.push(sourceOffset);
        endMap.push(sourceOffset + sourceCharacter.length);
      }
    } else if (text && !text.endsWith(" ")) {
      text += " ";
      startMap.push(sourceOffset);
      endMap.push(sourceOffset + sourceCharacter.length);
    }

    sourceOffset += sourceCharacter.length;
  }

  while (text.endsWith(" ")) {
    text = text.slice(0, -1);
    startMap.pop();
    endMap.pop();
  }

  return { text, startMap, endMap };
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
