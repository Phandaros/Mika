import { describe, expect, it } from "vitest";
import { stripProjectPrefix } from "./workloadTaskLabel";

describe("stripProjectPrefix", () => {
  it("remove apenas o prefixo que corresponde ao projeto vinculado", () => {
    expect(stripProjectPrefix("[Torino] PPCI - Executivo", "Torino")).toBe("PPCI - Executivo");
    expect(stripProjectPrefix("[Torino] - PPCI - Executivo", "Torino")).toBe("PPCI - Executivo");
  });

  it("preserva prefixos sem vínculo com o projeto", () => {
    expect(stripProjectPrefix("[Hope Town] HID - Alterações", "Civil - Sprint Board")).toBe(
      "[Hope Town] HID - Alterações"
    );
  });
});
