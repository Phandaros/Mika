export type WeeklyReportStatus = "PENDING" | "SUBMITTED" | "LATE";

export interface WeeklyReportItemDto {
  id: string;
  taskId: string;
  taskTitle: string;
  taskStatus: string;
  projectName: string;
  sectionName: string;
  comment: string;
}

export interface WeeklyReportDto {
  id: string;
  userId: string;
  userName: string;
  userAvatarUrl?: string;
  weekStart: string;
  weekEnd: string;
  status: WeeklyReportStatus;
  submittedAt?: string;
  items: WeeklyReportItemDto[];
}

export interface WeeklyReportSummaryDto {
  id: string;
  userId: string;
  userName: string;
  weekStart: string;
  status: WeeklyReportStatus;
  submittedAt?: string;
  itemCount: number;
}

export interface WeeklyReportsListResponse {
  reports: WeeklyReportSummaryDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  summary: {
    expected: number;
    submitted: number;
    late: number;
    pending: number;
    submissionRate: number;
  };
}
