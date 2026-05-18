import { Flag } from "lucide-react";
import { Priority, TaskStatus } from "shared";

export const taskStatusLabels: Record<TaskStatus, string> = {
  [TaskStatus.BACKLOG]: "Backlog",
  [TaskStatus.TODO]: "A fazer",
  [TaskStatus.IN_PROGRESS]: "Em andamento",
  [TaskStatus.IN_REVIEW]: "Em revisão",
  [TaskStatus.DONE]: "Concluído"
};

export const taskStatusColors: Record<TaskStatus, string> = {
  [TaskStatus.BACKLOG]: "var(--color-status-backlog)",
  [TaskStatus.TODO]: "var(--color-status-todo)",
  [TaskStatus.IN_PROGRESS]: "var(--color-status-in-progress)",
  [TaskStatus.IN_REVIEW]: "var(--color-status-in-review)",
  [TaskStatus.DONE]: "var(--color-status-done)"
};

export const priorityLabels: Record<Priority, string> = {
  [Priority.LOW]: "Baixa",
  [Priority.MEDIUM]: "Média",
  [Priority.HIGH]: "Alta",
  [Priority.URGENT]: "Urgente"
};

export const priorityColors: Record<Priority, string> = {
  [Priority.LOW]: "var(--color-priority-low)",
  [Priority.MEDIUM]: "var(--color-priority-medium)",
  [Priority.HIGH]: "var(--color-priority-high)",
  [Priority.URGENT]: "var(--color-priority-urgent)"
};

export function StatusOptionPill({ label, color }: { label: string; color: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2 rounded-md border border-border bg-brand-black/70 px-2 py-1 text-xs font-semibold text-text-primary">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="truncate">{label}</span>
    </span>
  );
}

export function PriorityOptionPill({ priority }: { priority: Priority }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2 rounded-md border border-border bg-brand-black/70 px-2 py-1 text-xs font-semibold text-text-primary">
      <Flag size={14} style={{ color: priorityColors[priority] }} />
      <span className="truncate">{priorityLabels[priority]}</span>
    </span>
  );
}

export function enumColor(name: string, fallback?: string | null): string {
  if (fallback) {
    return fallback;
  }

  const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (normalized.includes("fazer") || normalized.includes("todo")) {
    return "var(--color-status-todo)";
  }

  if (normalized.includes("andamento") || normalized.includes("progress")) {
    return "var(--color-status-in-progress)";
  }

  if (normalized.includes("revis") || normalized.includes("review")) {
    return "var(--color-status-in-review)";
  }

  if (normalized.includes("conclu") || normalized.includes("final")) {
    return "var(--color-status-done)";
  }

  if (normalized.includes("backlog")) {
    return "var(--color-status-backlog)";
  }

  return "var(--color-text-muted)";
}
