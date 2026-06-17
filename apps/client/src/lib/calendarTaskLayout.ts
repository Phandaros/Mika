import { isAfter, isBefore } from "date-fns";
import type { Task } from "shared";
import { dateOnlyToLocalDate } from "./utils";

export const CALENDAR_BAR_H = 34;
export const CALENDAR_BAR_GAP = 2;
export const CALENDAR_DAY_HEADER_H = 36;
export const CALENDAR_WEEK_PAD = 8;

export type DateRange = { start: Date; end: Date };

export type RangedTask<T extends Task = Task> = {
  task: T;
  start: Date;
  end: Date;
};

export type WeekBarLayout<T extends Task = Task> = {
  rangedTask: RangedTask<T>;
  startCol: number;
  endCol: number;
  lane: number;
  startsBeforeWeek: boolean;
  endsAfterWeek: boolean;
};

export function taskDateRange(task: Task): DateRange | null {
  const startDate = dateOnlyToLocalDate(task.startDate);
  const dueDate = dateOnlyToLocalDate(task.dueDate);
  const start = startDate ?? dueDate;
  const end = dueDate ?? startDate;

  if (!start || !end) {
    return null;
  }

  return isAfter(start, end) ? { start: end, end: start } : { start, end };
}

export function rangesOverlap(start: Date, end: Date, rangeStart: Date, rangeEnd: Date): boolean {
  return !isBefore(end, rangeStart) && !isAfter(start, rangeEnd);
}

/** Monday-based column index 0–6 within a week row. */
export function weekColumnIndex(day: Date): number {
  const dayOfWeek = day.getDay();
  return dayOfWeek === 0 ? 6 : dayOfWeek - 1;
}

export function assignLanes(items: Array<{ startIdx: number; endIdx: number }>): number[] {
  const sorted = items
    .map((item, index) => ({ ...item, index }))
    .sort((a, b) => a.startIdx - b.startIdx || b.endIdx - a.endIdx);
  const laneEnds: number[] = [];
  const lanes = new Array(items.length).fill(0);

  for (const item of sorted) {
    let lane = 0;
    while (lane < laneEnds.length && (laneEnds[lane] ?? -1) >= item.startIdx) {
      lane += 1;
    }

    if (lane === laneEnds.length) {
      laneEnds.push(item.endIdx);
    } else {
      laneEnds[lane] = item.endIdx;
    }

    lanes[item.index] = lane;
  }

  return lanes;
}

export function layoutWeekBars<T extends Task>(
  rangedTasks: RangedTask<T>[],
  weekStart: Date,
  weekEnd: Date
): { bars: WeekBarLayout<T>[]; rowHeight: number } {
  const weekItems = rangedTasks
    .filter((item) => rangesOverlap(item.start, item.end, weekStart, weekEnd))
    .sort((a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime());

  if (weekItems.length === 0) {
    return {
      bars: [],
      rowHeight: CALENDAR_DAY_HEADER_H + CALENDAR_WEEK_PAD
    };
  }

  const colRanges = weekItems.map((item) => {
    const clippedStart = item.start < weekStart ? weekStart : item.start;
    const clippedEnd = item.end > weekEnd ? weekEnd : item.end;
    return {
      startIdx: weekColumnIndex(clippedStart),
      endIdx: weekColumnIndex(clippedEnd)
    };
  });

  const lanes = assignLanes(colRanges);
  const maxLane = Math.max(...lanes);

  const bars: WeekBarLayout<T>[] = weekItems.map((item, index) => {
    const colRange = colRanges[index]!;

    return {
      rangedTask: item,
      startCol: colRange.startIdx,
      endCol: colRange.endIdx,
      lane: lanes[index] ?? 0,
      startsBeforeWeek: isBefore(item.start, weekStart),
      endsAfterWeek: isAfter(item.end, weekEnd)
    };
  });

  const lanesHeight = (maxLane + 1) * (CALENDAR_BAR_H + CALENDAR_BAR_GAP);
  const rowHeight = CALENDAR_DAY_HEADER_H + lanesHeight + CALENDAR_WEEK_PAD;

  return { bars, rowHeight };
}

export function chunkDays(days: Date[]): Date[][] {
  const weeks: Date[][] = [];
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }
  return weeks;
}
