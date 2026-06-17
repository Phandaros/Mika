import { describe, expect, it } from "vitest";
import {
  GLOBAL_SEARCH_DEFAULT_LIMIT,
  GLOBAL_SEARCH_MAX_LIMIT,
  buildTaskSearchWhere,
  clampSearchLimit,
  projectMatchesSearch,
  searchTextMatches,
  normalizeSearchTerm,
  toGlobalSearchTask
} from "./globalSearch.js";

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

  it("always excludes legacy subtasks from task search", () => {
    expect(buildTaskSearchWhere("Teste")).toMatchObject({ parentId: null });
    expect(buildTaskSearchWhere("")).toEqual({ parentId: null });
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
});
