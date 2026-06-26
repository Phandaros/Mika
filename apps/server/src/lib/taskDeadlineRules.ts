export const TASK_DEADLINE_ERROR_MESSAGE = "A data de entrega não pode ser posterior ao prazo máximo.";

type TaskDeadlineInput = {
  dueDate?: string | null;
  maxDeadline?: string | Date | null;
  existingDueDate?: string | Date | null;
  existingMaxDeadline?: string | Date | null;
};

function dateOnly(value: string | Date | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

export function taskDeadlineViolation(input: TaskDeadlineInput): boolean {
  const nextDueDate = input.dueDate === undefined ? dateOnly(input.existingDueDate) : dateOnly(input.dueDate);
  const nextMaxDeadline =
    input.maxDeadline === undefined ? dateOnly(input.existingMaxDeadline) : dateOnly(input.maxDeadline);

  return Boolean(nextDueDate && nextMaxDeadline && nextDueDate > nextMaxDeadline);
}
