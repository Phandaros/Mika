import type { AdvancedSearchIndicatorMetric, IndicatorPeriod, IndicatorScope } from "shared";
import { TaskStatus } from "shared";

export function taskIndicatorLink(input: {
  period: IndicatorPeriod;
  scope: IndicatorScope;
  metric?: AdvancedSearchIndicatorMetric;
  status?: TaskStatus;
  assigneeId?: string | null;
  completion?: "open" | "completed" | "all";
}): string {
  const params = new URLSearchParams();
  params.set("type", "tasks");
  params.set("completion", input.completion ?? (input.status === TaskStatus.FINISHED ? "completed" : "all"));
  params.set("source", "indicators");
  params.set("indicatorMetric", input.metric ?? metricFromInput(input));
  params.set("indicatorPeriod", input.period);
  params.set("indicatorScope", input.scope);

  if (input.status) {
    params.append("status", input.status);
  }

  if (input.assigneeId) {
    params.set("assigneeId", input.assigneeId);
  }

  return `/search?${params.toString()}`;
}

export function projectIndicatorLink(input: {
  period: IndicatorPeriod;
  platform?: "CAD" | "BIM" | "none";
  discipline?: string;
  portfolioField?: { fieldKey: string; type: "enum"; value: string };
}): string {
  const params = new URLSearchParams();

  if (input.platform) {
    params.append("platform", input.platform);
  }

  const customFieldFilters = [];
  if (input.discipline) {
    customFieldFilters.push({
      fieldKey: "disciplinas",
      type: "multi_enum",
      operator: "containsAny",
      values: [input.discipline]
    });
  }

  if (input.portfolioField) {
    customFieldFilters.push({
      fieldKey: input.portfolioField.fieldKey,
      type: input.portfolioField.type,
      operator: "isAnyOf",
      values: [input.portfolioField.value]
    });
  }

  if (customFieldFilters.length > 0) {
    params.set("cf", JSON.stringify(customFieldFilters));
  }

  if (input.period !== "all") {
    params.set("sort", "endDate-asc");
  }

  const query = params.toString();
  return query ? `/projects?${query}` : "/projects";
}

export function workloadIndicatorLink(scope: IndicatorScope): string {
  if (scope === "civil") {
    return "/workloads/civil";
  }

  if (scope === "electrical") {
    return "/workloads/eletrico";
  }

  return "/workloads/geral";
}

function metricFromInput(input: { status?: TaskStatus; completion?: "open" | "completed" | "all" }): AdvancedSearchIndicatorMetric {
  if (input.status === TaskStatus.OVERDUE) {
    return "overdueTasks";
  }

  if (input.status === TaskStatus.FINISHED || input.completion === "completed") {
    return "completedTasks";
  }

  if (input.completion === "open") {
    return "openTasks";
  }

  return "allTasks";
}
