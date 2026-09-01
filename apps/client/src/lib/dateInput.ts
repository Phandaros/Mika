import { format, isValid, parse } from "date-fns";

const DATE_INPUT_FORMAT = "dd/MM/yyyy";

export function maskDateInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  return [day, month, year].filter(Boolean).join("/");
}

export function parseDateInput(value: string): Date | null {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    return null;
  }

  const parsed = parse(value, DATE_INPUT_FORMAT, new Date());
  return isValid(parsed) && format(parsed, DATE_INPUT_FORMAT) === value ? parsed : null;
}

export function formatDateInput(value: Date | null): string {
  return value ? format(value, DATE_INPUT_FORMAT) : "";
}
