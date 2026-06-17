import type { CSSProperties } from "react";
import { TaskStatus } from "shared";

function tokenTimelineStyle(bg: string, text: string): CSSProperties {
  return {
    backgroundColor: `var(${bg})`,
    color: `var(${text})`,
    borderColor: `var(${bg})`
  };
}

export function statusTimelineStyle(status: string): CSSProperties {
  switch (status) {
    case TaskStatus.BACKLOG:
      return tokenTimelineStyle("--status-backlog-bg", "--status-backlog-text");
    case TaskStatus.TODO:
      return tokenTimelineStyle("--status-todo-bg", "--status-todo-text");
    case TaskStatus.ON_SCHEDULE:
      return tokenTimelineStyle("--status-scheduled-bg", "--status-scheduled-text");
    case TaskStatus.OVERDUE:
      return tokenTimelineStyle("--status-late-bg", "--status-late-text");
    case TaskStatus.IN_PROGRESS:
      return tokenTimelineStyle("--status-inprogress-bg", "--status-inprogress-text");
    case TaskStatus.AWAITING_REVIEW:
      return tokenTimelineStyle("--status-review-bg", "--status-review-text");
    case TaskStatus.IN_ANALYSIS:
      return tokenTimelineStyle("--status-analysis-bg", "--status-analysis-text");
    case TaskStatus.AWAITING_DEFINITION:
      return tokenTimelineStyle("--status-waiting-bg", "--status-waiting-text");
    case TaskStatus.FINISHED:
      return tokenTimelineStyle("--status-done-bg", "--status-done-text");
    default:
      return tokenTimelineStyle("--status-todo-bg", "--status-todo-text");
  }
}
