import { differenceInCalendarDays } from "date-fns";
import { dateOnlyToLocalDate, formatDateOnly } from "./utils";

export type RelativeDueDateTone = "empty" | "overdue" | "today" | "future";

export interface RelativeDueDateDisplay {
  label: string;
  title: string;
  tone: RelativeDueDateTone;
}

export function relativeDueDateDisplay(
  dueDate: string | null | undefined,
  referenceDate = new Date()
): RelativeDueDateDisplay {
  const parsed = dateOnlyToLocalDate(dueDate);
  if (!parsed) {
    return {
      label: "Sem prazo",
      title: "Sem prazo",
      tone: "empty"
    };
  }

  const daysUntilDue = differenceInCalendarDays(parsed, referenceDate);
  const relativeLabel = relativeDueDateLabel(daysUntilDue);

  return {
    label: `${relativeLabel} · ${formatDateOnly(dueDate, "dd/MM")}`,
    title: `${relativeLabel} · ${formatDateOnly(dueDate, "dd/MM/yyyy")}`,
    tone: daysUntilDue < 0 ? "overdue" : daysUntilDue === 0 ? "today" : "future"
  };
}

function relativeDueDateLabel(daysUntilDue: number): string {
  if (daysUntilDue === 0) {
    return "Hoje";
  }

  if (daysUntilDue === 1) {
    return "Amanhã";
  }

  if (daysUntilDue > 1) {
    return `Em ${daysUntilDue} dias`;
  }

  const overdueDays = Math.abs(daysUntilDue);
  return `Atrasada há ${overdueDays} ${overdueDays === 1 ? "dia" : "dias"}`;
}
