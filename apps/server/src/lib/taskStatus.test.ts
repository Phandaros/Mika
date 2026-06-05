import { describe, expect, it } from "vitest";
import { TaskStatus } from "./enums.js";
import { normalizeLegacyAsanaTaskStatus, normalizePersistedTaskStatus, publicTaskStatus } from "./taskStatus.js";

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

  it("uses completed=true as finished even when Mika status is old TODO", () => {
    expect(
      publicTaskStatus({
        completed: true,
        mikaStatus: TaskStatus.TODO,
        assigneeStatus: null,
        dueOn: null,
        dueAt: null
      })
    ).toBe(TaskStatus.FINISHED);
  });

  it("does not persist overdue as a writable Mika status", () => {
    expect(normalizeLegacyAsanaTaskStatus("Atrasado")).toBe(TaskStatus.OVERDUE);
    expect(normalizePersistedTaskStatus("Atrasado")).toBeNull();
    expect(normalizePersistedTaskStatus(TaskStatus.OVERDUE)).toBeNull();
  });
});
