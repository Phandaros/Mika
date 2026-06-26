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
  paginateSearchResults,
  projectMatchesAdvancedStatus,
  projectMatchesSearch,
  searchTextMatches,
  normalizeSearchTerm,
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
            name: "Projeto remoto"
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
            name: "SPK - Executivo"
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
    expect(buildTaskSearchWhere("Teste")).toMatchObject({ parentId: null });
    expect(buildTaskSearchWhere("")).toEqual({ parentId: null });
  });

  it("builds advanced task filters without allowing legacy subtasks", () => {
    expect(
      buildAdvancedTaskSearchWhere({
        term: "Teste",
        projectId: "project-1",
        taskStatuses: [TaskStatus.IN_PROGRESS],
        priorities: [Priority.HIGH],
        assigneeId: "user-1",
        dueFrom: "2026-06-01",
        dueTo: "2026-06-30",
        completion: "open"
      })
    ).toMatchObject({
      AND: [
        expect.objectContaining({ parentId: null }),
        expect.any(Object),
        { mikaStatus: { in: [TaskStatus.IN_PROGRESS] } },
        { priority: { in: [Priority.HIGH] } },
        { assignee: { id: "user-1" } },
        { dueOn: { gte: "2026-06-01", lte: "2026-06-30" } },
        { completed: false }
      ]
    });
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
              name: "Teste"
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
});
