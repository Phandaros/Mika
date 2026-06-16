export type PortfolioFieldType = "enum" | "multi_enum";

export interface PortfolioCatalogOption {
  name: string;
  color: string | null;
}

export interface PortfolioCatalogField {
  key: string;
  label: string;
  type: PortfolioFieldType;
  sortOrder: number;
  enumOptions: PortfolioCatalogOption[];
  /** Legacy labels / mikaKeys used in imported Asana data for reconciliation. */
  legacyLabels: string[];
  legacyMikaKeys: string[];
}

export const PORTFOLIO_CATALOG_GID_PREFIX = "mika:portfolio:";

export const PORTFOLIO_DERIVED_LABELS = {
  disciplineCount: "Número de Disciplinas (n)",
  projectedArea: "Área projetada"
} as const;

const APPROVAL_ENUM_OPTIONS: PortfolioCatalogOption[] = [
  { name: "Aprovado", color: "green" },
  { name: "Em análise", color: "yellow" },
  { name: "Indeferido", color: "red" },
  { name: "N/A", color: "cool-gray" },
  { name: "To Do", color: "cool-gray" }
];

const EXECUTION_ENUM_OPTIONS: PortfolioCatalogOption[] = [
  { name: "Completo", color: "green" },
  { name: "Parcial", color: "yellow" },
  { name: "N/A", color: "cool-gray" },
  { name: "To Do", color: "cool-gray" }
];

export const PORTFOLIO_CATALOG: PortfolioCatalogField[] = [
  {
    key: "financeiro",
    label: "Financeiro",
    type: "multi_enum",
    sortOrder: 0,
    legacyLabels: ["Financeiro.", "Financeiro"],
    legacyMikaKeys: ["financeiro.", "financeiro"],
    enumOptions: [
      { name: "1 Parcela - Kick", color: null },
      { name: "2 Parcela - Estudo Preliminar + ART ", color: null },
      { name: "3 Parcela - Anteprojeto", color: null },
      { name: "4 Parcela - Projeto Legal", color: null },
      { name: "5 Parcela - Pré Executivo", color: null },
      { name: "6 Parcela - Projeto Executivo", color: null },
      { name: "7 Parcela - Liberado Obra", color: null }
    ]
  },
  {
    key: "disciplinas",
    label: "Disciplinas",
    type: "multi_enum",
    sortOrder: 1,
    legacyLabels: ["Número de Projetos", "Numero de Projetos"],
    legacyMikaKeys: ["numero-de-projetos"],
    enumOptions: [
      { name: "Elétrico", color: null },
      { name: "Telecom", color: null },
      { name: "SPDA", color: null },
      { name: "Hidráulico", color: null },
      { name: "Sanitário", color: null },
      { name: "Preventivo", color: null },
      { name: "Arquitetônico", color: null },
      { name: "Automação", color: null },
      { name: "Sprinkler", color: null },
      { name: "Gás", color: null },
      { name: "Climatização", color: null },
      { name: "Compatibilização", color: null },
      { name: "Drenagem", color: null },
      { name: "Exaustão", color: null },
      { name: "Aspiração Central", color: null },
      { name: "Escada Pressurizada", color: "hot-pink" }
    ]
  },
  {
    key: "ppciGas",
    label: "PPCI / GÁS",
    type: "enum",
    sortOrder: 2,
    legacyLabels: ["PPCI / GÁS", "PPCI / GAS"],
    legacyMikaKeys: ["ppci-/-gas"],
    enumOptions: APPROVAL_ENUM_OPTIONS
  },
  {
    key: "eleAprov",
    label: "ELE APROV.",
    type: "enum",
    sortOrder: 3,
    legacyLabels: ["ELE APROV.", "ELE  APROV."],
    legacyMikaKeys: ["ele-aprov."],
    enumOptions: APPROVAL_ENUM_OPTIONS
  },
  {
    key: "hidAprov",
    label: "HID APROV.",
    type: "enum",
    sortOrder: 4,
    legacyLabels: ["HID APROV."],
    legacyMikaKeys: ["hid-aprov."],
    enumOptions: APPROVAL_ENUM_OPTIONS
  },
  {
    key: "eleExec",
    label: "ELE EXEC.",
    type: "enum",
    sortOrder: 5,
    legacyLabels: ["ELE EXEC."],
    legacyMikaKeys: ["ele-exec."],
    enumOptions: EXECUTION_ENUM_OPTIONS
  },
  {
    key: "hidExec",
    label: "HID EXEC.",
    type: "enum",
    sortOrder: 6,
    legacyLabels: ["HID EXEC."],
    legacyMikaKeys: ["hid-exec."],
    enumOptions: EXECUTION_ENUM_OPTIONS
  }
];

export function portfolioCatalogGid(key: string): string {
  return `${PORTFOLIO_CATALOG_GID_PREFIX}${key}`;
}

export function isPortfolioCatalogGid(gid: string | null | undefined): boolean {
  return Boolean(gid?.startsWith(PORTFOLIO_CATALOG_GID_PREFIX));
}

export function portfolioCatalogKeyFromGid(gid: string | null | undefined): string | null {
  if (!gid?.startsWith(PORTFOLIO_CATALOG_GID_PREFIX)) {
    return null;
  }

  return gid.slice(PORTFOLIO_CATALOG_GID_PREFIX.length) || null;
}

export function normalizePortfolioFieldName(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function findPortfolioCatalogField(input: {
  mikaKey?: string | null;
  customFieldGid?: string | null;
  label?: string | null;
}): PortfolioCatalogField | undefined {
  const keyFromGid = portfolioCatalogKeyFromGid(input.customFieldGid);
  if (keyFromGid) {
    return PORTFOLIO_CATALOG.find((field) => field.key === keyFromGid);
  }

  if (input.mikaKey) {
    const byKey = PORTFOLIO_CATALOG.find((field) => field.key === input.mikaKey);
    if (byKey) {
      return byKey;
    }

    const byLegacyKey = PORTFOLIO_CATALOG.find((field) => field.legacyMikaKeys.includes(input.mikaKey!));
    if (byLegacyKey) {
      return byLegacyKey;
    }
  }

  if (input.label) {
    const normalized = normalizePortfolioFieldName(input.label);
    return PORTFOLIO_CATALOG.find((field) => {
      if (normalizePortfolioFieldName(field.label) === normalized) {
        return true;
      }

      return field.legacyLabels.some((legacy) => normalizePortfolioFieldName(legacy) === normalized);
    });
  }

  return undefined;
}

export function isDisciplinasCatalogField(field: PortfolioCatalogField): boolean {
  return field.key === "disciplinas";
}

export function isDerivedPortfolioLabel(label: string | null | undefined): boolean {
  const normalized = normalizePortfolioFieldName(label);
  return (
    normalized === normalizePortfolioFieldName(PORTFOLIO_DERIVED_LABELS.disciplineCount) ||
    normalized === normalizePortfolioFieldName(PORTFOLIO_DERIVED_LABELS.projectedArea)
  );
}

export function disciplineCountFromMultiEnum(multiEnumValues: unknown): number {
  if (!Array.isArray(multiEnumValues)) {
    return 0;
  }

  return multiEnumValues.filter((entry) => {
    return Boolean(entry && typeof entry === "object" && "name" in entry && typeof entry.name === "string" && entry.name.trim());
  }).length;
}

export function computeDerivedPortfolioFields(
  areaM2: number | null | undefined,
  disciplineCount: number
): { disciplineCount: number; projectedArea: number | null } {
  const count = Math.max(0, disciplineCount);
  const projectedArea = areaM2 == null ? null : areaM2 * count;
  return { disciplineCount: count, projectedArea };
}
