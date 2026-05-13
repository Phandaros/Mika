import { ProjectStatus } from "./enums.js";
import { Discipline } from "./discipline.js";
import { DisciplineType } from "./enums.js";

export interface Project {
  id: string;
  asanaGid?: string;
  name: string;
  description: string | null;
  htmlDescription?: string | null;
  client: string | null;
  platform: "CAD" | "BIM" | null;
  builder: string | null;
  areaM2: number | null;
  status: ProjectStatus;
  startDate: string | null;
  endDate: string | null;
  permalinkUrl?: string | null;
  color?: string | null;
  defaultView?: string | null;
  owner?: import("./user.js").User | null;
  customFields?: ProjectCustomField[];
  createdAt: string;
  updatedAt: string;
  disciplines?: Discipline[];
  /** Alias canonico (secao Asana); espelha `disciplines` quando presente. */
  sections?: Discipline[];
}

export interface ProjectCustomField {
  id: string;
  asanaGid: string;
  isImportant: boolean;
  name: string;
  description: string | null;
  type: string;
  enumOptions: Array<{
    id: string;
    asanaGid: string;
    name: string;
    color: string | null;
    enabled: boolean;
  }>;
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
