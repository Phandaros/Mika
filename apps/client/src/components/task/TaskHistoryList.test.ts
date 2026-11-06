import { describe, expect, it } from "vitest";
import { Role, type TaskActivity } from "shared";
import { activitySentence } from "../../lib/taskActivityLabels";

function reviewActivity(type: TaskActivity["type"]): TaskActivity {
  return {
    id: `${type}-1`,
    taskId: "task-1",
    actorId: "user-1",
    type,
    field: "review",
    fromValue: null,
    toValue: "Leonardo",
    metadata: {
      reviewId: "review-1",
      reviewerId: "user-2",
      reviewerName: "Leonardo"
    },
    createdAt: "2026-07-01T08:31:00.000Z",
    actor: {
      id: "user-1",
      name: "Christopher",
      email: "christopher@example.com",
      role: Role.DESIGNER,
      avatarUrl: null,
      isActive: true,
      createdAt: "2026-07-01T08:00:00.000Z",
      updatedAt: "2026-07-01T08:00:00.000Z"
    }
  };
}

describe("activitySentence", () => {
  it("renderiza envio, aprovação e reprovação de revisão", () => {
    expect(activitySentence(reviewActivity("REVIEW_REQUESTED"))).toBe("enviou a tarefa para Revisão de Leonardo");
    expect(activitySentence(reviewActivity("REVIEW_APPROVED"))).toBe("aprovou essa tarefa");
    expect(activitySentence(reviewActivity("REVIEW_REJECTED"))).toBe("reprovou essa tarefa");
  });
});
