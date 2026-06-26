import { describe, expect, it } from "vitest";
import { taskDeadlineViolation } from "./taskDeadlineRules.js";

describe("taskDeadlineRules", () => {
  it("rejects delivery dates after the maximum deadline", () => {
    expect(taskDeadlineViolation({ dueDate: "2026-06-30", maxDeadline: "2026-06-29" })).toBe(true);
  });

  it("allows delivery dates on the maximum deadline", () => {
    expect(taskDeadlineViolation({ dueDate: "2026-06-29", maxDeadline: "2026-06-29" })).toBe(false);
  });

  it("uses existing values when one side is omitted", () => {
    expect(
      taskDeadlineViolation({
        dueDate: "2026-07-01",
        existingMaxDeadline: new Date("2026-06-30T00:00:00.000Z")
      })
    ).toBe(true);
    expect(
      taskDeadlineViolation({
        maxDeadline: "2026-06-30",
        existingDueDate: "2026-07-01"
      })
    ).toBe(true);
  });
});
