import { describe, expect, it } from "vitest";
import {
  ADVANCED_SEARCH_DEFAULT_LIMIT,
  ADVANCED_SEARCH_MAX_LIMIT,
  GLOBAL_SEARCH_DEFAULT_LIMIT,
  GLOBAL_SEARCH_MAX_LIMIT,
  buildAdvancedTaskSearchWhere,
  buildTaskSearchWhere,
  clampAdvancedSearchLimit,
  clampSearchLimit,
  compareTasksBySearchRelevance,
  createSearchExcerpt,
  paginateSearchResults,
  projectMatchesAdvancedStatus,
  projectMatchesSearch,
  searchTextMatches,
  normalizeSearchTerm,
  taskMatchesSearch,
  taskSearchMatchContext,
  taskSearchRank,
  toGlobalSearchTask
} from "./globalSearch.js";
import { Priority, ProjectStatus, TaskStatus } from "./enums.js";

type TaskSearchRecord = Parameters<typeof toGlobalSearchTask>[0];

function taskWithMemberships(): TaskSearchRecord {
  return {
    id: "task-1",
    name: "SPK - Tipos e Sala Comercial",
    memberships: [
      {
        sectionName: "Geral",
        projectName: "Projeto remoto",
        section: {
          name: "Geral",
          project: {
            id: "project-remote",
            name: "Projeto remoto",
            archived: false
          }
        },
        project: null
      },
      {
        sectionName: "Civil",
        projectName: "SPK - Executivo",
        section: {
          name: "Civil",
          project: {
            id: "project-current",
            name: "SPK - Executivo",
            archived: false
          }
        },
        project: null
      }
    ]
  };
}

describe("globalSearch helpers", () => {
  it("normalizes the search term", () => {
    expect(normalizeSearchTerm("  Teste  ")).toBe("Teste");
    expect(normalizeSearchTerm(["Teste"])).toBe("");
  });

  it("matches without accents, case or punctuation", () => {
    expect(searchTextMatches("indu", ["INDÚSTRIA FDR"])).toBe(true);
    expect(searchTextMatches("indú", ["INDÚSTRIA FDR"])).toBe(true);
    expect(searchTextMatches("ap towers", ["[AP Towers] Teste de percolação"])).toBe(true);
  });

  it("matches project fields using normalized text", () => {
    expect(
      projectMatchesSearch(
        {
          id: "project-1",
          name: "INDÚSTRIA FDR",
          builder: null,
          team: null,
          workspace: { name: "MK Engenharia" }
        },
        "indu"
      )
    ).toBe(true);
  });

  it("caps the requested limit", () => {
    expect(clampSearchLimit(undefined)).toBe(GLOBAL_SEARCH_DEFAULT_LIMIT);
    expect(clampSearchLimit("0")).toBe(1);
    expect(clampSearchLimit("999")).toBe(GLOBAL_SEARCH_MAX_LIMIT);
  });

  it("caps the advanced requested limit", () => {
    expect(clampAdvancedSearchLimit(undefined)).toBe(ADVANCED_SEARCH_DEFAULT_LIMIT);
    expect(clampAdvancedSearchLimit("0")).toBe(1);
    expect(clampAdvancedSearchLimit("999")).toBe(ADVANCED_SEARCH_MAX_LIMIT);
  });

  it("paginates advanced result arrays", () => {
    expect(paginateSearchResults([1, 2, 3, 4, 5], 2, 2)).toEqual([3, 4]);
  });

  it("always excludes legacy subtasks from task search", () => {
    expect(buildTaskSearchWhere("Teste")).toMatchObject({
      deletedAt: null,
      parentId: null,
      OR: expect.arrayContaining([
        { notes: { contains: "Teste" } },
        { comments: { some: { content: { contains: "Teste" } } } }
      ])
    });
    expect(buildTaskSearchWhere("")).toEqual({ deletedAt: null, parentId: null });
  });

  it("builds advanced task filters without allowing legacy subtasks", () => {
    const where = buildAdvancedTaskSearchWhere({
      term: "Teste",
      projectId: "project-1",
      taskStatuses: [TaskStatus.IN_PROGRESS],
      priorities: [Priority.HIGH],
      assigneeId: "user-1",
      dueFrom: "2026-06-01",
      dueTo: "2026-06-30",
      completion: "open"
    });

    expect(where).toEqual(expect.objectContaining({
      AND: expect.arrayContaining([
        expect.objectContaining({ parentId: null }),
        { priority: { in: [Priority.HIGH] } },
        { assignee: { id: "user-1" } },
        {
          OR: [
            { dueOn: { gte: "2026-06-01", lte: "2026-06-30" } },
            { dueAt: { gte: new Date("2026-06-01T00:00:00.000Z"), lte: new Date("2026-06-30T23:59:59.999Z") } }
          ]
        },
        { completed: false }
      ])
    }));
  });

  it("matches advanced project status from archived state", () => {
    expect(projectMatchesAdvancedStatus({ archived: false }, [ProjectStatus.ACTIVE])).toBe(true);
    expect(projectMatchesAdvancedStatus({ archived: true }, [ProjectStatus.COMPLETED])).toBe(true);
    expect(projectMatchesAdvancedStatus({ archived: false }, [ProjectStatus.COMPLETED])).toBe(false);
  });

  it("maps a task result to the command palette target", () => {
    const result = toGlobalSearchTask({
      id: "task-1",
      name: "Teste de percolacao",
      memberships: [
        {
          sectionName: null,
          projectName: null,
          section: {
            name: "Civil",
          project: {
            id: "project-1",
            name: "Teste",
            archived: false
          }
          },
          project: null
        }
      ]
    });

    expect(result).toEqual({
      id: "task-1",
      title: "Teste de percolacao",
      projectId: "project-1",
      projectName: "Teste",
      sectionName: "Civil"
    });
  });

  it("uses the preferred project membership when provided", () => {
    expect(toGlobalSearchTask(taskWithMemberships(), "project-current")).toMatchObject({
      id: "task-1",
      title: "SPK - Tipos e Sala Comercial",
      projectId: "project-current",
      projectName: "SPK - Executivo",
      sectionName: "Civil"
    });
  });

  it("falls back to the first valid membership without a preferred project", () => {
    expect(toGlobalSearchTask(taskWithMemberships())).toMatchObject({
      projectId: "project-remote",
      projectName: "Projeto remoto",
      sectionName: "Geral"
    });
  });

  it("matches task descriptions and comments with normalized text", () => {
    const task: TaskSearchRecord = {
      ...taskWithMemberships(),
      notes: "Compatibilização hidráulica",
      comments: [{ content: "Revisar prancha pré-executiva", createdAt: new Date("2026-07-15T12:00:00.000Z") }]
    };

    expect(taskMatchesSearch(task, "hidraulica")).toBe(true);
    expect(taskMatchesSearch(task, "pre executiva")).toBe(true);
    expect(taskSearchRank(task, "hidraulica")).toBe(2);
    expect(taskSearchRank(task, "pre executiva")).toBe(3);
  });

  it("prioritizes title, membership, description and comments in that order", () => {
    const tasks: TaskSearchRecord[] = [
      { ...taskWithMemberships(), id: "comment", name: "Delta", comments: [{ content: "termo", createdAt: new Date() }] },
      { ...taskWithMemberships(), id: "description", name: "Charlie", notes: "termo" },
      { ...taskWithMemberships(), id: "membership", name: "Bravo", memberships: taskWithMemberships().memberships.map((membership, index) => index === 0 ? { ...membership, sectionName: "Termo" } : membership) },
      { ...taskWithMemberships(), id: "title", name: "Termo Alpha" }
    ];

    expect(tasks.sort((left, right) => compareTasksBySearchRelevance(left, right, "termo")).map((task) => task.id)).toEqual([
      "title",
      "membership",
      "description",
      "comment"
    ]);
  });

  it("uses description before comments and the newest matching comment", () => {
    const comments = [
      { content: "Comentário antigo com revisão", createdAt: new Date("2026-07-10T12:00:00.000Z") },
      { content: "Comentário novo com revisão", createdAt: new Date("2026-07-16T12:00:00.000Z") }
    ];
    const task: TaskSearchRecord = { ...taskWithMemberships(), name: "Outra tarefa", notes: "Descrição com revisão", comments };

    expect(taskSearchMatchContext(task, "revisao")).toEqual({ source: "description", excerpt: "Descrição com revisão" });
    expect(taskSearchMatchContext({ ...task, notes: null }, "revisao")).toEqual({ source: "comment", excerpt: "Comentário novo com revisão" });
  });

  it("does not expose internal context when a visible field already matches", () => {
    const task: TaskSearchRecord = {
      ...taskWithMemberships(),
      name: "Revisão estrutural",
      notes: "Descrição sobre revisão"
    };

    expect(taskSearchMatchContext(task, "revisao")).toBeNull();
  });

  it("centers and limits excerpts while preserving the normalized match", () => {
    const excerpt = createSearchExcerpt(`${"início ".repeat(30)}Compatibilização hidráulica ${"fim ".repeat(30)}`, "compatibilizacao hidraulica");

    expect(excerpt.length).toBeLessThanOrEqual(180);
    expect(excerpt.startsWith("…")).toBe(true);
    expect(excerpt.endsWith("…")).toBe(true);
    expect(excerpt).toContain("Compatibilização hidráulica");
  });
});
