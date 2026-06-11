import { Priority, TaskStatus, type TeamBoardColumnDto, type TeamBoardTaskDto } from "shared";
import { buildNonWorkingDays, countBusinessDaysBetween } from "./businessDays";
import { toDateOnly } from "./utils";

const primaryStatusSortWeight: Record<TaskStatus, number> = {
  [TaskStatus.IN_PROGRESS]: 0,
  [TaskStatus.OVERDUE]: 1,
  [TaskStatus.AWAITING_REVIEW]: 2,
  [TaskStatus.TODO]: 3,
  [TaskStatus.ON_SCHEDULE]: 4,
  [TaskStatus.IN_ANALYSIS]: 5,
  [TaskStatus.AWAITING_DEFINITION]: 6,
  [TaskStatus.FINISHED]: 7
};

const prioritySortWeight: Record<Priority, number> = {
  [Priority.URGENT]: 0,
  [Priority.HIGH]: 1,
  [Priority.MEDIUM]: 2,
  [Priority.LOW]: 3
};

export function splitTeamBoardTasks(tasks: TeamBoardTaskDto[]) {
  const inProgress = tasks.filter((task) => task.status === TaskStatus.IN_PROGRESS);
  const primary =
    inProgress.length > 0 ? inProgress : tasks.filter((task) => task.status === TaskStatus.OVERDUE);
  const primaryIds = new Set(primary.map((task) => task.id));
  const secondary = tasks.filter((task) => !primaryIds.has(task.id));

  return {
    primary: sortPrimaryTasks(primary),
    secondary: sortSecondaryTasks(secondary)
  };
}

export function countInProgressTasks(columns: TeamBoardColumnDto[]): number {
  return columns.reduce(
    (sum, column) => sum + column.tasks.filter((task) => task.status === TaskStatus.IN_PROGRESS).length,
    0
  );
}

export function sortDesignerColumns(columns: TeamBoardColumnDto[]): TeamBoardColumnDto[] {
  return [...columns].sort((left, right) => {
    const leftHasPrimary = splitTeamBoardTasks(left.tasks).primary.length > 0;
    const rightHasPrimary = splitTeamBoardTasks(right.tasks).primary.length > 0;

    if (leftHasPrimary !== rightHasPrimary) {
      return leftHasPrimary ? -1 : 1;
    }

    return left.user.name.localeCompare(right.user.name, "pt-BR");
  });
}

function sortPrimaryTasks(tasks: TeamBoardTaskDto[]): TeamBoardTaskDto[] {
  return [...tasks].sort(comparePrimaryTasks);
}

function sortSecondaryTasks(tasks: TeamBoardTaskDto[]): TeamBoardTaskDto[] {
  return [...tasks].sort(comparePrimaryTasks);
}

function comparePrimaryTasks(left: TeamBoardTaskDto, right: TeamBoardTaskDto): number {
  const statusDiff = (primaryStatusSortWeight[left.status] ?? 99) - (primaryStatusSortWeight[right.status] ?? 99);
  if (statusDiff !== 0) {
    return statusDiff;
  }

  if (!left.dueDate && right.dueDate) {
    return 1;
  }

  if (left.dueDate && !right.dueDate) {
    return -1;
  }

  const dueDiff = (left.dueDate ?? "9999-12-31").localeCompare(right.dueDate ?? "9999-12-31");
  if (dueDiff !== 0) {
    return dueDiff;
  }

  return (prioritySortWeight[left.priority] ?? 99) - (prioritySortWeight[right.priority] ?? 99);
}

const STALE_BUSINESS_DAYS = 5;

export function isTaskStale(updatedAt: string, today: string, nonWorkingDays: Set<string>): boolean {
  const updatedDate = toDateOnly(updatedAt);
  if (!updatedDate || updatedDate > today) {
    return false;
  }

  return countBusinessDaysBetween(updatedDate, today, nonWorkingDays) > STALE_BUSINESS_DAYS;
}

export function buildTeamBoardNonWorkingDays(from: string, to: string, holidayDates: string[]): Set<string> {
  return buildNonWorkingDays(from, to, holidayDates);
}

export function formatEffortLabel(elapsed: number | null, estimated: number | null | undefined): string {
  const estimatedDays = estimated ?? null;
  if (elapsed == null && estimatedDays == null) {
    return "Sem estimativa";
  }

  if (elapsed == null) {
    return `— / ${formatDays(estimatedDays)} est.`;
  }

  if (estimatedDays == null) {
    return `${formatDays(elapsed)} / — est.`;
  }

  return `${formatDays(elapsed)} / ${formatDays(estimatedDays)} est.`;
}

function formatDays(value: number | null): string {
  if (value == null) {
    return "—";
  }

  return Number.isInteger(value) ? `${value}d` : `${value.toFixed(1)}d`;
}
