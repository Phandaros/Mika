import { ProjectStatus } from "shared";

export const projectStatusLabels: Record<ProjectStatus, string> = {
  [ProjectStatus.ACTIVE]: "Ativo",
  [ProjectStatus.ON_HOLD]: "Em pausa",
  [ProjectStatus.COMPLETED]: "Concluído",
  [ProjectStatus.CANCELLED]: "Cancelado"
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
