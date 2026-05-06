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
}

export const DEFAULT_DISCIPLINES: readonly DefaultDiscipline[] = [
  { name: "Hidraulico", type: DisciplineType.HYDRAULIC },
  { name: "Sanitario", type: DisciplineType.SANITARY },
  { name: "PPCI", type: DisciplineType.FIRE_PROTECTION },
  { name: "Sprinkler", type: DisciplineType.SPRINKLER },
  { name: "Escada Pressurizada", type: DisciplineType.PRESSURIZED_STAIR },
  { name: "Eletrico", type: DisciplineType.ELECTRICAL },
  { name: "SPDA", type: DisciplineType.SPDA },
  { name: "Telecom", type: DisciplineType.TELECOM },
  { name: "Climatizacao", type: DisciplineType.HVAC },
  { name: "Gas", type: DisciplineType.GAS },
  { name: "Automacao", type: DisciplineType.AUTOMATION },
  { name: "Exaustao", type: DisciplineType.EXHAUST },
  { name: "Aspiracao Central", type: DisciplineType.VACUUM },
  { name: "Outro", type: DisciplineType.OTHER }
];

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
