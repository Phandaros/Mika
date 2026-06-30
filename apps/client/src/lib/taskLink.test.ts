import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAbsoluteAppUrl } from "./taskLink";

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
