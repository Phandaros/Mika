import type { Task } from "./task.js";
import type { User } from "./user.js";

export interface TeamBoardTaskMetrics {
  elapsedBusinessDays: number | null;
  isOverdue: boolean;
  isOverEstimated: boolean;
  daysUntilDue: number | null;
}

export interface TeamBoardTaskDto extends Task {
  commentCount: number;
  metrics: TeamBoardTaskMetrics;
}

export interface TeamBoardColumnSummary {
  activeCount: number;
  overdueCount: number;
  awaitingReviewCount: number;
  totalEstimatedDays: number;
}

export interface TeamBoardColumnDto {
  user: User;
  summary: TeamBoardColumnSummary;
  tasks: TeamBoardTaskDto[];
}

export interface TeamBoardTotals {
  activeTasks: number;
  overdueTasks: number;
  designersWithTasks: number;
}

export interface TeamBoardResponse {
  columns: TeamBoardColumnDto[];
  totals: TeamBoardTotals;
}
