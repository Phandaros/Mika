import { describe, expect, it } from "vitest";
import { TaskStatus } from "shared";
import { projectIndicatorLink, taskIndicatorLink, workloadIndicatorLink } from "./indicatorLinks";

describe("indicatorLinks", () => {
  it("links task indicators to advanced search", () => {
    const url = taskIndicatorLink({
      period: "all",
      scope: "general",
      status: TaskStatus.OVERDUE,
      assigneeId: "user-1"
    });

    expect(url).toBe("/search?type=tasks&completion=all&source=indicators&indicatorMetric=overdueTasks&indicatorPeriod=all&indicatorScope=general&status=OVERDUE&assigneeId=user-1");
  });

  it("links portfolio indicators to project filters", () => {
    const url = projectIndicatorLink({
      period: "all",
      platform: "BIM",
      discipline: "Elétrico"
    });

    expect(url).toContain("/projects?");
    expect(url).toContain("platform=BIM");
    expect(decodeURIComponent(url)).toContain("\"fieldKey\":\"disciplinas\"");
    expect(decodeURIComponent(url)).toContain("Elétrico");
  });

  it("links operational scopes to workload pages", () => {
    expect(workloadIndicatorLink("civil")).toBe("/workloads/civil");
    expect(workloadIndicatorLink("electrical")).toBe("/workloads/eletrico");
    expect(workloadIndicatorLink("general")).toBe("/workloads/geral");
  });
});
