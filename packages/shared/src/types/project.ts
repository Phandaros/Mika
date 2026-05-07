import { ProjectStatus } from "./enums.js";
import { Discipline } from "./discipline.js";
import { DisciplineType } from "./enums.js";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  client: string | null;
  platform: "CAD" | "BIM" | null;
  builder: string | null;
  areaM2: number | null;
  status: ProjectStatus;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  disciplines?: Discipline[];
}

export interface CreateProjectRequest {
  name: string;
  description?: string | null;
  client?: string | null;
  platform?: "CAD" | "BIM" | null;
  builder?: string | null;
  areaM2?: number | null;
  status?: ProjectStatus;
  startDate?: string | null;
  endDate?: string | null;
  disciplineTypes?: DisciplineType[];
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string | null;
  client?: string | null;
  platform?: "CAD" | "BIM" | null;
  builder?: string | null;
  areaM2?: number | null;
  status?: ProjectStatus;
  startDate?: string | null;
  endDate?: string | null;
  disciplineTypes?: DisciplineType[];
}
