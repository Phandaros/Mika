import { DisciplineType, Priority, TaskStatus } from "./enums.js";
import { Comment } from "./comment.js";
import { User } from "./user.js";

export interface Task {
  id: string;
  asanaGid?: string;
  disciplineId: string;
  title: string;
  description: string | null;
  htmlDescription?: string | null;
  status: TaskStatus;
  priority: Priority;
  assigneeId: string | null;
  assigneeGid?: string | null;
  creatorId: string | null;
  workflowRootTaskId?: string | null;
  adjustmentNumber?: number;
  startDate: string | null;
  dueDate: string | null;
  /** Dias estimados de esforço (opcional); usado na vista Carga de trabalho. */
  estimatedDays?: number | null;
  platform?: string | null;
  taskDiscipline?: string | null;
  estimatedTime?: number | null;
  maxDeadline?: string | null;
  conclusionDays?: number | null;
  stage?: string | null;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  customFieldValues?: Array<{
    id: string;
    customFieldId?: string | null;
    customFieldGid?: string | null;
    customFieldName: string | null;
    mikaKey?: string | null;
    mikaLabel?: string | null;
    mikaSortOrder?: number | null;
    mikaListVisible?: boolean;
    mikaDetailVisible?: boolean;
    type?: string;
    displayValue: string | null;
    enumOptionName: string | null;
    numberValue: number | null;
    enumOptionColor?: string | null;
    enumOptions?: Array<{
      id: string;
      name: string;
      color: string | null;
    }>;
  }>;
  tags?: Array<{
    id: string;
    name: string;
    color: string | null;
  }>;
  pendingReview?: {
    id: string;
    reviewerId: string;
    reviewer?: User | null;
  } | null;
  assignee?: User | null;
  creator?: User;
  comments?: Comment[];
  projects?: Array<{
    id: string;
    asanaGid: string;
    name: string;
    sectionId?: string;
    sectionName?: string;
  }>;
  discipline?: {
    id: string;
    name: string;
    projectId: string;
    /** Nome do projeto (vistas de workload multi-projeto). */
    projectName?: string | null;
    type?: DisciplineType;
  };
}

export interface CreateTaskRequest {
  title: string;
  description?: string | null;
  projectId?: string | null;
  sectionId?: string | null;
  status?: TaskStatus;
  priority?: Priority;
  assigneeId?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  estimatedDays?: number | null;
  platform?: string | null;
  taskDiscipline?: string | null;
  estimatedTime?: number | null;
  maxDeadline?: string | null;
  conclusionDays?: number | null;
  stage?: string | null;
  customFieldValues?: Array<{
    settingId?: string;
    mikaKey?: string;
    value: string | number | null;
  }>;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: Priority;
  assigneeId?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  estimatedDays?: number | null;
  platform?: string | null;
  taskDiscipline?: string | null;
  estimatedTime?: number | null;
  maxDeadline?: string | null;
  conclusionDays?: number | null;
  stage?: string | null;
  projectIds?: string[];
  projectMemberships?: Array<{
    projectId: string;
    sectionId: string;
  }>;
  customFieldValues?: Array<{
    id?: string;
    mikaKey?: string;
    value: string | number | null;
  }>;
}

export interface UpdateTaskStatusRequest {
  status: TaskStatus;
}

export interface UpdateTaskCompletionRequest {
  completed: boolean;
}
