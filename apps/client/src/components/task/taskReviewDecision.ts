import { TaskStatus, type Task } from "shared";

type ReviewableTask = Pick<Task, "status" | "pendingReview">;

export function canDecideTaskReview(
  task: ReviewableTask | null | undefined,
  userId: string | null | undefined
): boolean {
  return Boolean(
    task &&
      userId &&
      task.status === TaskStatus.AWAITING_REVIEW &&
      task.pendingReview &&
      task.pendingReview.reviewerId === userId
  );
}
