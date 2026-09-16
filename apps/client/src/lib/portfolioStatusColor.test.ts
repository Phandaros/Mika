import { describe, expect, it } from "vitest";
import { portfolioStatusColor } from "./portfolioStatusColor";

describe("portfolioStatusColor", () => {
  it.each(["Aprovado", "Completo", "Concluído", "Finalizado"])(
    "uses the completed color for %s",
    (label) => {
      expect(portfolioStatusColor(label)).toBe("var(--status-done-text)");
    }
  );

  it.each([
    ["Em análise", "var(--status-analysis-text)"],
    ["Parcial", "var(--status-review-text)"],
    ["Indeferido", "var(--status-late-text)"],
    ["To Do", "var(--status-todo-text)"],
    ["Sem status", "var(--status-backlog-text)"],
    ["N/A", "var(--status-backlog-text)"],
    ["Indefinido", "var(--status-backlog-text)"]
  ])("maps %s to its semantic color", (label, color) => {
    expect(portfolioStatusColor(label)).toBe(color);
  });

  it("normalizes casing, whitespace and accents", () => {
    expect(portfolioStatusColor("  EM   ANÁLISE ")).toBe("var(--status-analysis-text)");
  });

  it("uses the neutral status color for an unknown label", () => {
    expect(portfolioStatusColor("Status legado")).toBe("var(--status-backlog-text)");
  });
});
