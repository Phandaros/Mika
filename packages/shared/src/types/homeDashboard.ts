import { Priority, TaskStatus } from "./enums.js";
import { WeeklyReportStatus } from "./weeklyReport.js";

export interface HomeDashboardStats {
  assignedOpen: number;
  overdue: number;
  dueToday: number;
  completedThisWeek: number;
}

export interface HomeDashboardTask {
  id: string;
  sectionId: string;
  projectId: string | null;
  title: string;
  status: TaskStatus;
  priority: Priority;
  dueDate: string | null;
  projectName: string | null;
  sectionName: string | null;
}

export interface HomeDashboardActivity {
  id: string;
  type: "comment" | "task";
  at: string;
  title: string;
  subtitle: string;
  taskId: string | null;
}

export interface HomeDashboardProject {
  id: string;
  name: string;
  client: string | null;
  openTasks: number;
  overdueTasks: number;
  awaitingReviewTasks: number;
  progress: number;
}

export interface HomeDashboardReview {
  id: string;
  title: string;
  dueDate: string | null;
  projectName: string | null;
  requestedByName: string | null;
}

export interface HomeDashboardReviewSummary {
  totalPendingMine: number;
  items: HomeDashboardReview[];
}

export interface HomeDashboardMyWeeklyReport {
  id: string;
  status: WeeklyReportStatus;
  itemCount: number;
  weekStart: string;
  weekEnd: string;
}

export interface HomeDashboardWeeklyReportsSummary {
  expected: number;
  submitted: number;
  late: number;
  pending: number;
  submissionRate: number;
}

export interface HomeDashboardResponse {
  stats: HomeDashboardStats;
  myTasks: HomeDashboardTask[];
  recentActivity: HomeDashboardActivity[];
  activeProjects: HomeDashboardProject[];
  myReviews?: HomeDashboardReviewSummary;
  myWeeklyReport?: HomeDashboardMyWeeklyReport | null;
  weeklyReportsSummary?: HomeDashboardWeeklyReportsSummary;
}
