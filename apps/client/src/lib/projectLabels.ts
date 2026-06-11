import { ProjectStatus } from "shared";

export const projectStatusLabels: Record<ProjectStatus, string> = {
  [ProjectStatus.ACTIVE]: "Ativo",
  [ProjectStatus.ON_HOLD]: "Em pausa",
  [ProjectStatus.COMPLETED]: "Concluído",
  [ProjectStatus.CANCELLED]: "Cancelado"
};

export const projectStatusTokens: Record<ProjectStatus, { bg: string; text: string }> = {
  [ProjectStatus.ACTIVE]: { bg: "--status-done-bg", text: "--status-done-text" },
  [ProjectStatus.ON_HOLD]: { bg: "--status-waiting-bg", text: "--status-waiting-text" },
  [ProjectStatus.COMPLETED]: { bg: "--status-scheduled-bg", text: "--status-scheduled-text" },
  [ProjectStatus.CANCELLED]: { bg: "--status-late-bg", text: "--status-late-text" }
};

export const projectPlatformTokens: Record<string, { bg: string; text: string }> = {
  CAD: { bg: "--plat-cad-bg", text: "--plat-cad-text" },
  BIM: { bg: "--plat-revit-bg", text: "--plat-revit-text" }
};

export function formatProjectArea(areaM2: number | null | undefined): string {
  if (areaM2 == null) {
    return "—";
  }

  return `${areaM2.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} m²`;
}
