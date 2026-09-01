import { addDays, differenceInCalendarDays, format } from "date-fns";
import type { ProjectTimelineEventDto, Task } from "shared";
import { dateOnlyToLocalDate, toDateOnly } from "./utils";

export type TimelineTask = Pick<
  Task,
  "id" | "title" | "startDate" | "dueDate" | "completedAt" | "completed" | "status"
> & { disciplineId: string };

export type TimelineTaskGeometry = {
  task: TimelineTask;
  kind: "bar" | "future-marker" | "defensive-marker";
  startDate: string;
  endDate: string;
  warning: string | null;
};

export type TimelineRange = {
  from: string;
  to: string;
  dayCount: number;
};

export type TimelineLaneItem<T> = {
  item: T;
  lane: number;
  startIndex: number;
  endIndex: number;
};

export function taskTimelineGeometry(task: TimelineTask, today: string): TimelineTaskGeometry | null {
  const startDate = validTimelineDateOnly(task.startDate);
  if (!startDate) {
    const dueDate = validTimelineDateOnly(task.dueDate);
    return dueDate
      ? { task, kind: "bar", startDate: dueDate, endDate: dueDate, warning: null }
      : null;
  }

  if (task.completed) {
    const completedDate = validTimelineDateOnly(task.completedAt);
    if (!completedDate) {
      return {
        task,
        kind: "defensive-marker",
        startDate,
        endDate: startDate,
        warning: task.completedAt
          ? "Tarefa concluída com data de conclusão inválida"
          : "Tarefa concluída sem data de conclusão"
      };
    }

    if (completedDate < startDate) {
      return {
        task,
        kind: "defensive-marker",
        startDate: completedDate,
        endDate: completedDate,
        warning: "A conclusão cadastrada é anterior ao início"
      };
    }

    return { task, kind: "bar", startDate, endDate: completedDate, warning: null };
  }

  if (startDate > today) {
    return { task, kind: "future-marker", startDate, endDate: startDate, warning: null };
  }

  return { task, kind: "bar", startDate, endDate: today, warning: null };
}

export function projectTimelineRange(
  geometries: readonly TimelineTaskGeometry[],
  events: readonly Pick<ProjectTimelineEventDto, "eventDate">[],
  today: string,
  paddingDays = 7
): TimelineRange {
  const candidates = [
    today,
    ...geometries.flatMap((geometry) => [geometry.startDate, geometry.endDate]),
    ...events.map((event) => event.eventDate)
  ].filter((value): value is string => Boolean(toDateOnly(value)));

  candidates.sort();
  const first = candidates[0] ?? today;
  const last = candidates[candidates.length - 1] ?? today;
  const from = offsetDateOnly(first, -paddingDays);
  const to = offsetDateOnly(last, paddingDays);

  return {
    from,
    to,
    dayCount: differenceInCalendarDays(requiredLocalDate(to), requiredLocalDate(from)) + 1
  };
}

export function timelineDateIndex(date: string, rangeFrom: string): number {
  return differenceInCalendarDays(requiredLocalDate(date), requiredLocalDate(rangeFrom));
}

export function fitTimelineScale(viewportWidth: number, dayCount: number): number {
  if (viewportWidth <= 0 || dayCount <= 0) {
    return 1;
  }

  return Math.min(48, Math.max(0.05, viewportWidth / dayCount));
}

export function validTimelineDateOnly(value: string | null | undefined): string | null {
  const dateOnly = toDateOnly(value);
  const parsed = dateOnlyToLocalDate(dateOnly);
  return dateOnly && parsed && format(parsed, "yyyy-MM-dd") === dateOnly ? dateOnly : null;
}

export function nextTimelineScale(
  currentScale: number,
  direction: "in" | "out",
  fitScale: number,
  maxScale = 48
): number {
  const factor = direction === "in" ? 1.25 : 0.8;
  return clamp(currentScale * factor, fitScale, maxScale);
}

export function anchoredTimelineScrollLeft(
  currentScrollLeft: number,
  anchorX: number,
  oldScale: number,
  newScale: number
): number {
  if (oldScale <= 0 || newScale <= 0) {
    return currentScrollLeft;
  }

  const anchorDay = (currentScrollLeft + anchorX) / oldScale;
  return Math.max(0, anchorDay * newScale - anchorX);
}

export function centeredTimelineScrollLeft(dayIndex: number, viewportWidth: number, pixelsPerDay: number): number {
  return Math.max(0, (dayIndex + 0.5) * pixelsPerDay - viewportWidth / 2);
}

export function packTimelineLanes<T>(
  items: readonly T[],
  bounds: (item: T) => { startIndex: number; endIndex: number }
): TimelineLaneItem<T>[] {
  const sorted = items
    .map((item) => ({ item, ...bounds(item) }))
    .sort((left, right) =>
      left.startIndex - right.startIndex ||
      left.endIndex - right.endIndex
    );
  const laneEnds: number[] = [];

  return sorted.map((entry) => {
    let lane = laneEnds.findIndex((laneEnd) => entry.startIndex > laneEnd);
    if (lane < 0) {
      lane = laneEnds.length;
    }
    laneEnds[lane] = entry.endIndex;
    return { ...entry, lane };
  });
}

export function timelineHeaderDensity(pixelsPerDay: number): "day" | "week" | "month" {
  if (pixelsPerDay >= 32) {
    return "day";
  }
  if (pixelsPerDay >= 6) {
    return "week";
  }
  return "month";
}

function offsetDateOnly(value: string, amount: number): string {
  return format(addDays(requiredLocalDate(value), amount), "yyyy-MM-dd");
}

function requiredLocalDate(value: string): Date {
  const date = dateOnlyToLocalDate(value);
  if (!date) {
    throw new Error(`Data inválida na linha do tempo: ${value}`);
  }
  return date;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
