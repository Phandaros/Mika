export const PORTFOLIO_FIELD_LABELS = {
  disciplinas: "Disciplinas",
  disciplineCount: "Número de Disciplinas (n)",
  projectedArea: "Área projetada"
} as const;

export const PORTFOLIO_FIELD_KEYS = {
  financeiro: "financeiro",
  disciplinas: "disciplinas",
  ppciGas: "ppciGas",
  eleAprov: "eleAprov",
  hidAprov: "hidAprov",
  eleExec: "eleExec",
  hidExec: "hidExec",
  disciplineCount: "disciplineCount",
  projectedArea: "projectedArea"
} as const;

export function normalizeProjectFieldName(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function disciplineCountFromMultiEnum(
  multiEnumValues: Array<{ name: string }> | null | undefined
): number {
  return multiEnumValues?.filter((entry) => entry.name.trim()).length ?? 0;
}

export function computeDerivedPortfolioFields(
  areaM2: number | null | undefined,
  disciplineCount: number
): { disciplineCount: number; projectedArea: number | null } {
  const count = Math.max(0, disciplineCount);
  const projectedArea = areaM2 == null ? null : areaM2 * count;
  return { disciplineCount: count, projectedArea };
}
