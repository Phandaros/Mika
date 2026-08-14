import {
  DeliveryStatus,
  type AdvancedSearchCompletion,
  type AdvancedSearchDeliveryStatus,
  type AdvancedSearchIndicatorMetric,
  type AdvancedSearchTaskSort,
  type AdvancedSearchType,
  type IndicatorPeriod,
  type IndicatorScope
} from "shared";
import type { AdvancedSearchFilters } from "../hooks/useAdvancedSearch";

const SEARCH_RESULT_LIMIT = 25;

export function parseSearchFilters(searchParams: URLSearchParams): AdvancedSearchFilters {
  return {
    q: searchParams.get("q") ?? "",
    type: parseType(searchParams.get("type")),
    page: Math.max(Number(searchParams.get("page") ?? "1") || 1, 1),
    limit: SEARCH_RESULT_LIMIT,
    projectId: searchParams.get("projectId") ?? undefined,
    status: searchParamArray(searchParams, "status"),
    assigneeId: searchParams.get("assigneeId") ?? undefined,
    priority: searchParamArray(searchParams, "priority"),
    dueFrom: searchParams.get("dueFrom") ?? undefined,
    dueTo: searchParams.get("dueTo") ?? undefined,
    completion: parseCompletion(searchParams.get("completion")),
    sort: parseTaskSort(searchParams.get("sort")),
    deliveryStatus: searchParamArray(searchParams, "deliveryStatus").filter((value): value is AdvancedSearchDeliveryStatus =>
      Object.values(DeliveryStatus).includes(value as DeliveryStatus)
    ),
    source: searchParams.get("source") === "indicators" ? "indicators" : undefined,
    indicatorMetric: parseIndicatorMetric(searchParams.get("indicatorMetric")),
    indicatorPeriod: parseIndicatorPeriod(searchParams.get("indicatorPeriod")),
    indicatorScope: parseIndicatorScope(searchParams.get("indicatorScope")),
    indicatorFrom: parseDateOnly(searchParams.get("indicatorFrom")),
    indicatorTo: parseDateOnly(searchParams.get("indicatorTo"))
  };
}

export function parseCompletion(value: string | null): AdvancedSearchCompletion {
  return value === "open" || value === "completed" ? value : "all";
}

export function parseTaskSort(value: string | null): AdvancedSearchTaskSort {
  const allowed: AdvancedSearchTaskSort[] = [
    "relevance",
    "completedAt-desc",
    "completedAt-asc",
    "updatedAt-desc",
    "updatedAt-asc",
    "startDate-desc",
    "startDate-asc",
    "dueDate-asc",
    "dueDate-desc",
    "title-asc",
    "title-desc"
  ];

  return allowed.includes(value as AdvancedSearchTaskSort) ? (value as AdvancedSearchTaskSort) : "relevance";
}

function searchParamArray(searchParams: URLSearchParams, key: string): string[] {
  return searchParams
    .getAll(key)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseType(value: string | null): AdvancedSearchType {
  return value === "tasks" || value === "projects" || value === "users" ? value : "all";
}

function parseIndicatorMetric(value: string | null): AdvancedSearchIndicatorMetric | undefined {
  return value === "openTasks" ||
    value === "completedTasks" ||
    value === "overdueTasks" ||
    value === "dueTasks" ||
    value === "allTasks" ||
    value === "onTimeDeliveries" ||
    value === "lateDeliveries" ||
    value === "unclassifiedDeliveries"
    ? value
    : undefined;
}

function parseIndicatorPeriod(value: string | null): IndicatorPeriod | undefined {
  return value === "month" || value === "year" || value === "custom" || value === "all" ? value : undefined;
}

function parseDateOnly(value: string | null): string | undefined {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

function parseIndicatorScope(value: string | null): IndicatorScope | undefined {
  return value === "general" || value === "civil" || value === "electrical" ? value : undefined;
}
