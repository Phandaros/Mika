import { describe, expect, it } from "vitest";
import { findNormalizedMatchRange } from "./searchHighlight";

describe("search highlighting", () => {
  it("finds matches without accents, case or punctuation", () => {
    const value = "Comentário: Compatibilização hidráulica";
    const range = findNormalizedMatchRange(value, "compatibilizacao hidraulica");

    expect(range).not.toBeNull();
    expect(value.slice(range?.start, range?.end)).toBe("Compatibilização hidráulica");
  });

  it("returns null for an empty or absent term", () => {
    expect(findNormalizedMatchRange("Descrição", "")).toBeNull();
    expect(findNormalizedMatchRange("Descrição", "elétrica")).toBeNull();
  });
});
