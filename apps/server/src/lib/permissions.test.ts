import { describe, expect, it } from "vitest";
import { Role } from "./enums.js";
import { canCompleteTasks, canManageTasks, hasMinimumRole } from "./permissions.js";

describe("permissions", () => {
  it("allows coordinators and admins to manage tasks", () => {
    expect(canManageTasks(Role.ADMIN)).toBe(true);
    expect(canManageTasks(Role.COORDINATOR)).toBe(true);
  });

  it("does not allow designers or interns to manage tasks", () => {
    expect(canManageTasks(Role.DESIGNER)).toBe(false);
    expect(canManageTasks(Role.INTERN)).toBe(false);
  });

  it("allows designers and above to complete tasks", () => {
    expect(canCompleteTasks(Role.ADMIN)).toBe(true);
    expect(canCompleteTasks(Role.COORDINATOR)).toBe(true);
    expect(canCompleteTasks(Role.DESIGNER)).toBe(true);
    expect(canCompleteTasks(Role.INTERN)).toBe(false);
  });

  it("checks minimum roles by hierarchy", () => {
    expect(hasMinimumRole(Role.DESIGNER, Role.DESIGNER)).toBe(true);
    expect(hasMinimumRole(Role.DESIGNER, Role.COORDINATOR)).toBe(false);
    expect(hasMinimumRole(Role.COORDINATOR, Role.DESIGNER)).toBe(true);
  });
});
