import type { Task } from "./task.js";
import type { TaskStatus } from "./enums.js";

export type MyTasksCompletionFilter = "open" | "completed" | "all";

export interface MyTasksQuery {
  completion?: MyTasksCompletionFilter;
  status?: TaskStatus[];
  search?: string;
  userId?: string;
}

export interface MyTasksResponse {
  tasks: Task[];
}
