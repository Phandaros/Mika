import { describe, expect, it } from "vitest";
import { parseCompletion, parseSearchFilters } from "../lib/searchFilters";

describe("search page filters", () => {
  it("defaults completion to all when the parameter is absent or invalid", () => {
    expect(parseCompletion(null)).toBe("all");
    expect(parseCompletion("invalid")).toBe("all");
    expect(parseSearchFilters(new URLSearchParams()).completion).toBe("all");
  });

  it("preserves explicit completion filters and indicator parameters", () => {
    expect(parseCompletion("open")).toBe("open");
    expect(parseCompletion("completed")).toBe("completed");

    const filters = parseSearchFilters(new URLSearchParams(
      "type=tasks&completion=completed&source=indicators&indicatorMetric=onTimeDeliveries&indicatorPeriod=month&indicatorScope=civil"
    ));

    expect(filters).toMatchObject({
      type: "tasks",
      completion: "completed",
      source: "indicators",
      indicatorMetric: "onTimeDeliveries",
      indicatorPeriod: "month",
      indicatorScope: "civil"
    });
  });
});
