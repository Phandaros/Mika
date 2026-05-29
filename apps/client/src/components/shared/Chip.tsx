import type { HTMLAttributes, ReactNode } from "react";
import { Priority, TaskStatus } from "shared";
import { cn } from "../../lib/utils";

const chipClassName = "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium tracking-wide whitespace-nowrap";

type TokenStyle = {
  backgroundColor: string;
  color: string;
};

interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  bg: string;
  text: string;
  children: ReactNode;
}

export const taskStatusLabels: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: "A fazer",
  [TaskStatus.ON_SCHEDULE]: "No Cronograma",
  [TaskStatus.OVERDUE]: "Atrasado",
  [TaskStatus.IN_PROGRESS]: "Em andamento",
  [TaskStatus.AWAITING_REVIEW]: "Aguardando Revisão",
  [TaskStatus.IN_ANALYSIS]: "Em Análise",
  [TaskStatus.AWAITING_DEFINITION]: "Aguardando Definição",
  [TaskStatus.FINISHED]: "Finalizado"
};

export const taskStatusTokens: Record<TaskStatus, { bg: string; text: string }> = {
  [TaskStatus.TODO]: { bg: "--status-todo-bg", text: "--status-todo-text" },
  [TaskStatus.ON_SCHEDULE]: { bg: "--status-scheduled-bg", text: "--status-scheduled-text" },
  [TaskStatus.OVERDUE]: { bg: "--status-late-bg", text: "--status-late-text" },
  [TaskStatus.IN_PROGRESS]: { bg: "--status-inprogress-bg", text: "--status-inprogress-text" },
  [TaskStatus.AWAITING_REVIEW]: { bg: "--status-review-bg", text: "--status-review-text" },
  [TaskStatus.IN_ANALYSIS]: { bg: "--status-analysis-bg", text: "--status-analysis-text" },
  [TaskStatus.AWAITING_DEFINITION]: { bg: "--status-waiting-bg", text: "--status-waiting-text" },
  [TaskStatus.FINISHED]: { bg: "--status-done-bg", text: "--status-done-text" }
};

export const writableTaskStatuses: TaskStatus[] = [
  TaskStatus.TODO,
  TaskStatus.ON_SCHEDULE,
  TaskStatus.IN_PROGRESS,
  TaskStatus.AWAITING_REVIEW,
  TaskStatus.IN_ANALYSIS,
  TaskStatus.AWAITING_DEFINITION,
  TaskStatus.FINISHED
];

export const priorityLabels: Record<Priority, string> = {
  [Priority.LOW]: "Baixa",
  [Priority.MEDIUM]: "Média",
  [Priority.HIGH]: "Alta",
  [Priority.URGENT]: "Urgente"
};

export const priorityTokens: Record<Priority, { bg: string; text: string }> = {
  [Priority.LOW]: { bg: "--priority-low-bg", text: "--priority-low-text" },
  [Priority.MEDIUM]: { bg: "--priority-medium-bg", text: "--priority-medium-text" },
  [Priority.HIGH]: { bg: "--priority-high-bg", text: "--priority-high-text" },
  [Priority.URGENT]: { bg: "--priority-urgent-bg", text: "--priority-urgent-text" }
};

const platformLabels: Record<string, string> = {
  CAD: "CAD",
  REVIT: "REVIT",
  COORD: "COORD"
};

const platformTokens: Record<string, { bg: string; text: string }> = {
  CAD: { bg: "--plat-cad-bg", text: "--plat-cad-text" },
  REVIT: { bg: "--plat-revit-bg", text: "--plat-revit-text" },
  COORD: { bg: "--plat-coord-bg", text: "--plat-coord-text" }
};

const disciplineLabels: Record<string, string> = {
  ELE: "ELE",
  SPDA: "SPDA",
  TEL: "TEL",
  HID: "HID",
  PPCI: "PPCI",
  HVAC: "HVAC",
  COORD: "COORD",
  EP: "EP"
};

const disciplineTokens: Record<string, { bg: string; text: string }> = {
  ELE: { bg: "--disc-ele-bg", text: "--disc-ele-text" },
  SPDA: { bg: "--disc-spda-bg", text: "--disc-spda-text" },
  TEL: { bg: "--disc-tel-bg", text: "--disc-tel-text" },
  HID: { bg: "--disc-hid-bg", text: "--disc-hid-text" },
  PPCI: { bg: "--disc-ppci-bg", text: "--disc-ppci-text" },
  HVAC: { bg: "--disc-hvac-bg", text: "--disc-hvac-text" },
  COORD: { bg: "--disc-coord-bg", text: "--disc-coord-text" },
  EP: { bg: "--disc-ep-bg", text: "--disc-ep-text" }
};

export function tokenStyle(bg: string, text: string): TokenStyle {
  return {
    backgroundColor: `var(${bg})`,
    color: `var(${text})`
  };
}

export function Chip({ bg, text, className, style, children, ...props }: ChipProps) {
  return (
    <span className={cn(chipClassName, className)} style={{ ...tokenStyle(bg, text), ...style }} {...props}>
      {children}
    </span>
  );
}

export function DisciplineChip({ discipline, fallback = "—" }: { discipline?: string | null; fallback?: string }) {
  const key = normalizeDiscipline(discipline);
  const tokens = disciplineTokens[key] ?? { bg: "--disc-none-bg", text: "--disc-none-text" };
  const label = discipline ? disciplineLabels[key] ?? discipline : fallback;

  return (
    <Chip bg={tokens.bg} text={tokens.text}>
      {label}
    </Chip>
  );
}

export function PlatformChip({ platform, fallback = "—" }: { platform?: string | null; fallback?: string }) {
  const key = normalizeEnumKey(platform);
  const tokens = platformTokens[key] ?? { bg: "--plat-none-bg", text: "--plat-none-text" };
  const label = platform ? platformLabels[key] ?? platform : fallback;

  return (
    <Chip bg={tokens.bg} text={tokens.text}>
      {label}
    </Chip>
  );
}

export function CompletionStatusChip({ completed }: { completed: boolean }) {
  return completed ? (
    <Chip bg="--status-done-bg" text="--status-done-text">Concluída</Chip>
  ) : (
    <Chip bg="--status-todo-bg" text="--status-todo-text">Aberta</Chip>
  );
}

export function tokenColorValue(bg: string, text: string): string {
  return `token:${bg}:${text}`;
}

export function parseTokenColor(value: string): { bg: string; text: string } | null {
  const match = /^token:(--[a-z0-9-]+):(--[a-z0-9-]+)$/.exec(value);
  return match ? { bg: match[1] ?? "--disc-none-bg", text: match[2] ?? "--disc-none-text" } : null;
}

function normalizeEnumKey(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_")
    .toUpperCase()
    .trim();
}

function normalizeDiscipline(value: string | null | undefined): string {
  const normalized = normalizeEnumKey(value);

  if (normalized.includes("ELE")) {
    return "ELE";
  }

  if (normalized.includes("SPDA")) {
    return "SPDA";
  }

  if (normalized.includes("TEL")) {
    return "TEL";
  }

  if (normalized.includes("HID")) {
    return "HID";
  }

  if (normalized.includes("PPCI") || normalized.includes("PREVENTIVO") || normalized.includes("INCENDIO")) {
    return "PPCI";
  }

  if (normalized.includes("HVAC")) {
    return "HVAC";
  }

  if (normalized.includes("COORD")) {
    return "COORD";
  }

  if (normalized === "EP" || normalized.includes("ESTUDO_PRELIMINAR")) {
    return "EP";
  }

  return normalized;
}
