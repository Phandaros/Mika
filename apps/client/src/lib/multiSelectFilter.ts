import { Priority, ProjectStatus, TaskStatus } from "shared";

export function defaultTaskStatusSelection(): string[] {
  return Object.values(TaskStatus).filter((status) => status !== TaskStatus.BACKLOG);
}

export function defaultProjectTaskStatusSelection(): string[] {
  return Object.values(TaskStatus);
}

export function defaultProjectStatusSelection(): string[] {
  return [ProjectStatus.ACTIVE];
}

export function defaultPlatformSelection(): string[] {
  return ["CAD", "BIM", "none"];
}

export function defaultBuilderSelection(builders: string[]): string[] {
  return ["none", ...builders];
}

export function defaultPrioritySelection(): string[] {
  return Object.values(Priority);
}

export function defaultAssigneeSelection(userIds: string[]): string[] {
  return ["none", ...userIds];
}

export function initializeAssigneeSelection(current: readonly string[] | undefined, userIds: readonly string[]): string[] {
  if (current !== undefined) {
    return [...current];
  }

  return defaultAssigneeSelection([...userIds]);
}

export function matchesMultiSelect(value: string, selected: ReadonlySet<string>): boolean {
  return selected.size > 0 && selected.has(value);
}

export function isAllSelected(selected: ReadonlySet<string>, allValues: readonly string[]): boolean {
  return allValues.length > 0 && allValues.every((value) => selected.has(value));
}

export function formatMultiSelectTriggerLabel(
  selectedValues: readonly string[],
  allValues: readonly string[],
  labels: { all: string; none: string; partial: (count: number) => string }
): string {
  const selected = new Set(selectedValues);

  if (selected.size === 0) {
    return labels.none;
  }

  if (isAllSelected(selected, allValues)) {
    return labels.all;
  }

  return labels.partial(selected.size);
}

export function countActiveFilterDimensions(
  dimensions: Array<{ selected: readonly string[]; all: readonly string[] }>
): number {
  return dimensions.filter(({ selected, all }) => {
    if (selected.length === 0) {
      return false;
    }

    return !isAllSelected(new Set(selected), all);
  }).length;
}
