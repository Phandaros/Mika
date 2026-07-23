export const TASK_DISCIPLINE_ORDER = [
  "ELE",
  "SPDA",
  "TEL",
  "HID",
  "SAN",
  "PPCI",
  "SPK",
  "AUT",
  "GÁS",
  "CLI",
  "FUR",
  "COORD",
  "EP",
  "Revisão"
] as const;

export type TaskDiscipline = (typeof TASK_DISCIPLINE_ORDER)[number];

const inferenceAliases: ReadonlyArray<readonly [TaskDiscipline, readonly string[]]> = [
  ["ELE", ["ELE", "ELETRICO", "ELETRICA"]],
  ["SPDA", ["SPDA"]],
  ["TEL", ["TEL", "TELECOM", "TELECOMUNICACOES"]],
  ["HID", ["HID", "HIDRAULICO", "HIDRAULICA"]],
  ["SAN", ["SAN", "SANITARIO", "SANITARIA"]],
  ["PPCI", ["PPCI", "PCI", "PREVENTIVO"]],
  ["SPK", ["SPK", "SPRINKLER"]],
  ["AUT", ["AUT", "AUTOMACAO"]],
  ["GÁS", ["GAS"]],
  ["CLI", ["CLI", "HVAC", "CLIMATIZACAO", "CLIMA"]],
  ["FUR", ["FUR", "FURACOES"]],
  ["COORD", ["COORD", "COORDENACAO"]],
  ["EP", ["EP", "ESTUDO PRELIMINAR"]]
];

const exactAliases = new Map<string, TaskDiscipline>([
  ...inferenceAliases.flatMap(([discipline, aliases]) => aliases.map((alias) => [alias, discipline] as const)),
  ["REVISAO", "Revisão"]
]);

function normalizeForMatch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function beginsWithAlias(value: string, alias: string): boolean {
  if (!value.startsWith(alias)) {
    return false;
  }

  const nextCharacter = value.at(alias.length);
  return nextCharacter === undefined || /[\s\-:/]/.test(nextCharacter);
}

function stripLeadingProjectMarkers(value: string): string {
  let remaining = value;
  const markerPattern = /^\s*\[[^\]]+\]\s*(?:[-:]\s*)?/;
  let marker = markerPattern.exec(remaining);

  while (marker) {
    remaining = remaining.slice(marker[0].length);
    marker = markerPattern.exec(remaining);
  }

  return remaining.trim();
}

export function normalizeTaskDiscipline(value: string): string;
export function normalizeTaskDiscipline(value: null): null;
export function normalizeTaskDiscipline(value: undefined): undefined;
export function normalizeTaskDiscipline(value: string | null | undefined): string | null | undefined;
export function normalizeTaskDiscipline(value: string | null | undefined): string | null | undefined {
  if (value == null) {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return exactAliases.get(normalizeForMatch(trimmed)) ?? trimmed;
}

export function inferTaskDiscipline(title: string): TaskDiscipline | null {
  const normalizedTitle = normalizeForMatch(title);
  if (!normalizedTitle) {
    return null;
  }

  if (/^\{\s*R\s*\}(?:\s*[-:]\s*)?/.test(normalizedTitle)) {
    return "Revisão";
  }

  const candidate = stripLeadingProjectMarkers(normalizedTitle);
  for (const [discipline, aliases] of inferenceAliases) {
    if (aliases.some((alias) => beginsWithAlias(candidate, alias))) {
      return discipline;
    }
  }

  return null;
}

export function taskDisciplineForCreate(title: string, requested: string | null | undefined): string | null {
  const normalizedRequested = normalizeTaskDiscipline(requested);
  return normalizedRequested || inferTaskDiscipline(title);
}
