import { ProjectStatus } from "./enums.js";
import { Discipline } from "./discipline.js";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  client: string | null;
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
  status?: ProjectStatus;
  startDate?: string | null;
  endDate?: string | null;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string | null;
  client?: string | null;
  status?: ProjectStatus;
  startDate?: string | null;
  endDate?: string | null;
}
