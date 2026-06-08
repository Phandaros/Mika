import { TaskStatus, type TaskStatus as TaskStatusValue } from "./enums.js";

const legacyEnumStatusMap: Record<string, TaskStatusValue> = {
  BACKLOG: TaskStatus.ON_SCHEDULE,
  TODO: TaskStatus.TODO,
  IN_PROGRESS: TaskStatus.IN_PROGRESS,
  IN_REVIEW: TaskStatus.AWAITING_REVIEW,
  DONE: TaskStatus.FINISHED
};

const legacyAsanaStatusMap: Record<string, TaskStatusValue> = {
  "a fazer": TaskStatus.TODO,
  "no cronograma": TaskStatus.ON_SCHEDULE,
  "em andamento": TaskStatus.IN_PROGRESS,
  "aguardando revisao": TaskStatus.AWAITING_REVIEW,
  "em analise": TaskStatus.IN_ANALYSIS,
  "aguardando definicao": TaskStatus.AWAITING_DEFINITION,
  "aguardando aprovacao": TaskStatus.AWAITING_DEFINITION,
  finalizado: TaskStatus.FINISHED,
  finalizada: TaskStatus.FINISHED,
  atrasado: TaskStatus.OVERDUE
};

export function taskStatusCompletes(status: TaskStatusValue): boolean {
  return status === TaskStatus.FINISHED;
}

export function completionDateForStatus(status: TaskStatusValue, currentCompletedAt?: Date | null): Date | null {
  return taskStatusCompletes(status) ? currentCompletedAt ?? new Date() : null;
}

export function normalizeLegacyAsanaTaskStatus(value: string | null | undefined): TaskStatusValue | null {
  if (!value) {
    return null;
  }

  return legacyAsanaStatusMap[normalizeStatusName(value)] ?? null;
}

export function normalizePersistedTaskStatus(value: string | null | undefined): TaskStatusValue | null {
  if (!value) {
    return null;
  }

  if (Object.values(TaskStatus).includes(value as TaskStatusValue) && value !== TaskStatus.OVERDUE) {
    return value as TaskStatusValue;
  }

  const legacyEnumStatus = legacyEnumStatusMap[value];
  if (legacyEnumStatus) {
    return legacyEnumStatus;
  }

  const legacyAsanaStatus = normalizeLegacyAsanaTaskStatus(value);
  return legacyAsanaStatus === TaskStatus.OVERDUE ? null : legacyAsanaStatus;
}

export function writableTaskStatus(value: TaskStatusValue | string | null | undefined): TaskStatusValue {
  return normalizePersistedTaskStatus(value) ?? TaskStatus.TODO;
}

export function normalizeTaskStatus(task: {
  completed: boolean;
  mikaStatus: string | null;
  assigneeStatus: string | null;
}): TaskStatusValue {
  const normalized = normalizePersistedTaskStatus(task.mikaStatus);
  if (normalized) {
    return normalized;
  }

  if (task.completed) {
    return TaskStatus.FINISHED;
  }

  if (task.assigneeStatus === "upcoming") {
    return TaskStatus.TODO;
  }

  if (task.assigneeStatus === "later") {
    return TaskStatus.ON_SCHEDULE;
  }

  return TaskStatus.TODO;
}

export function publicTaskStatus(task: {
  completed: boolean;
  mikaStatus: string | null;
  assigneeStatus: string | null;
  dueOn: string | null;
  dueAt: Date | null;
}): TaskStatusValue {
  const normalized = normalizeTaskStatus(task);
  const dueDate = dateOnlyString(task.dueOn) ?? dateOnlyFromDate(task.dueAt);

  if (!task.completed && normalized !== TaskStatus.AWAITING_DEFINITION && dueDate && dueDate < todayDateOnly()) {
    return TaskStatus.OVERDUE;
  }

  return normalized;
}

function normalizeStatusName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateOnlyString(value: string | null | undefined): string | null {
  return value ? value.slice(0, 10) : null;
}

function dateOnlyFromDate(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}
