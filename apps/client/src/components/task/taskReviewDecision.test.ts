import { describe, expect, it } from "vitest";
import { TaskStatus, type Task } from "shared";
import { canDecideTaskReview } from "./taskReviewDecision";

type ReviewableTask = Pick<Task, "status" | "pendingReview">;

function reviewableTask(overrides: Partial<ReviewableTask> = {}): ReviewableTask {
  return {
    status: TaskStatus.AWAITING_REVIEW,
    pendingReview: {
      id: "review-1",
      reviewerId: "reviewer-1"
    },
    ...overrides
  };
}

describe("canDecideTaskReview", () => {
  it("permite a decisão apenas ao revisor atribuído da revisão pendente", () => {
    expect(canDecideTaskReview(reviewableTask(), "reviewer-1")).toBe(true);
  });

  it("impede outro usuário de decidir a revisão", () => {
    expect(canDecideTaskReview(reviewableTask(), "reviewer-2")).toBe(false);
  });

  it("impede a decisão quando a tarefa não está aguardando revisão", () => {
    expect(canDecideTaskReview(reviewableTask({ status: TaskStatus.IN_PROGRESS }), "reviewer-1")).toBe(false);
  });

  it("impede a decisão quando não existe revisão pendente", () => {
    expect(canDecideTaskReview(reviewableTask({ pendingReview: null }), "reviewer-1")).toBe(false);
  });
});
