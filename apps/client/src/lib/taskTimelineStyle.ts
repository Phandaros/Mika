import type { CSSProperties } from "react";
import { TaskStatus } from "shared";

const taskStatusTokens: Record<TaskStatus, { bg: string; text: string }> = {
  [TaskStatus.BACKLOG]: { bg: "--status-backlog-bg", text: "--status-backlog-text" },
  [TaskStatus.TODO]: { bg: "--status-todo-bg", text: "--status-todo-text" },
  [TaskStatus.ON_SCHEDULE]: { bg: "--status-scheduled-bg", text: "--status-scheduled-text" },
  [TaskStatus.OVERDUE]: { bg: "--status-late-bg", text: "--status-late-text" },
  [TaskStatus.IN_PROGRESS]: { bg: "--status-inprogress-bg", text: "--status-inprogress-text" },
  [TaskStatus.AWAITING_REVIEW]: { bg: "--status-review-bg", text: "--status-review-text" },
  [TaskStatus.IN_ANALYSIS]: { bg: "--status-analysis-bg", text: "--status-analysis-text" },
  [TaskStatus.AWAITING_DEFINITION]: { bg: "--status-waiting-bg", text: "--status-waiting-text" },
  [TaskStatus.FINISHED]: { bg: "--status-done-bg", text: "--status-done-text" }
};

const projectTimelineTokens = [
  { bg: "--disc-ele-bg", text: "--disc-ele-text" },
  { bg: "--disc-spda-bg", text: "--disc-spda-text" },
  { bg: "--disc-tel-bg", text: "--disc-tel-text" },
  { bg: "--disc-hid-bg", text: "--disc-hid-text" },
  { bg: "--disc-ppci-bg", text: "--disc-ppci-text" },
  { bg: "--disc-cli-bg", text: "--disc-cli-text" },
  { bg: "--disc-coord-bg", text: "--disc-coord-text" },
  { bg: "--disc-ep-bg", text: "--disc-ep-text" },
  { bg: "--disc-san-bg", text: "--disc-san-text" },
  { bg: "--disc-arch-bg", text: "--disc-arch-text" },
  { bg: "--disc-auto-bg", text: "--disc-auto-text" },
  { bg: "--disc-gas-bg", text: "--disc-gas-text" },
  { bg: "--disc-sprinkler-bg", text: "--disc-sprinkler-text" },
  { bg: "--disc-drain-bg", text: "--disc-drain-text" },
  { bg: "--disc-exhaust-bg", text: "--disc-exhaust-text" },
  { bg: "--disc-vacuum-bg", text: "--disc-vacuum-text" },
  { bg: "--disc-stair-bg", text: "--disc-stair-text" }
] as const;

const neutralProjectTimelineTokens = { bg: "--disc-none-bg", text: "--disc-none-text" } as const;

function tokenTimelineStyle(bg: string, text: string): CSSProperties {
  return {
    backgroundColor: `var(${bg})`,
    color: `var(${text})`,
    borderColor: `var(${bg})`
  };
}

export function statusTimelineStyle(status: string): CSSProperties {
  const tokens = taskStatusTokens[status as TaskStatus] ?? taskStatusTokens[TaskStatus.TODO];
  return tokenTimelineStyle(tokens.bg, tokens.text);
}

export function statusAccentStyle(status: string): CSSProperties {
  const tokens = taskStatusTokens[status as TaskStatus] ?? taskStatusTokens[TaskStatus.TODO];

  return {
    "--project-task-status-accent": `var(${tokens.text})`
  } as CSSProperties;
}

export function projectTimelineStyle(projectKey: string | null | undefined): CSSProperties {
  const tokens = projectTimelineTokenPair(projectKey);
  return tokenTimelineStyle(tokens.bg, tokens.text);
}

export function projectTimelineAccentColor(projectKey: string | null | undefined): string {
  return `var(${projectTimelineTokenPair(projectKey).text})`;
}

function projectTimelineTokenPair(projectKey: string | null | undefined): { bg: string; text: string } {
  if (!projectKey) {
    return neutralProjectTimelineTokens;
  }

  const index = stableStringHash(projectKey) % projectTimelineTokens.length;
  return projectTimelineTokens[index] ?? neutralProjectTimelineTokens;
}

function stableStringHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
