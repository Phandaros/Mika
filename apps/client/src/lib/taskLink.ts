import type { Task } from "shared";

export type TaskLinkSource = Pick<Task, "id"> & {
  discipline?: { projectId?: string } | null;
  projects?: Array<{ id: string }> | null;
};

export interface BuildTaskLinkOptions {
  fallbackPath?: string;
}

function resolveProjectId(task: TaskLinkSource): string | undefined {
  return task.discipline?.projectId ?? task.projects?.[0]?.id;
}

export function buildTaskPath(task: TaskLinkSource, options?: BuildTaskLinkOptions): string {
  const projectId = resolveProjectId(task);
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
  const hashPrefix = typeof window !== "undefined" && window.mkProjetos?.isDesktop === true ? "#" : "";
  return `${window.location.origin}${hashPrefix}${path}`;
}

export function resolveTaskProjectId(task: TaskLinkSource): string | undefined {
  return resolveProjectId(task);
}
