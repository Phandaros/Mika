import { describe, expect, it } from "vitest";
import { parseCompletion, parseSearchFilters, parseTaskSort } from "../lib/searchFilters";

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

  it("parses custom indicator ranges", () => {
    const filters = parseSearchFilters(new URLSearchParams(
      "source=indicators&indicatorMetric=completedTasks&indicatorPeriod=custom&indicatorScope=general&indicatorFrom=2026-03-12&indicatorTo=2026-04-02"
    ));

    expect(filters).toMatchObject({
      indicatorPeriod: "custom",
      indicatorFrom: "2026-03-12",
      indicatorTo: "2026-04-02"
    });
  });

  it("parses task ordering and falls back to relevance", () => {
    expect(parseTaskSort("completedAt-desc")).toBe("completedAt-desc");
    expect(parseTaskSort("invalid")).toBe("relevance");
    expect(parseSearchFilters(new URLSearchParams("sort=startDate-asc"))).toMatchObject({ sort: "startDate-asc" });
  });
});
