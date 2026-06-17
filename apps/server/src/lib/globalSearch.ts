import type { Prisma } from "../generated/prisma/client.js";
import type {
  GlobalSearchProjectResult,
  GlobalSearchTaskResult,
  GlobalSearchUserResult
} from "shared";

export const GLOBAL_SEARCH_DEFAULT_LIMIT = 12;
export const GLOBAL_SEARCH_MAX_LIMIT = 25;

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
