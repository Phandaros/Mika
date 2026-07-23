import { describe, expect, it } from "vitest";
import type { Task } from "shared";
import { compareTasksByDisciplineAndCreation, normalizeTaskDiscipline } from "./taskDisciplines";

type SortableTask = Pick<Task, "id" | "taskDiscipline" | "createdAt">;

function task(id: string, taskDiscipline: string | null, createdAt: string): SortableTask {
  return { id, taskDiscipline, createdAt };
}

describe("task discipline catalog", () => {
  it.each([
    ["HVAC", "CLI"],
    ["Climatização", "CLI"],
    ["PCI", "PPCI"],
    ["AUTOMAÇÃO", "AUT"],
    ["REVISÃO", "Revisão"]
  ])("normalizes %s as %s", (value, expected) => {
    expect(normalizeTaskDiscipline(value)).toBe(expected);
  });
});

describe("project list task sorting", () => {
  it("uses catalog order before creation date", () => {
    const tasks = [
      task("hid", "HID", "2020-01-01T00:00:00.000Z"),
      task("spda", "SPDA", "2025-01-01T00:00:00.000Z"),
      task("ele", "ELE", "2026-01-01T00:00:00.000Z")
    ];

    expect(tasks.sort(compareTasksByDisciplineAndCreation).map(({ id }) => id)).toEqual(["ele", "spda", "hid"]);
  });

  it("uses oldest creation date first inside a discipline", () => {
    const tasks = [
      task("new", "CLI", "2026-02-01T00:00:00.000Z"),
      task("old", "CLI", "2024-02-01T00:00:00.000Z")
    ];

    expect(tasks.sort(compareTasksByDisciplineAndCreation).map(({ id }) => id)).toEqual(["old", "new"]);
  });

  it("places unknown values alphabetically after the catalog and blanks last", () => {
    const tasks = [
      task("blank", null, "2020-01-01T00:00:00.000Z"),
      task("zeta", "ZETA", "2020-01-01T00:00:00.000Z"),
      task("known", "Revisão", "2026-01-01T00:00:00.000Z"),
      task("apr", "APR", "2020-01-01T00:00:00.000Z")
    ];

    expect(tasks.sort(compareTasksByDisciplineAndCreation).map(({ id }) => id)).toEqual(["known", "apr", "zeta", "blank"]);
  });

  it("uses the id as a deterministic final tiebreaker", () => {
    const tasks = [task("b", "ELE", "2026-01-01T00:00:00.000Z"), task("a", "ELE", "2026-01-01T00:00:00.000Z")];
    expect(tasks.sort(compareTasksByDisciplineAndCreation).map(({ id }) => id)).toEqual(["a", "b"]);
  });
});
