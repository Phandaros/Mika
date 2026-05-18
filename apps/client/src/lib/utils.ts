import { format } from "date-fns";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function toDateOnly(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

export function dateOnlyToLocalDate(value: string | null | undefined): Date | null {
  const dateOnly = toDateOnly(value);
  if (!dateOnly) {
    return null;
  }

  const [year = 0, month = 1, day = 1] = dateOnly.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function localDateToDateOnly(date: Date | null): string | null {
  return date ? format(date, "yyyy-MM-dd") : null;
}

export function formatDateOnly(value: string | null | undefined, pattern: string): string {
  const date = dateOnlyToLocalDate(value);
  return date ? format(date, pattern) : "";
}
