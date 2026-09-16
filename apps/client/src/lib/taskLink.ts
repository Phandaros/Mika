import type { Task } from "shared";

export type TaskLinkSource = Pick<Task, "id"> & {
  discipline?: { projectId?: string; projectName?: string | null } | null;
  projects?: Array<{ id: string; name?: string | null }> | null;
};

export interface BuildTaskLinkOptions {
  fallbackPath?: string;
  projectId?: string;
}

function isOperationalSprintBoard(name: string | null | undefined): boolean {
  if (!name) {
    return false;
  }

  const normalizedName = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");

  return normalizedName.includes("sprint") && normalizedName.includes("board");
}

function resolveProjectId(task: TaskLinkSource): string | undefined {
  const disciplineProjectId = task.discipline?.projectId;
  const disciplineProject = task.projects?.find((project) => project.id === disciplineProjectId);
  const disciplineProjectName = task.discipline?.projectName ?? disciplineProject?.name;

  if (disciplineProjectId && !isOperationalSprintBoard(disciplineProjectName)) {
    return disciplineProjectId;
  }

  const portfolioProject = task.projects?.find((project) => !isOperationalSprintBoard(project.name));
  return portfolioProject?.id ?? disciplineProjectId ?? task.projects?.[0]?.id;
}

export function buildTaskPath(task: TaskLinkSource, options?: BuildTaskLinkOptions): string {
  const projectId = options?.projectId ?? resolveProjectId(task);
  const encodedTaskId = encodeURIComponent(task.id);

  if (projectId) {
    return `/projects/${projectId}?task=${encodedTaskId}`;
  }

  if (options?.fallbackPath) {
    const separator = options.fallbackPath.includes("?") ? "&" : "?";
    return `${options.fallbackPath}${separator}task=${encodedTaskId}`;
  }

  const currentPath = typeof window !== "undefined" ? window.location.pathname : "/";
  const separator = currentPath.includes("?") ? "&" : "?";
  return `${currentPath}${separator}task=${encodedTaskId}`;
}

export function buildTaskLink(task: TaskLinkSource, options?: BuildTaskLinkOptions): string {
  const path = buildTaskPath(task, options);
  return buildAbsoluteAppUrl(path);
}

export function buildAbsoluteAppUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const hashPrefix = typeof window !== "undefined" && window.mkProjetos?.isDesktop === true ? "#" : "";
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return `${origin}${hashPrefix}${normalizedPath}`;
}

export function openTaskInNewContext(task: TaskLinkSource, options?: BuildTaskLinkOptions): void {
  const path = buildTaskPath(task, options);

  if (typeof window !== "undefined" && window.mkProjetos?.isDesktop === true) {
    void window.mkProjetos.openTaskWindow(path);
    return;
  }

  window.open(buildAbsoluteAppUrl(path), "_blank", "noopener,noreferrer");
}

export function resolveTaskProjectId(task: TaskLinkSource): string | undefined {
  return resolveProjectId(task);
}
