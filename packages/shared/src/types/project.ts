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
  customFieldValues?: ProjectCustomFieldValue[];
  taskCustomFields?: ProjectCustomField[];
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
  mikaKey?: string | null;
  mikaLabel?: string | null;
  mikaSortOrder?: number | null;
  mikaTaskField?: boolean;
  mikaListVisible?: boolean;
  mikaDetailVisible?: boolean;
  enumOptions: Array<{
    id: string;
    asanaGid: string;
    name: string;
    color: string | null;
    enabled: boolean;
  }>;
}

export interface ProjectCustomFieldValue {
  id: string;
  customFieldId?: string | null;
  customFieldGid?: string | null;
  customFieldName: string | null;
  mikaKey?: string | null;
  mikaLabel?: string | null;
  mikaSortOrder?: number | null;
  mikaListVisible?: boolean;
  mikaDetailVisible?: boolean;
  type: string;
  displayValue: string | null;
  textValue?: string | null;
  numberValue: number | null;
  enumOptionName: string | null;
  enumOptionColor?: string | null;
  multiEnumValues?: Array<{
    gid: string | null;
    name: string;
    color: string | null;
  }>;
  enumOptions?: Array<{
    id: string;
    name: string;
    color: string | null;
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
