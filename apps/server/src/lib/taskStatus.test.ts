import { describe, expect, it } from "vitest";
import { TaskStatus } from "./enums.js";
import {
  normalizeLegacyAsanaTaskStatus,
  normalizePersistedTaskStatus,
  publicTaskStatus,
  taskStatusCompletes,
  writableTaskStatus
} from "./taskStatus.js";

describe("task status compatibility", () => {
  it("maps legacy Asana status names to Mika statuses", () => {
    expect(normalizeLegacyAsanaTaskStatus("A fazer")).toBe(TaskStatus.TODO);
    expect(normalizeLegacyAsanaTaskStatus("No Cronograma")).toBe(TaskStatus.ON_SCHEDULE);
    expect(normalizeLegacyAsanaTaskStatus("Em andamento")).toBe(TaskStatus.IN_PROGRESS);
    expect(normalizeLegacyAsanaTaskStatus("Aguardando Revisão")).toBe(TaskStatus.AWAITING_REVIEW);
    expect(normalizeLegacyAsanaTaskStatus("Em Análise")).toBe(TaskStatus.IN_ANALYSIS);
    expect(normalizeLegacyAsanaTaskStatus("Aguardando Definição")).toBe(TaskStatus.AWAITING_DEFINITION);
    expect(normalizeLegacyAsanaTaskStatus("Aguardando Aprovação")).toBe(TaskStatus.AWAITING_DEFINITION);
    expect(normalizeLegacyAsanaTaskStatus("Finalizada")).toBe(TaskStatus.FINISHED);
  });

  it("does not complete tasks when operational status is review or analysis", () => {
    expect(taskStatusCompletes(TaskStatus.AWAITING_REVIEW)).toBe(false);
    expect(taskStatusCompletes(TaskStatus.IN_ANALYSIS)).toBe(false);
    expect(taskStatusCompletes(TaskStatus.FINISHED)).toBe(true);
  });

  it("keeps Mika status separate from completed=true", () => {
    expect(
      publicTaskStatus({
        completed: true,
        mikaStatus: TaskStatus.AWAITING_REVIEW,
        assigneeStatus: null,
        dueOn: null,
        dueAt: null
      })
    ).toBe(TaskStatus.AWAITING_REVIEW);
  });

  it("uses completed=true as finished for legacy tasks without Mika status", () => {
    expect(
      publicTaskStatus({
        completed: true,
        mikaStatus: null,
        assigneeStatus: null,
        dueOn: null,
        dueAt: null
      })
    ).toBe(TaskStatus.FINISHED);
  });

  it("moves open past-due tasks to overdue when status is not awaiting definition", () => {
    expect(
      publicTaskStatus({
        completed: false,
        mikaStatus: TaskStatus.IN_PROGRESS,
        assigneeStatus: null,
        dueOn: yesterdayDateOnly(),
        dueAt: null
      })
    ).toBe(TaskStatus.OVERDUE);
  });

  it("keeps open past-due tasks in awaiting definition", () => {
    expect(
      publicTaskStatus({
        completed: false,
        mikaStatus: TaskStatus.AWAITING_DEFINITION,
        assigneeStatus: null,
        dueOn: yesterdayDateOnly(),
        dueAt: null
      })
    ).toBe(TaskStatus.AWAITING_DEFINITION);
  });

  it("does not move completed past-due tasks to overdue", () => {
    expect(
      publicTaskStatus({
        completed: true,
        mikaStatus: null,
        assigneeStatus: null,
        dueOn: yesterdayDateOnly(),
        dueAt: null
      })
    ).toBe(TaskStatus.FINISHED);
  });

  it("keeps BACKLOG as canonical persisted status", () => {
    expect(normalizePersistedTaskStatus(TaskStatus.BACKLOG)).toBe(TaskStatus.BACKLOG);
    expect(normalizePersistedTaskStatus("BACKLOG")).toBe(TaskStatus.BACKLOG);
    expect(normalizeLegacyAsanaTaskStatus("Backlog")).toBe(TaskStatus.BACKLOG);
    expect(
      publicTaskStatus({
        completed: false,
        mikaStatus: TaskStatus.BACKLOG,
        assigneeStatus: null,
        dueOn: null,
        dueAt: null
      })
    ).toBe(TaskStatus.BACKLOG);
  });

  it("does not persist overdue as a writable Mika status", () => {
    expect(normalizeLegacyAsanaTaskStatus("Atrasado")).toBe(TaskStatus.OVERDUE);
    expect(normalizePersistedTaskStatus("Atrasado")).toBeNull();
    expect(normalizePersistedTaskStatus(TaskStatus.OVERDUE)).toBeNull();
    expect(writableTaskStatus(TaskStatus.OVERDUE)).toBe(TaskStatus.TODO);
  });
});

function yesterdayDateOnly(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}
