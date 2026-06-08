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
  { name: "Civil", type: DisciplineType.OTHER, color: "#CBD5E1" },
  { name: "Elétrico", type: DisciplineType.ELECTRICAL, color: "#F59E0B" }
];

export const DEFAULT_DISCIPLINE_TYPES = DEFAULT_DISCIPLINES.map((discipline) => discipline.type);

export function getDefaultDiscipline(type: DisciplineType): DefaultDiscipline {
  const found = DEFAULT_DISCIPLINES.find((discipline) => discipline.type === type) ?? DEFAULT_DISCIPLINES[0];
  if (!found) {
    throw new Error("DEFAULT_DISCIPLINES must not be empty");
  }
  return found;
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

/** Secao Asana (API canonica); alias de Discipline para compat. */
export type Section = Discipline;
export type CreateSectionRequest = CreateDisciplineRequest;
export type UpdateSectionRequest = UpdateDisciplineRequest;
