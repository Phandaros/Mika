import { describe, expect, it } from "vitest";
import { TaskStatus } from "shared";
import {
  projectTimelineAccentColor,
  projectTimelineStyle,
  statusAccentStyle,
  statusTimelineStyle
} from "./taskTimelineStyle";

const expectedTokens: Record<TaskStatus, { bg: string; text: string }> = {
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

describe("task timeline styles", () => {
  it.each(Object.values(TaskStatus))("keeps the accessible accent mapped for %s", (status) => {
    expect(statusAccentStyle(status)).toEqual({
      "--project-task-status-accent": `var(${expectedTokens[status].text})`
    });
  });

  it.each(Object.values(TaskStatus))("preserves the default timeline presentation for %s", (status) => {
    expect(statusTimelineStyle(status)).toEqual({
      backgroundColor: `var(${expectedTokens[status].bg})`,
      color: `var(${expectedTokens[status].text})`,
      borderColor: `var(${expectedTokens[status].bg})`
    });
  });

  it("keeps the existing timeline fallback for unknown statuses", () => {
    expect(statusTimelineStyle("UNKNOWN")).toEqual({
      backgroundColor: "var(--status-todo-bg)",
      color: "var(--status-todo-text)",
      borderColor: "var(--status-todo-bg)"
    });
  });

  it("keeps project colors stable and distinct for different project keys", () => {
    const first = projectTimelineStyle("project-alpha");

    expect(projectTimelineStyle("project-alpha")).toEqual(first);
    expect(projectTimelineStyle("project-beta")).not.toEqual(first);
    expect(projectTimelineAccentColor("project-alpha")).toBe(first.color);
  });

  it("uses the neutral project palette when no project is available", () => {
    expect(projectTimelineStyle(null)).toEqual({
      backgroundColor: "var(--disc-none-bg)",
      color: "var(--disc-none-text)",
      borderColor: "var(--disc-none-bg)"
    });
    expect(projectTimelineAccentColor(undefined)).toBe("var(--disc-none-text)");
  });
});
