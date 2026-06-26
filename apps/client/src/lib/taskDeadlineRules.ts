export const TASK_DEADLINE_ERROR_MESSAGE = "A data de entrega não pode ser posterior ao prazo máximo.";
export const TASK_DEADLINE_CLAMP_MESSAGE = "Entrega travada no prazo máximo da tarefa.";
export const MAX_DEADLINE_BEFORE_DUE_DATE_MESSAGE = "O prazo máximo não pode ser anterior à data de entrega.";

export function isAfterMaxDeadline(dueDate: string | null | undefined, maxDeadline: string | null | undefined): boolean {
  return Boolean(dueDate && maxDeadline && dueDate.slice(0, 10) > maxDeadline.slice(0, 10));
}

export function clampTaskDatesToMaxDeadline(
  startDate: string,
  dueDate: string,
  maxDeadline: string | null | undefined
): { startDate: string; dueDate: string; clamped: boolean } {
  const limit = maxDeadline?.slice(0, 10) ?? null;
  if (!limit || dueDate <= limit) {
    return { startDate, dueDate, clamped: false };
  }

  const durationDays = diffCalendarDays(startDate, dueDate);
  return {
    startDate: addCalendarDays(limit, -durationDays),
    dueDate: limit,
    clamped: true
  };
}

function diffCalendarDays(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86400000);
}

function addCalendarDays(ymd: string, delta: number): string {
  const ms = Date.parse(`${ymd}T00:00:00.000Z`) + delta * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}
