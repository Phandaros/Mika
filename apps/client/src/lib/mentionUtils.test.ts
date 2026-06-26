import { describe, expect, it } from "vitest";
import type { Project, Task, User } from "shared";
import { DisciplineStatus, DisciplineType, ProjectStatus, Role } from "shared";
import {
  buildMentionMarkdown,
  buildMentionSuggestions,
  editorMentionsToMarkdown,
  markdownMentionsToEditorContent,
  normalizeMentionContentForRender,
  parseMentionHref,
  type MentionContext,
  type MentionSearchTask
} from "./mentionUtils";

const context: MentionContext = {
  projectId: "project-a",
  taskId: "task-current"
};

const users: User[] = [
  {
    id: "user-torino",
    name: "Torino Teste",
    email: "torino@mk.com",
    role: Role.DESIGNER,
    avatarUrl: null,
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
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
          { id: "task-other", title: "Diagrama unifilar" },
          { id: "task-torino", title: "[Torino] PPCI - Executivo" }
        ] as Task[]
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
        tasks: [{ id: "task-dup", title: "Memorial descritivo" }] as Task[]
      }
    ]
  },
  {
    id: "project-torino",
    name: "Torino SAN",
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
        id: "section-torino",
        projectId: "project-torino",
        name: "Civil",
        type: DisciplineType.OTHER,
        status: DisciplineStatus.IN_PROGRESS,
        responsibleId: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        responsible: null,
        tasks: []
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
        tasks: [{ id: "task-remote", title: "Planta baixa" }] as Task[]
      }
    ]
  }
];

const searchTasks: MentionSearchTask[] = [
  {
    id: "task-spk",
    title: "SPK - Tipos e Sala Comercial",
    projectId: "project-a",
    projectName: "SPK - Executivo",
    sectionName: "Civil"
  },
  {
    id: "task-spk-remote",
    title: "SPK - Checklist remoto",
    projectId: "project-b",
    projectName: "Residencial Sul",
    sectionName: "Geral"
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

describe("normalizeMentionContentForRender", () => {
  it("strips legacy leading @ from mk mention links", () => {
    expect(normalizeMentionContentForRender("@[Torino PPCI](mk://task/task-1)")).toBe(
      "[Torino PPCI](mk://task/task-1)"
    );
  });

  it("keeps legacy mention links without @ renderable", () => {
    expect(normalizeMentionContentForRender("[Torino PPCI](mk://task/task-1)")).toBe(
      "[Torino PPCI](mk://task/task-1)"
    );
  });
});

describe("editor mention markdown conversion", () => {
  it("converts persisted mention links to atomic editor shortcodes", () => {
    expect(markdownMentionsToEditorContent("Olá @[João](mk://user/user-1)")).toBe(
      'Olá [@ id="user/user-1" label="João"]'
    );
  });

  it("converts legacy mention links to atomic editor shortcodes", () => {
    expect(markdownMentionsToEditorContent("[Tarefa](mk://task/task-1)")).toBe(
      '[@ id="task/task-1" label="Tarefa"]'
    );
  });

  it("converts editor shortcodes back to public markdown", () => {
    expect(editorMentionsToMarkdown('Ver [@ id="meeting-minute/minute-1" label="Reunião inicial"]')).toBe(
      "Ver @[Reunião inicial](mk://meeting-minute/minute-1)"
    );
  });
});

describe("parseMentionHref", () => {
  it("parses mk mention urls", () => {
    expect(parseMentionHref("mk://user/user-1")).toEqual({ type: "user", id: "user-1" });
    expect(parseMentionHref("mk://task/task-1")).toEqual({ type: "task", id: "task-1" });
    expect(parseMentionHref("mk://project/project-1")).toEqual({ type: "project", id: "project-1" });
    expect(parseMentionHref("mk://meeting-minute/minute-1")).toEqual({ type: "meeting-minute", id: "minute-1" });
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

  it("sorts users before projects before tasks", () => {
    const suggestions = buildMentionSuggestions("torino", context, users, projects);
    const firstUserIndex = suggestions.findIndex((item) => item.type === "user");
    const firstProjectIndex = suggestions.findIndex((item) => item.type === "project");
    const firstTaskIndex = suggestions.findIndex((item) => item.type === "task");

    expect(firstUserIndex).toBeGreaterThanOrEqual(0);
    expect(firstProjectIndex).toBeGreaterThanOrEqual(0);
    expect(firstTaskIndex).toBeGreaterThanOrEqual(0);
    expect(firstUserIndex).toBeLessThan(firstProjectIndex);
    expect(firstProjectIndex).toBeLessThan(firstTaskIndex);
  });

  it("matches task titles with brackets and spaces in the query", () => {
    const suggestions = buildMentionSuggestions("torino ppci", context, users, projects);
    const task = suggestions.find((item) => item.id === "task-torino");

    expect(task).toBeDefined();
    expect(task?.label).toBe("[Torino] PPCI - Executivo");
  });

  it("includes tasks returned from global search", () => {
    const suggestions = buildMentionSuggestions("spk", context, users, projects, [], searchTasks);
    const task = suggestions.find((item) => item.id === "task-spk");

    expect(task).toBeDefined();
    expect(task?.label).toBe("SPK - Tipos e Sala Comercial");
    expect(task?.subtitle).toBe("SPK - Executivo · Civil");
  });

  it("prioritizes global search tasks from the current project", () => {
    const suggestions = buildMentionSuggestions("spk", context, users, projects, [], searchTasks);
    const taskIds = suggestions.filter((item) => item.type === "task").map((item) => item.id);

    expect(taskIds.indexOf("task-spk")).toBeLessThan(taskIds.indexOf("task-spk-remote"));
  });

  it("deduplicates local and global search task suggestions", () => {
    const suggestions = buildMentionSuggestions("memorial", context, users, projects, [], [
      {
        id: "task-dup",
        title: "Memorial descritivo",
        projectId: "project-a",
        projectName: "EdifÃ­cio Central",
        sectionName: "ElÃ©trica"
      }
    ]);
    const duplicateTasks = suggestions.filter((item) => item.type === "task" && item.id === "task-dup");

    expect(duplicateTasks).toHaveLength(1);
  });

  it("matches search text without accents or punctuation", () => {
    const suggestions = buildMentionSuggestions("eletrica revisao", context, users, projects, [], [
      {
        id: "task-accent",
        title: "El\u00e9trica - Revis\u00e3o",
        projectId: "project-a",
        projectName: "Edif\u00edcio Central",
        sectionName: "El\u00e9trica"
      }
    ]);
    const task = suggestions.find((item) => item.id === "task-accent");

    expect(task).toBeDefined();
  });

  it("includes meeting minutes from the current project only", () => {
    const suggestions = buildMentionSuggestions("reunião", context, users, projects, [
      { id: "minute-current", projectId: "project-a", title: "Reunião inicial", meetingDate: "2026-06-25T00:00:00.000Z" },
      { id: "minute-other", projectId: "project-b", title: "Reunião externa", meetingDate: "2026-06-25T00:00:00.000Z" }
    ]);
    const minuteIds = suggestions.filter((item) => item.type === "meeting-minute").map((item) => item.id);

    expect(minuteIds).toEqual(["minute-current"]);
  });
});
