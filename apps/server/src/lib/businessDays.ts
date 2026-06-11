import { getDay } from "date-fns";

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

export function countBusinessDaysBetween(from: string, to: string, nonWorkingDays: Set<string>): number {
  if (from > to) {
    return 0;
  }

  let count = 0;
  let current = from;

  while (current <= to) {
    if (!nonWorkingDays.has(current)) {
      count += 1;
    }
    current = addCalendarDaysYmd(current, 1);
  }

  return count;
}
