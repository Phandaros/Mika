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
  creatorId: string;
  startDate: string | null;
  dueDate: string | null;
  /** Dias estimados de esforço (opcional); usado na vista Carga de trabalho. */
  estimatedDays?: number | null;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  customFieldValues?: Array<{
    id: string;
    customFieldName: string | null;
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
  assignee?: User | null;
  creator?: User;
  comments?: Comment[];
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
  status?: TaskStatus;
  priority?: Priority;
  assigneeId?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  estimatedDays?: number | null;
  completed?: boolean;
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
  completed?: boolean;
  customFieldValues?: Array<{
    id: string;
    value: string | number | null;
  }>;
}

export interface UpdateTaskStatusRequest {
  status: TaskStatus;
}

export interface UpdateTaskCompletionRequest {
  completed: boolean;
}
