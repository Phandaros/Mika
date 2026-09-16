import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAbsoluteAppUrl, buildTaskPath, openTaskInNewContext, resolveTaskProjectId } from "./taskLink";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildAbsoluteAppUrl", () => {
  it("builds absolute browser URLs from internal paths", () => {
    vi.stubGlobal("window", {
      location: { origin: "http://localhost:5173" }
    });

    expect(buildAbsoluteAppUrl("/projects/project-1?task=task-1")).toBe(
      "http://localhost:5173/projects/project-1?task=task-1"
    );
  });

  it("builds absolute desktop URLs with hash routing", () => {
    vi.stubGlobal("window", {
      location: { origin: "http://localhost:5173" },
      mkProjetos: { isDesktop: true }
    });

    expect(buildAbsoluteAppUrl("/projects/project-1?task=task-1")).toBe(
      "http://localhost:5173#/projects/project-1?task=task-1"
    );
  });
});

describe("buildTaskPath", () => {
  const task = {
    id: "task/1",
    discipline: { projectId: "primary-project" },
    projects: [{ id: "secondary-project" }]
  };

  it("prioritizes the contextual project", () => {
    expect(buildTaskPath(task, { projectId: "current-project" })).toBe(
      "/projects/current-project?task=task%2F1"
    );
  });

  it("uses the task project when there is no contextual project", () => {
    expect(buildTaskPath(task)).toBe("/projects/primary-project?task=task%2F1");
  });

  it("uses the fallback path only when the task has no project", () => {
    expect(buildTaskPath({ id: "task-1" }, { fallbackPath: "/my-tasks?view=list" })).toBe(
      "/my-tasks?view=list&task=task-1"
    );
  });

  it("prefers a portfolio project over an operational sprint board", () => {
    const taskWithMultipleProjects = {
      id: "task-1",
      discipline: { projectId: "sprint-board", projectName: "Civil - Sprint Board" },
      projects: [
        { id: "sprint-board", name: "Civil - Sprint Board" },
        { id: "werk-lugano", name: "Werk Lugano" }
      ]
    };

    expect(resolveTaskProjectId(taskWithMultipleProjects)).toBe("werk-lugano");
    expect(buildTaskPath(taskWithMultipleProjects)).toBe("/projects/werk-lugano?task=task-1");
  });
});

describe("openTaskInNewContext", () => {
  it("opens a browser tab without changing the current page", () => {
    const open = vi.fn();
    vi.stubGlobal("window", {
      location: { origin: "http://localhost:5173" },
      open
    });

    openTaskInNewContext({ id: "task-1", discipline: { projectId: "project-1" } });

    expect(open).toHaveBeenCalledWith(
      "http://localhost:5173/projects/project-1?task=task-1",
      "_blank",
      "noopener,noreferrer"
    );
  });

  it("delegates to the secure desktop bridge", () => {
    const openTaskWindow = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("window", {
      mkProjetos: { isDesktop: true, openTaskWindow }
    });

    openTaskInNewContext(
      { id: "task-1", discipline: { projectId: "primary-project" } },
      { projectId: "current-project" }
    );

    expect(openTaskWindow).toHaveBeenCalledWith("/projects/current-project?task=task-1");
  });
});
