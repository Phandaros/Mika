import type { Task } from "shared";

const ignoredProjectNames = new Set(["civil - sprint board", "eletrico - sprint board"]);

type WorkloadLabelTask = Pick<Task, "title" | "projects" | "discipline">;

export type WorkloadTaskDisplayLabel = {
  taskTitle: string;
  projectName: string | null;
  fullLabel: string;
};

export function workloadTaskLabel(task: WorkloadLabelTask, mode: "project" | "global"): string {
  return workloadTaskDisplayLabel(task, mode).fullLabel;
}

export function workloadTaskDisplayLabel(task: WorkloadLabelTask, mode: "project" | "global"): WorkloadTaskDisplayLabel {
  if (mode !== "global") {
    return {
      taskTitle: task.title,
      projectName: null,
      fullLabel: task.title
    };
  }

  const projectName = prefixedProjectName(task) ?? displayProjectName(task);
  if (!projectName) {
    return {
      taskTitle: task.title,
      projectName: null,
      fullLabel: task.title
    };
  }

  const taskTitle = stripProjectPrefix(task.title, projectName);
  return {
    taskTitle,
    projectName,
    fullLabel: `[${projectName}] ${taskTitle}`
  };
}

function prefixedProjectName(task: WorkloadLabelTask): string | null {
  const linkedNames = [
    ...(task.projects?.map((project) => project.name) ?? []),
    task.discipline?.projectName ?? null
  ];

  return linkedNames.find((name) => name && !isIgnoredProjectName(name) && titleAlreadyHasProjectPrefix(task.title, name)) ?? null;
}

function displayProjectName(task: WorkloadLabelTask): string | null {
  const projectFromMemberships = task.projects?.find((project) => !isIgnoredProjectName(project.name));
  if (projectFromMemberships) {
    return projectFromMemberships.name;
  }

  const projectFromDiscipline = task.discipline?.projectName;
  return projectFromDiscipline && !isIgnoredProjectName(projectFromDiscipline) ? projectFromDiscipline : null;
}

function titleAlreadyHasProjectPrefix(title: string, projectName: string): boolean {
  const prefix = title.match(/^\s*\[([^\]]+)\]/)?.[1];
  return prefix ? prefixLooksLikeProject(prefix, projectName) : false;
}

function stripProjectPrefix(title: string, projectName: string): string {
  const prefixMatch = title.match(/^\s*\[([^\]]+)\]\s*/);
  if (!prefixMatch || !prefixLooksLikeProject(prefixMatch[1] ?? "", projectName)) {
    return title;
  }

  return title.slice(prefixMatch[0].length).replace(/^[–—-]\s*/, "").trim() || title;
}

function prefixLooksLikeProject(prefix: string, projectName: string): boolean {
  const normalizedPrefix = normalizeProjectName(prefix);
  const normalizedProject = normalizeProjectName(projectName);
  if (normalizedPrefix === normalizedProject) {
    return true;
  }

  if (normalizedProject.startsWith(`${normalizedPrefix} `)) {
    return true;
  }

  const maxDistance = Math.max(1, Math.floor(normalizedProject.length * 0.15));
  return editDistanceWithin(normalizedPrefix, normalizedProject, maxDistance);
}

function editDistanceWithin(left: string, right: string, maxDistance: number): boolean {
  if (Math.abs(left.length - right.length) > maxDistance) {
    return false;
  }

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    let rowMin = current[0] ?? i;
    for (let j = 1; j <= right.length; j += 1) {
      const substitutionCost = left[i - 1] === right[j - 1] ? 0 : 1;
      const value = Math.min(
        (previous[j] ?? 0) + 1,
        (current[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + substitutionCost
      );
      current[j] = value;
      rowMin = Math.min(rowMin, value);
    }

    if (rowMin > maxDistance) {
      return false;
    }

    previous = current;
  }

  return (previous[right.length] ?? 0) <= maxDistance;
}

function isIgnoredProjectName(name: string): boolean {
  return ignoredProjectNames.has(normalizeProjectName(name));
}

function normalizePrefix(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

function normalizeProjectName(value: string): string {
  return normalizePrefix(value);
}
