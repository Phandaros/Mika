import type { Task } from "shared";

export const taskDisciplineOrder = [
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

export const taskDisciplineOptions: Array<{ value: string; label: string }> = taskDisciplineOrder.map((discipline) => ({
  value: discipline,
  label: discipline
}));

const disciplineIndex = new Map<string, number>(taskDisciplineOrder.map((discipline, index) => [discipline, index]));
const exactAliases = new Map<string, string>([
  ["ELE", "ELE"],
  ["ELETRICO", "ELE"],
  ["ELETRICA", "ELE"],
  ["SPDA", "SPDA"],
  ["TEL", "TEL"],
  ["TELECOM", "TEL"],
  ["TELECOMUNICACOES", "TEL"],
  ["HID", "HID"],
  ["HIDRAULICO", "HID"],
  ["HIDRAULICA", "HID"],
  ["SAN", "SAN"],
  ["SANITARIO", "SAN"],
  ["SANITARIA", "SAN"],
  ["PPCI", "PPCI"],
  ["PCI", "PPCI"],
  ["PREVENTIVO", "PPCI"],
  ["SPK", "SPK"],
  ["SPRINKLER", "SPK"],
  ["AUT", "AUT"],
  ["AUTOMACAO", "AUT"],
  ["GAS", "GÁS"],
  ["CLI", "CLI"],
  ["HVAC", "CLI"],
  ["CLIMATIZACAO", "CLI"],
  ["CLIMA", "CLI"],
  ["FUR", "FUR"],
  ["FURACOES", "FUR"],
  ["COORD", "COORD"],
  ["COORDENACAO", "COORD"],
  ["EP", "EP"],
  ["ESTUDO PRELIMINAR", "EP"],
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

export function normalizeTaskDiscipline(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return exactAliases.get(normalizeForMatch(trimmed)) ?? trimmed;
}

type SortableTask = Pick<Task, "id" | "taskDiscipline" | "createdAt">;

function disciplineSortKey(value: string | null | undefined): { category: number; index: number; label: string } {
  const normalized = normalizeTaskDiscipline(value);
  if (!normalized) {
    return { category: 2, index: Number.MAX_SAFE_INTEGER, label: "" };
  }

  const index = disciplineIndex.get(normalized);
  if (index !== undefined) {
    return { category: 0, index, label: normalized };
  }

  return { category: 1, index: Number.MAX_SAFE_INTEGER, label: normalized };
}

function createdAtTimestamp(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp;
}

export function compareTasksByDisciplineAndCreation(left: SortableTask, right: SortableTask): number {
  const leftKey = disciplineSortKey(left.taskDiscipline);
  const rightKey = disciplineSortKey(right.taskDiscipline);

  const categoryDifference = leftKey.category - rightKey.category;
  if (categoryDifference !== 0) {
    return categoryDifference;
  }

  const disciplineDifference =
    leftKey.category === 0
      ? leftKey.index - rightKey.index
      : leftKey.label.localeCompare(rightKey.label, "pt-BR", { sensitivity: "base" });
  if (disciplineDifference !== 0) {
    return disciplineDifference;
  }

  const creationDifference = createdAtTimestamp(left.createdAt) - createdAtTimestamp(right.createdAt);
  return creationDifference || left.id.localeCompare(right.id);
}
