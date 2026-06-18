import { describe, expect, it } from "vitest";
import { reviewTaskDisplayTitle } from "./reviewTaskLabel";

describe("reviewTaskDisplayTitle", () => {
  it("remove os prefixos de revisão e do projeto vinculado", () => {
    expect(reviewTaskDisplayTitle("[REV] [Torino] PPCI - Executivo", "Torino")).toBe("PPCI - Executivo");
  });

  it("preserva prefixos que não correspondem ao projeto vinculado", () => {
    expect(reviewTaskDisplayTitle("[REV] [Hope Town] HID - Alterações", "Civil - Sprint Board")).toBe(
      "[Hope Town] HID - Alterações"
    );
  });

  it("mantém o título quando não há prefixos", () => {
    expect(reviewTaskDisplayTitle("PPCI - Modelar RVT", "Civil - Sprint Board")).toBe("PPCI - Modelar RVT");
  });
});
