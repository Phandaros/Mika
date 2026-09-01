import { describe, expect, it } from "vitest";
import { formatDateInput, maskDateInput, parseDateInput } from "./dateInput";

describe("dateInput", () => {
  it("aplica a máscara de data durante a digitação e ao colar", () => {
    expect(maskDateInput("2")).toBe("2");
    expect(maskDateInput("2409")).toBe("24/09");
    expect(maskDateInput("24/09/2026")).toBe("24/09/2026");
    expect(maskDateInput("24092026abc")).toBe("24/09/2026");
  });

  it("aceita apenas datas completas e existentes", () => {
    expect(formatDateInput(parseDateInput("24/09/2026"))).toBe("24/09/2026");
    expect(parseDateInput("24/09/26")).toBeNull();
    expect(parseDateInput("31/02/2026")).toBeNull();
    expect(parseDateInput("00/09/2026")).toBeNull();
  });
});
