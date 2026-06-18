import { describe, expect, it } from "vitest";
import { relativeDueDateDisplay } from "./relativeDueDate";

const referenceDate = new Date(2026, 5, 18, 12, 0, 0);

describe("relativeDueDateDisplay", () => {
  it("formata datas de hoje, amanhã e futuras", () => {
    expect(relativeDueDateDisplay("2026-06-18", referenceDate)).toEqual({
      label: "Hoje · 18/06",
      title: "Hoje · 18/06/2026",
      tone: "today"
    });
    expect(relativeDueDateDisplay("2026-06-19", referenceDate).label).toBe("Amanhã · 19/06");
    expect(relativeDueDateDisplay("2026-06-21", referenceDate).label).toBe("Em 3 dias · 21/06");
  });

  it("formata atrasos com singular e plural", () => {
    expect(relativeDueDateDisplay("2026-06-17", referenceDate).label).toBe("Atrasada há 1 dia · 17/06");
    expect(relativeDueDateDisplay("2026-06-12", referenceDate)).toMatchObject({
      label: "Atrasada há 6 dias · 12/06",
      tone: "overdue"
    });
  });

  it("usa fallback para prazo ausente ou inválido", () => {
    expect(relativeDueDateDisplay(null, referenceDate)).toEqual({
      label: "Sem prazo",
      title: "Sem prazo",
      tone: "empty"
    });
    expect(relativeDueDateDisplay("inválida", referenceDate).label).toBe("Sem prazo");
  });
});
