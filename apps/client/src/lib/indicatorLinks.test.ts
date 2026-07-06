import { describe, expect, it } from "vitest";
import { DeliveryStatus, TaskStatus } from "shared";
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

  it("links delivery indicators with delivery status filters", () => {
    const url = taskIndicatorLink({
      period: "month",
      scope: "civil",
      completion: "completed",
      metric: "onTimeDeliveries",
      deliveryStatus: [DeliveryStatus.EARLY, DeliveryStatus.ON_TIME]
    });

    expect(url).toBe("/search?type=tasks&completion=completed&source=indicators&indicatorMetric=onTimeDeliveries&indicatorPeriod=month&indicatorScope=civil&deliveryStatus=EARLY&deliveryStatus=ON_TIME");
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
