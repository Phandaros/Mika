import { describe, expect, it } from "vitest";
import { buildTaskSplitPlan, splitBaseName } from "./taskSplit.js";

describe("task split planning", () => {
  it("plans the first split as two numbered parts", () => {
    const plan = buildTaskSplitPlan(
      [{ id: "task-1", name: "HID - Executivo", splitPartNumber: null, createdAt: new Date("2026-01-01") }],
      "task-1",
      "task-2"
    );

    expect(plan.insertedPartNumber).toBe(2);
    expect(plan.renames).toEqual([
      { id: "task-1", previousName: "HID - Executivo", name: "HID - Executivo [1/2]", partNumber: 1, partTotal: 2 },
      { id: "task-2", previousName: "HID - Executivo [2/2]", name: "HID - Executivo [2/2]", partNumber: 2, partTotal: 2 }
    ]);
  });

  it("inserts the new part after the selected split part", () => {
    const plan = buildTaskSplitPlan(
      [
        { id: "task-1", name: "HID - Executivo [1/2]", splitPartNumber: 1, createdAt: new Date("2026-01-01") },
        { id: "task-2", name: "HID - Executivo [2/2]", splitPartNumber: 2, createdAt: new Date("2026-01-02") }
      ],
      "task-1",
      "task-3"
    );

    expect(plan.renames.map((item) => [item.id, item.name])).toEqual([
      ["task-1", "HID - Executivo [1/3]"],
      ["task-3", "HID - Executivo [2/3]"],
      ["task-2", "HID - Executivo [3/3]"]
    ]);
  });

  it("removes only the final split suffix from the base name", () => {
    expect(splitBaseName("HID [compatibilização] - Executivo [1/2]")).toBe("HID [compatibilização] - Executivo");
  });
});
