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

/** Heurística por nome de seção (import Asana / disciplinas MK). */
export function sectionMatchesWorkloadScope(sectionName: string | null | undefined, scope: WorkloadScope): boolean {
  if (scope === "general") {
    return true;
  }

  const n = normalizeForMatch(sectionName ?? "");
  if (!n) {
    return false;
  }

  const electrical = /(eletric|spda|telecom|automac|ilumin|subest|cabine|forca|energia|lumin)/.test(n);
  const civil = /(hidrau|sanit|ppc|sprinkler|pressuriz|g[aá]s|climat|exaust|vacuo|civil|incendi|hvac|bim|estrutur|hidraulic|drenagem|drenag)/.test(
    n
  );

  if (scope === "electrical") {
    return electrical;
  }

  if (scope === "civil") {
    return civil && !electrical;
  }

  return false;
}

export function parseWorkloadScope(value: unknown): WorkloadScope {
  const str = typeof value === "string" ? value : "";
  if (str === "civil" || str === "electrical" || str === "general") {
    return str;
  }

  return "general";
}
