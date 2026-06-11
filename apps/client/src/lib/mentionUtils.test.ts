import { describe, expect, it } from "vitest";
import type { Project, User } from "shared";
import { DisciplineStatus, DisciplineType, ProjectStatus, Role } from "shared";
import {
  buildMentionMarkdown,
  buildMentionSuggestions,
  parseMentionHref,
  type MentionContext
} from "./mentionUtils";

const context: MentionContext = {
  projectId: "project-a",
  taskId: "task-current"
};

const users: User[] = [
  {
    id: "user-1",
    name: "João Silva",
    email: "joao@mk.com",
    role: Role.DESIGNER,
    avatarUrl: null,
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  }
];

const projects: Project[] = [
  {
    id: "project-a",
    name: "Edifício Central",
    description: null,
    client: null,
    platform: null,
    builder: null,
    areaM2: null,
    status: ProjectStatus.ACTIVE,
    startDate: null,
    endDate: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    sections: [
      {
        id: "section-1",
        projectId: "project-a",
        name: "Elétrica",
        type: DisciplineType.OTHER,
        status: DisciplineStatus.IN_PROGRESS,
        responsibleId: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        responsible: null,
        tasks: [
          { id: "task-dup", title: "Memorial descritivo" },
          { id: "task-other", title: "Diagrama unifilar" }
        ]
      },
      {
        id: "section-2",
        projectId: "project-a",
        name: "HVAC",
        type: DisciplineType.OTHER,
        status: DisciplineStatus.IN_PROGRESS,
        responsibleId: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        responsible: null,
        tasks: [{ id: "task-dup", title: "Memorial descritivo" }]
      }
    ]
  },
  {
    id: "project-b",
    name: "Residencial Sul",
    description: null,
    client: null,
    platform: null,
    builder: null,
    areaM2: null,
    status: ProjectStatus.ACTIVE,
    startDate: null,
    endDate: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    sections: [
      {
        id: "section-b1",
        projectId: "project-b",
        name: "Geral",
        type: DisciplineType.OTHER,
        status: DisciplineStatus.IN_PROGRESS,
        responsibleId: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        responsible: null,
        tasks: [{ id: "task-remote", title: "Planta baixa" }]
      }
    ]
  }
];

describe("buildMentionMarkdown", () => {
  it("builds mention link syntax", () => {
    expect(
      buildMentionMarkdown({
        id: "user-1",
        label: "João",
        type: "user"
      })
    ).toBe("@[João](mk://user/user-1)");
  });

  it("strips brackets from labels", () => {
    expect(
      buildMentionMarkdown({
        id: "task-1",
        label: "Tarefa [urgente]",
        type: "task"
      })
    ).toBe("@[Tarefa urgente](mk://task/task-1)");
  });
});

describe("parseMentionHref", () => {
  it("parses mk mention urls", () => {
    expect(parseMentionHref("mk://user/user-1")).toEqual({ type: "user", id: "user-1" });
    expect(parseMentionHref("mk://task/task-1")).toEqual({ type: "task", id: "task-1" });
    expect(parseMentionHref("mk://project/project-1")).toEqual({ type: "project", id: "project-1" });
  });

  it("returns null for non-mention urls", () => {
    expect(parseMentionHref("https://example.com")).toBeNull();
    expect(parseMentionHref("mk://invalid/id")).toBeNull();
  });
});

describe("buildMentionSuggestions", () => {
  it("deduplicates tasks that appear in multiple sections", () => {
    const suggestions = buildMentionSuggestions("memorial", context, users, projects);
    const duplicateTasks = suggestions.filter((item) => item.type === "task" && item.id === "task-dup");

    expect(duplicateTasks).toHaveLength(1);
  });

  it("keeps the highest affinity item after deduplication", () => {
    const suggestions = buildMentionSuggestions("memorial", context, users, projects);
    const task = suggestions.find((item) => item.id === "task-dup");

    expect(task?.affinity).toBe(3);
    expect(task?.subtitle).toContain("Edifício Central");
  });

  it("sorts current-project tasks ahead of remote tasks", () => {
    const suggestions = buildMentionSuggestions("", context, users, projects);
    const taskIds = suggestions.filter((item) => item.type === "task").map((item) => item.id);

    expect(taskIds.indexOf("task-dup")).toBeLessThan(taskIds.indexOf("task-remote"));
  });
});
