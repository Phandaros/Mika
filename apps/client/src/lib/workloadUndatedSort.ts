import { isValid, parseISO } from "date-fns";
import { TaskStatus, type Task } from "shared";

type WorkloadUndatedSortableTask = Pick<Task, "id" | "title" | "status" | "updatedAt" | "lastActivityAt">;

function timestamp(value: string | null | undefined): number {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const parsed = parseISO(value);
  return isValid(parsed) ? parsed.getTime() : Number.NEGATIVE_INFINITY;
}

function taskRecency(task: WorkloadUndatedSortableTask): number {
  return Math.max(timestamp(task.lastActivityAt), timestamp(task.updatedAt));
}

export function compareWorkloadUndatedTasks(
  left: WorkloadUndatedSortableTask,
  right: WorkloadUndatedSortableTask
): number {
  const awaitingDefinitionOrder =
    Number(left.status === TaskStatus.AWAITING_DEFINITION) -
    Number(right.status === TaskStatus.AWAITING_DEFINITION);

  if (awaitingDefinitionOrder !== 0) {
    return awaitingDefinitionOrder;
  }

  const leftRecency = taskRecency(left);
  const rightRecency = taskRecency(right);
  if (leftRecency !== rightRecency) {
    return rightRecency - leftRecency;
  }

  const titleOrder = left.title.localeCompare(right.title, "pt-BR");
  return titleOrder !== 0 ? titleOrder : left.id.localeCompare(right.id, "pt-BR");
}

export function sortWorkloadUndatedTasks<T extends WorkloadUndatedSortableTask>(tasks: readonly T[]): T[] {
  return [...tasks].sort(compareWorkloadUndatedTasks);
}
