import { DisciplineType, type DisciplineType as DisciplineTypeValue } from "./enums.js";

export interface DisciplineCatalogItem {
  name: string;
  type: DisciplineTypeValue;
}

export const DISCIPLINE_CATALOG: readonly DisciplineCatalogItem[] = [
  { name: "Elétrico", type: DisciplineType.ELECTRICAL },
  { name: "Telecom", type: DisciplineType.TELECOM },
  { name: "Automação", type: DisciplineType.AUTOMATION },
  { name: "SPDA", type: DisciplineType.SPDA },
  { name: "Hidráulico", type: DisciplineType.HYDRAULIC },
  { name: "Sanitário", type: DisciplineType.SANITARY },
  { name: "Preventivo", type: DisciplineType.FIRE_PROTECTION },
  { name: "Gás", type: DisciplineType.GAS },
  { name: "Sprinkler", type: DisciplineType.SPRINKLER },
  { name: "Arquitetônico", type: DisciplineType.OTHER },
  { name: "Climatização", type: DisciplineType.HVAC }
];

export function getDisciplineCatalogItem(type: DisciplineTypeValue): DisciplineCatalogItem | undefined {
  return DISCIPLINE_CATALOG.find((discipline) => discipline.type === type);
}
