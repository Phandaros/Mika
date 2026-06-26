import { describe, expect, it } from "vitest";
import { Role } from "./enums.js";
import { toTaskDto } from "./asanaDto.js";

function taskWithMaxDeadline() {
  return {
    id: "task-1",
    asanaGid: "asana-task-1",
    memberships: [],
    requestedReviews: [],
    customFieldValues: [],
    tags: [],
    name: "Tarefa",
    notes: null,
    htmlNotes: null,
    mikaStatus: "TODO",
    priority: null,
    assignee: null,
    assigneeGid: null,
    createdByUserId: null,
    workflowRootTaskId: null,
    adjustmentNumber: 0,
    startOn: null,
    dueOn: "2026-06-29",
    dueAt: null,
    estimatedDays: null,
    platform: null,
    discipline: null,
    estimatedTime: null,
    maxDeadline: new Date("2026-06-30T00:00:00.000Z"),
    conclusionDays: null,
    stage: null,
    completed: false,
    completedAtAsana: null,
    asanaCreatedAt: null,
    asanaModifiedAt: null,
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-02T00:00:00.000Z")
  };
}

describe("toTaskDto", () => {
  it("shows maxDeadline to coordinators and admins", () => {
    expect(toTaskDto(taskWithMaxDeadline() as never, undefined, undefined, { viewerRole: Role.COORDINATOR }).maxDeadline).toBe(
      "2026-06-30"
    );
    expect(toTaskDto(taskWithMaxDeadline() as never, undefined, undefined, { viewerRole: Role.ADMIN }).maxDeadline).toBe(
      "2026-06-30"
    );
  });

  it("masks maxDeadline for designers and interns", () => {
    expect(toTaskDto(taskWithMaxDeadline() as never, undefined, undefined, { viewerRole: Role.DESIGNER }).maxDeadline).toBeNull();
    expect(toTaskDto(taskWithMaxDeadline() as never, undefined, undefined, { viewerRole: Role.INTERN }).maxDeadline).toBeNull();
  });
});
