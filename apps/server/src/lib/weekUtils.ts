import { endOfWeek, getDay, getHours, startOfWeek, subWeeks } from "date-fns";

const weekOptions = { weekStartsOn: 1 as const };

export function getWeekStart(date: Date = new Date()): Date {
  return startOfWeek(date, weekOptions);
}

export function getWeekEnd(date: Date = new Date()): Date {
  return endOfWeek(date, weekOptions);
}

export function getCurrentWeekStart(): Date {
  return getWeekStart(new Date());
}

export function getCurrentWeekEnd(): Date {
  return getWeekEnd(new Date());
}

export function getPreviousWeekStart(date: Date = new Date()): Date {
  return getWeekStart(subWeeks(date, 1));
}

export function isFriday(date: Date = new Date()): boolean {
  return getDay(date) === 5;
}

export function isWeeklyReportGenerationWindow(date: Date = new Date()): boolean {
  return isFriday(date) && getHours(date) >= 8 && getHours(date) < 9;
}
