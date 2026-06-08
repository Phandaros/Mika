export const WORKLOAD_SCOPES = ["general", "civil", "electrical"] as const;
export type WorkloadScope = (typeof WORKLOAD_SCOPES)[number];

function normalizeForMatch(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Escopo por seção canônica do Mika. */
export function sectionMatchesWorkloadScope(sectionName: string | null | undefined, scope: WorkloadScope): boolean {
  if (scope === "general") {
    return true;
  }

  const normalized = normalizeForMatch(sectionName ?? "");
  return scope === "electrical" ? normalized === "eletrico" : normalized === "civil";
}

export function parseWorkloadScope(value: unknown): WorkloadScope {
  const str = typeof value === "string" ? value : "";
  if (str === "civil" || str === "electrical" || str === "general") {
    return str;
  }

  return "general";
}
