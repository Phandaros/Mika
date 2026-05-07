import { DisciplineStatus, DisciplineType } from "./enums.js";
import { Task } from "./task.js";
import { User } from "./user.js";

export interface Discipline {
  id: string;
  projectId: string;
  name: string;
  type: DisciplineType;
  status: DisciplineStatus;
  responsibleId: string | null;
  createdAt: string;
  updatedAt: string;
  responsible?: User | null;
  tasks?: Task[];
}

export interface DefaultDiscipline {
  name: string;
  type: DisciplineType;
  color: string;
}

export const DEFAULT_DISCIPLINES: readonly DefaultDiscipline[] = [
  { name: "Elétrico", type: DisciplineType.ELECTRICAL, color: "#F59E0B" },
  { name: "Telecom", type: DisciplineType.TELECOM, color: "#38BDF8" },
  { name: "Automação", type: DisciplineType.AUTOMATION, color: "#F472B6" },
  { name: "SPDA", type: DisciplineType.SPDA, color: "#A78BFA" },
  { name: "Hidráulico", type: DisciplineType.HYDRAULIC, color: "#22C55E" },
  { name: "Sanitário", type: DisciplineType.SANITARY, color: "#2DD4BF" },
  { name: "Preventivo", type: DisciplineType.FIRE_PROTECTION, color: "#FB7185" },
  { name: "Gás", type: DisciplineType.GAS, color: "#FB923C" },
  { name: "Sprinkler", type: DisciplineType.SPRINKLER, color: "#60A5FA" },
  { name: "Arquitetônico", type: DisciplineType.OTHER, color: "#CBD5E1" },
  { name: "Climatização", type: DisciplineType.HVAC, color: "#67E8F9" }
];

export const DEFAULT_DISCIPLINE_TYPES = DEFAULT_DISCIPLINES.map((discipline) => discipline.type);

export function getDefaultDiscipline(type: DisciplineType): DefaultDiscipline {
  return DEFAULT_DISCIPLINES.find((discipline) => discipline.type === type) ?? DEFAULT_DISCIPLINES[0];
}

export interface CreateDisciplineRequest {
  name: string;
  type: DisciplineType;
  status?: DisciplineStatus;
  responsibleId?: string | null;
}

export interface UpdateDisciplineRequest {
  name?: string;
  type?: DisciplineType;
  status?: DisciplineStatus;
  responsibleId?: string | null;
}
