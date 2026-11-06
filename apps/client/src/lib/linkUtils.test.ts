import { describe, expect, it } from "vitest";
import { normalizeLinkHref } from "./linkUtils";

describe("normalizeLinkHref", () => {
  it("adds https when the protocol is missing", () => {
    expect(normalizeLinkHref(" exemplo.com/a ")).toBe("https://exemplo.com/a");
  });

  it("keeps allowed protocols", () => {
    expect(normalizeLinkHref("http://exemplo.com")).toBe("http://exemplo.com");
    expect(normalizeLinkHref("mailto:a@b.com")).toBe("mailto:a@b.com");
  });

  it("rejects unsafe or invalid values", () => {
    expect(normalizeLinkHref("javascript:alert(1)")).toBeNull();
    expect(normalizeLinkHref("com espaço")).toBeNull();
    expect(normalizeLinkHref("")).toBeNull();
  });
});
