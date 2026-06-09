import { Task } from "./task.js";
import { User } from "./user.js";

export enum TaskReviewStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED"
}

export interface TaskReview {
  id: string;
  title: string;
  discipline: "Revisão";
  sourceTaskId: string;
  rootTaskId: string;
  reviewerId: string;
  requestedById: string | null;
  status: TaskReviewStatus;
  message: string | null;
  startDate: string | null;
  dueDate: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sourceTask?: Task;
  rootTask?: Task;
  reviewer?: User | null;
  requestedBy?: User | null;
}

export interface TaskReviewsResponse {
  reviews: TaskReview[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface UpdateTaskReviewRequest {
  reviewerId?: string;
  startDate?: string | null;
  dueDate?: string | null;
}

export interface TaskReviewDecisionRequest {
  message?: string;
}
