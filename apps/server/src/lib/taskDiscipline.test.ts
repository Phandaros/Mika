import { describe, expect, it } from "vitest";
import { inferTaskDiscipline, normalizeTaskDiscipline, taskDisciplineForCreate } from "./taskDiscipline.js";

describe("task discipline inference", () => {
  it.each([
    ["ELE - Executivo", "ELE"],
    ["[Hope Town] HID - Alterações", "HID"],
    ["[AP Praia] Sprinkler - Executivo", "SPK"],
    ["Climatização - Anteprojeto", "CLI"],
    ["AUTOMAÇÃO - Executivo", "AUT"],
    ["Gás - Modelar projeto", "GÁS"],
    ["Estudo preliminar - PPCI", "EP"],
    ["{R}-[Lugano] HID / SAN - Ajustes", "Revisão"]
  ])("infers %s as %s", (title, expected) => {
    expect(inferTaskDiscipline(title)).toBe(expected);
  });

  it.each(["Relatório de verificação", "Fase 00 - Projeto preliminar", "Revisar hidráulico", "Hotel Telecom Palace"])(
    "leaves ambiguous title %s without a discipline",
    (title) => {
      expect(inferTaskDiscipline(title)).toBeNull();
    }
  );

  it("requires a boundary after an alias", () => {
    expect(inferTaskDiscipline("ELETRODUTOS")).toBeNull();
  });
});

describe("task discipline normalization", () => {
  it.each([
    ["PCI", "PPCI"],
    ["automação", "AUT"],
    ["REVISÃO", "Revisão"],
    ["HVAC", "CLI"],
    [" Climatização ", "CLI"]
  ])("normalizes %s as %s", (value, expected) => {
    expect(normalizeTaskDiscipline(value)).toBe(expected);
  });

  it("preserves unknown manually supplied values", () => {
    expect(normalizeTaskDiscipline("APR")).toBe("APR");
  });

  it("keeps a manual discipline and only infers when it is blank", () => {
    expect(taskDisciplineForCreate("HID - Executivo", "ELE")).toBe("ELE");
    expect(taskDisciplineForCreate("HID - Executivo", null)).toBe("HID");
    expect(taskDisciplineForCreate("Relatório", null)).toBeNull();
  });
});
