import type { Prisma } from "../generated/prisma/client.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createReviewTaskActivity, taskActivityTypes } from "./taskActivity.js";

function txMock(findFirstResult: { id: string } | null = null) {
  const taskActivity = {
    findFirst: vi.fn().mockResolvedValue(findFirstResult),
    create: vi.fn().mockResolvedValue({ id: "activity-1" })
  };

  return {
    taskActivity,
    tx: { taskActivity } as unknown as Prisma.TransactionClient
  };
}

describe("createReviewTaskActivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("grava evento de revisão com metadata padronizada", async () => {
    const { taskActivity, tx } = txMock();

    await createReviewTaskActivity(tx, {
      taskId: "task-1",
      actorId: "user-1",
      type: taskActivityTypes.REVIEW_REQUESTED,
      reviewId: "review-1",
      reviewerId: "user-2",
      reviewerName: "Leonardo"
    });

    expect(taskActivity.findFirst).toHaveBeenCalledWith({
      where: {
        taskId: "task-1",
        type: "REVIEW_REQUESTED",
        AND: [
          { metadataJson: { contains: "\"reviewId\":\"review-1\"" } },
          { metadataJson: { contains: "\"reviewerId\":\"user-2\"" } }
        ]
      },
      select: { id: true }
    });
    expect(taskActivity.create).toHaveBeenCalledWith({
      data: {
        taskId: "task-1",
        actorId: "user-1",
        type: "REVIEW_REQUESTED",
        field: "review",
        fromValue: null,
        toValue: "Leonardo",
        metadataJson: JSON.stringify({
          reviewId: "review-1",
          reviewerId: "user-2",
          reviewerName: "Leonardo"
        })
      }
    });
  });

  it("não duplica evento já registrado para a mesma revisão e tipo", async () => {
    const { taskActivity, tx } = txMock({ id: "activity-1" });

    await createReviewTaskActivity(tx, {
      taskId: "task-1",
      actorId: "user-1",
      type: taskActivityTypes.REVIEW_APPROVED,
      reviewId: "review-1",
      reviewerId: "user-2",
      reviewerName: "Leonardo"
    });

    expect(taskActivity.create).not.toHaveBeenCalled();
  });
});
