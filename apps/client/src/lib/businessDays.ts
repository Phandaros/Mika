import { getDay } from "date-fns";
import { toDateOnly } from "./utils";

const MS_PER_DAY = 86400000;

function ymdToUtcMs(ymd: string): number {
  const parts = ymd.split("-").map(Number);
  const y = parts[0] ?? 0;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return Date.UTC(y, m - 1, d);
}

export function addCalendarDaysYmd(ymd: string, delta: number): string {
  const dt = new Date(ymdToUtcMs(ymd) + delta * MS_PER_DAY);
  const y = dt.getUTCFullYear();
  const mo = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const da = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

function parseYmdToLocalNoon(ymd: string): Date {
  const parts = ymd.split("-").map(Number);
  return new Date(parts[0] ?? 0, (parts[1] ?? 1) - 1, parts[2] ?? 1, 12, 0, 0, 0);
}

export function buildNonWorkingDays(from: string, to: string, holidayDates: string[]): Set<string> {
  const set = new Set<string>(holidayDates);
  let current = from;

  while (current <= to) {
    const weekDay = getDay(parseYmdToLocalNoon(current));
    if (weekDay === 0 || weekDay === 6) {
      set.add(current);
    }
    current = addCalendarDaysYmd(current, 1);
  }

  return set;
}

export function recalculatedDueDate(startDate: string, estimatedDays: number, nonWorkingDays: Set<string>): string {
  const targetWorkDays = Math.max(1, Math.ceil(estimatedDays));
  let current = startDate;
  let counted = 0;

  while (counted < targetWorkDays) {
    if (!nonWorkingDays.has(current)) {
      counted += 1;
    }

    if (counted < targetWorkDays) {
      current = addCalendarDaysYmd(current, 1);
    }
  }

  return current;
}

export function canRecalculateTaskDates(task: {
  startDate: string | null;
  estimatedDays?: number | null;
  estimatedTime?: number | null;
}): boolean {
  const startDate = toDateOnly(task.startDate);
  const estimatedDays = task.estimatedDays ?? task.estimatedTime ?? null;
  return Boolean(startDate && estimatedDays != null && estimatedDays > 0);
}
