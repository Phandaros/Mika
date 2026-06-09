import { User } from "./user.js";

export type TaskActivityType = "CREATED" | "UPDATED" | "COMPLETED" | "REOPENED" | "COMMENTED";

export interface TaskActivity {
  id: string;
  taskId: string;
  actorId: string | null;
  type: TaskActivityType;
  field: string | null;
  fromValue: string | null;
  toValue: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  actor?: User | null;
}
