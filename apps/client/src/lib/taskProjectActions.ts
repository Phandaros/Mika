import type { Task } from "shared";

export interface TaskProjectTarget {
  id: string;
  label: string;
}

function normalizeFieldName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function sectionAbbreviation(name: string): string {
  const normalized = normalizeFieldName(name);

  if (normalized === "eletrico" || normalized === "eletrica") {
    return "ELE";
  }

  if (normalized === "civil") {
    return "CIV";
  }

  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 3)
    .toUpperCase();
}

function projectTargetLabel(name: string, sectionName?: string | null): string {
  return sectionName ? `${name} / ${sectionAbbreviation(sectionName)}` : name;
}

export function resolveTaskProjectTargets(task: Pick<Task, "projects" | "discipline">): TaskProjectTarget[] {
  if (task.projects && task.projects.length > 0) {
    return task.projects.map((project) => ({
      id: project.id,
      label: projectTargetLabel(project.name, project.sectionName)
    }));
  }

  const projectId = task.discipline?.projectId;
  if (!projectId) {
    return [];
  }

  const label = task.discipline?.projectName ?? task.discipline?.name ?? "Projeto";
  return [{ id: projectId, label }];
}

export function buildOpenProjectPath(projectId: string, taskId: string): string {
  return `/projects/${projectId}?task=${encodeURIComponent(taskId)}`;
}
