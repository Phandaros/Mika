import { describe, expect, it } from "vitest";
import { Role } from "./enums.js";
import { resolveMyTasksTargetUserId } from "./myTasks.js";

describe("resolveMyTasksTargetUserId", () => {
  it("returns the requested user for coordinators", () => {
    expect(
      resolveMyTasksTargetUserId({ id: "viewer-1", role: Role.COORDINATOR }, "target-2")
    ).toBe("target-2");
  });

  it("returns the requested user for admins", () => {
    expect(
      resolveMyTasksTargetUserId({ id: "viewer-1", role: Role.ADMIN }, "target-2")
    ).toBe("target-2");
  });

  it("ignores the requested user for designers", () => {
    expect(
      resolveMyTasksTargetUserId({ id: "viewer-1", role: Role.DESIGNER }, "target-2")
    ).toBe("viewer-1");
  });

  it("keeps the viewer when no userId is requested", () => {
    expect(resolveMyTasksTargetUserId({ id: "viewer-1", role: Role.COORDINATOR })).toBe("viewer-1");
  });
});
