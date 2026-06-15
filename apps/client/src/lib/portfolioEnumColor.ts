import { tokenColorValue } from "../components/shared/Chip";
import { Priority, TaskStatus } from "shared";
import { priorityColors, taskStatusColors } from "../components/shared/statusVisuals";
import { resolveAsanaColor } from "./utils";
import { normalizeProjectFieldName } from "./portfolioFieldLabels";

function tokenPair(bg: string, text: string): string {
  return tokenColorValue(bg, text);
}

const disciplineColorByName: Record<string, string> = {
  eletrico: tokenPair("--disc-ele-bg", "--disc-ele-text"),
  telecom: tokenPair("--disc-tel-bg", "--disc-tel-text"),
  spda: tokenPair("--disc-spda-bg", "--disc-spda-text"),
  hidraulico: tokenPair("--disc-hid-bg", "--disc-hid-text"),
  sanitario: tokenPair("--disc-san-bg", "--disc-san-text"),
  arquitetonico: tokenPair("--disc-arch-bg", "--disc-arch-text"),
  automacao: tokenPair("--disc-auto-bg", "--disc-auto-text"),
  preventivo: tokenPair("--disc-ppci-bg", "--disc-ppci-text"),
  gas: tokenPair("--disc-gas-bg", "--disc-gas-text"),
  sprinkler: tokenPair("--disc-sprinkler-bg", "--disc-sprinkler-text"),
  climatizacao: tokenPair("--disc-hvac-bg", "--disc-hvac-text"),
  compatibilizacao: tokenPair("--disc-coord-bg", "--disc-coord-text"),
  drenagem: tokenPair("--disc-drain-bg", "--disc-drain-text"),
  exaustao: tokenPair("--disc-exhaust-bg", "--disc-exhaust-text"),
  "aspiracao central": tokenPair("--disc-vacuum-bg", "--disc-vacuum-text"),
  "escada pressurizada": tokenPair("--disc-stair-bg", "--disc-stair-text")
};

const financeParcelColors = [
  tokenPair("--status-scheduled-bg", "--status-scheduled-text"),
  tokenPair("--status-inprogress-bg", "--status-inprogress-text"),
  tokenPair("--status-analysis-bg", "--status-analysis-text"),
  tokenPair("--status-review-bg", "--status-review-text"),
  tokenPair("--status-waiting-bg", "--status-waiting-text"),
  tokenPair("--status-done-bg", "--status-done-text"),
  tokenPair("--status-done-bg", "--status-done-text")
];

function normalizeOptionName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function approvalStatusColor(optionName: string): string | null {
  const normalized = normalizeOptionName(optionName);

  if (["aprovado", "completo"].includes(normalized)) {
    return taskStatusColors[TaskStatus.FINISHED];
  }

  if (["em analise", "parcial"].includes(normalized)) {
    return taskStatusColors[TaskStatus.AWAITING_REVIEW];
  }

  if (normalized === "em andamento") {
    return taskStatusColors[TaskStatus.IN_PROGRESS];
  }

  if (normalized === "reaprovar") {
    return taskStatusColors[TaskStatus.AWAITING_REVIEW];
  }

  if (normalized === "indeferido") {
    return taskStatusColors[TaskStatus.OVERDUE];
  }

  if (["to do", "n/a", "na"].includes(normalized)) {
    return taskStatusColors[TaskStatus.TODO];
  }

  return null;
}

function priorityColor(optionName: string): string | null {
  const normalized = normalizeOptionName(optionName);

  if (normalized === "high") {
    return priorityColors[Priority.HIGH];
  }

  if (normalized === "medium") {
    return priorityColors[Priority.MEDIUM];
  }

  if (normalized === "low") {
    return priorityColors[Priority.LOW];
  }

  if (normalized === "urgent") {
    return priorityColors[Priority.URGENT];
  }

  return null;
}

function financeColor(optionName: string): string | null {
  const match = optionName.match(/^(\d+)\s/);
  if (!match) {
    return null;
  }

  const index = Number(match[1]) - 1;
  return financeParcelColors[index] ?? financeParcelColors[financeParcelColors.length - 1] ?? null;
}

function disciplineColor(optionName: string): string | null {
  return disciplineColorByName[normalizeOptionName(optionName)] ?? null;
}

function fieldContext(fieldLabel: string): string {
  return normalizeProjectFieldName(fieldLabel);
}

function isApprovalContext(context: string): boolean {
  return context.includes("ppci") || context.includes("aprov") || context.includes("exec");
}

function asanaFallbackColor(asanaColor?: string | null): string | null {
  if (!asanaColor) {
    return null;
  }

  const tokens = resolveAsanaColor(asanaColor);
  return tokenColorValue(tokens.bg, tokens.text);
}

export function portfolioEnumColor(fieldLabel: string, optionName: string, asanaColor?: string | null): string {
  const context = fieldContext(fieldLabel);
  const noneColor = tokenPair("--disc-none-bg", "--disc-none-text");

  if (context.includes("financeiro")) {
    return financeColor(optionName) ?? asanaFallbackColor(asanaColor) ?? noneColor;
  }

  if (context.includes("numero de projetos")) {
    return disciplineColor(optionName) ?? asanaFallbackColor(asanaColor) ?? noneColor;
  }

  if (context === "priority") {
    return priorityColor(optionName) ?? asanaFallbackColor(asanaColor) ?? noneColor;
  }

  if (isApprovalContext(context)) {
    return approvalStatusColor(optionName) ?? asanaFallbackColor(asanaColor) ?? noneColor;
  }

  return (
    approvalStatusColor(optionName) ??
    disciplineColor(optionName) ??
    priorityColor(optionName) ??
    asanaFallbackColor(asanaColor) ??
    noneColor
  );
}

export function portfolioFieldLabel(field: { customFieldName?: string | null; mikaLabel?: string | null } | undefined): string {
  return field?.mikaLabel ?? field?.customFieldName ?? "";
}
