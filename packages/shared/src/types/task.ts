import { DisciplineType, Priority, TaskStatus } from "./enums.js";
import { Comment } from "./comment.js";
import { User } from "./user.js";

export interface Task {
  id: string;
  disciplineId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  assigneeId: string | null;
  creatorId: string;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignee?: User | null;
  creator?: User;
  comments?: Comment[];
  discipline?: {
    id: string;
    name: string;
    projectId: string;
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
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: Priority;
  assigneeId?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
}

export interface UpdateTaskStatusRequest {
  status: TaskStatus;
}
