import type { CSSProperties } from "react";
import { Priority, TaskStatus } from "shared";
import { resolveAsanaColor } from "../../lib/utils";
import {
  Chip,
  parseTokenColor,
  priorityLabels,
  priorityTokens,
  taskStatusLabels,
  taskStatusTokens,
  tokenColorValue,
  tokenStyle
} from "./Chip";
import { PriorityBadge } from "./PriorityBadge";

export { priorityLabels, taskStatusLabels };

export const taskStatusColors: Record<TaskStatus, string> = {
  [TaskStatus.BACKLOG]: tokenColorValue(taskStatusTokens[TaskStatus.BACKLOG].bg, taskStatusTokens[TaskStatus.BACKLOG].text),
  [TaskStatus.TODO]: tokenColorValue(taskStatusTokens[TaskStatus.TODO].bg, taskStatusTokens[TaskStatus.TODO].text),
  [TaskStatus.IN_PROGRESS]: tokenColorValue(taskStatusTokens[TaskStatus.IN_PROGRESS].bg, taskStatusTokens[TaskStatus.IN_PROGRESS].text),
  [TaskStatus.IN_REVIEW]: tokenColorValue(taskStatusTokens[TaskStatus.IN_REVIEW].bg, taskStatusTokens[TaskStatus.IN_REVIEW].text),
  [TaskStatus.DONE]: tokenColorValue(taskStatusTokens[TaskStatus.DONE].bg, taskStatusTokens[TaskStatus.DONE].text)
};

export const priorityColors: Record<Priority, string> = {
  [Priority.LOW]: tokenColorValue(priorityTokens[Priority.LOW].bg, priorityTokens[Priority.LOW].text),
  [Priority.MEDIUM]: tokenColorValue(priorityTokens[Priority.MEDIUM].bg, priorityTokens[Priority.MEDIUM].text),
  [Priority.HIGH]: tokenColorValue(priorityTokens[Priority.HIGH].bg, priorityTokens[Priority.HIGH].text),
  [Priority.URGENT]: tokenColorValue(priorityTokens[Priority.URGENT].bg, priorityTokens[Priority.URGENT].text)
};

export function StatusOptionPill({ label, color }: { label: string; color: string }) {
  const style = coloredFieldStyle(color);

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium tracking-wide whitespace-nowrap"
      style={style}
    >
      {label}
    </span>
  );
}

export function PriorityOptionPill({ priority }: { priority: Priority }) {
  return <PriorityBadge priority={priority} />;
}

export function enumColor(name: string, fallback?: string | null): string {
  if (fallback) {
    return fallback;
  }

  const normalized = normalize(name);
  if (normalized.includes("fazer") || normalized.includes("todo")) {
    return taskStatusColors[TaskStatus.TODO];
  }

  if (normalized.includes("andamento") || normalized.includes("progress")) {
    return taskStatusColors[TaskStatus.IN_PROGRESS];
  }

  if (normalized.includes("revis") || normalized.includes("review")) {
    return taskStatusColors[TaskStatus.IN_REVIEW];
  }

  if (normalized.includes("conclu") || normalized.includes("final")) {
    return taskStatusColors[TaskStatus.DONE];
  }

  if (normalized.includes("backlog")) {
    return taskStatusColors[TaskStatus.BACKLOG];
  }

  return tokenColorValue("--disc-none-bg", "--disc-none-text");
}

export function coloredFieldStyle(color: string): CSSProperties {
  const tokenColor = parseTokenColor(color);
  const tokens = tokenColor ?? resolveAsanaColor(color);

  return {
    ...tokenStyle(tokens.bg, tokens.text),
    borderColor: `var(${tokens.bg})`
  };
}

export function TokenOptionChip({ label, color }: { label: string; color: string }) {
  const tokenColor = parseTokenColor(color);
  const tokens = tokenColor ?? resolveAsanaColor(color);

  return (
    <Chip bg={tokens.bg} text={tokens.text}>
      {label}
    </Chip>
  );
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
