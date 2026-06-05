import type { Task } from "shared";

const ignoredProjectNames = new Set(["civil - sprint board", "eletrico - sprint board"]);

type WorkloadLabelTask = Pick<Task, "title" | "projects" | "discipline">;

export function workloadTaskLabel(task: WorkloadLabelTask, mode: "project" | "global"): string {
  if (mode !== "global") {
    return task.title;
  }

  if (taskHasAnyProjectPrefix(task)) {
    return task.title;
  }

  const projectName = displayProjectName(task);
  if (!projectName) {
    return task.title;
  }

  return `[${projectName}] ${task.title}`;
}

function taskHasAnyProjectPrefix(task: WorkloadLabelTask): boolean {
  const linkedNames = [
    ...(task.projects?.map((project) => project.name) ?? []),
    task.discipline?.projectName ?? null
  ];

  return linkedNames.some((name) => name && !isIgnoredProjectName(name) && titleAlreadyHasProjectPrefix(task.title, name));
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
  return normalizePrefix(title).startsWith(`[${normalizeProjectName(projectName)}]`);
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
