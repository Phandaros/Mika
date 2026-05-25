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

type TokenPair = {
  bg: string;
  text: string;
};

function tokenPair(prefix: string): TokenPair {
  return {
    bg: `var(--${prefix}-bg)`,
    text: `var(--${prefix}-text)`
  };
}

export function resolveAsanaColor(color: string): TokenPair {
  const normalized = color
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  const asanaColorMap: Record<string, TokenPair> = {
    blue: tokenPair("disc-ele"),
    "blue-green": tokenPair("disc-tel"),
    "cool-gray": tokenPair("disc-none"),
    green: tokenPair("disc-hvac"),
    indigo: tokenPair("disc-spda"),
    magenta: tokenPair("disc-spda"),
    orange: tokenPair("disc-coord"),
    purple: tokenPair("disc-spda"),
    red: tokenPair("disc-ppci"),
    yellow: tokenPair("disc-ep"),
    "yellow-green": tokenPair("disc-hvac"),
    "yellow-orange": tokenPair("disc-coord"),
    "hot-pink": tokenPair("disc-spda")
  };

  return asanaColorMap[normalized] ?? tokenPair("disc-none");
}
