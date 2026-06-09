import type { Prisma } from "../generated/prisma/client.js";
import type { RequestHandler } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { taskCustomFieldCatalogInclude, taskInclude, toPublicUser, toTaskDto, userSelect } from "../lib/asanaDto.js";
import { TaskStatus } from "../lib/enums.js";
import { createAdjustmentTask } from "../lib/taskRules.js";
import { AppError } from "../middleware/errorHandler.js";
import { getAuthUser } from "../middleware/auth.js";

const reviewStatusValues = ["PENDING", "APPROVED", "REJECTED"] as const;
const listReviewsQuerySchema = z.object({
  status: z.enum(reviewStatusValues).optional().default("PENDING"),
  assigneeId: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(25)
});

const reviewInclude = {
  sourceTask: { include: taskInclude },
  rootTask: { include: taskInclude },
  reviewer: { select: userSelect },
  requestedBy: { select: userSelect }
} satisfies Prisma.TaskReviewInclude;

type ReviewRecord = Prisma.TaskReviewGetPayload<{ include: typeof reviewInclude }>;

async function taskFieldCatalog() {
  return prisma.asanaCustomField.findMany({
    where: { mikaTaskField: true },
    include: taskCustomFieldCatalogInclude,
    orderBy: [{ mikaSortOrder: "asc" }, { name: "asc" }]
  });
}

function dateOnly(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  return value ? value.slice(0, 10) : null;
}

function toReviewDto(review: ReviewRecord, catalog: Awaited<ReturnType<typeof taskFieldCatalog>>) {
  const sourceTask = toTaskDto(review.sourceTask, undefined, catalog);
  const rootTask = toTaskDto(review.rootTask, undefined, catalog);

  return {
    id: review.id,
    title: `[REV] ${sourceTask.title}`,
    discipline: "Revisão" as const,
    sourceTaskId: review.sourceTaskId,
    rootTaskId: review.rootTaskId,
    reviewerId: review.reviewerId,
    requestedById: review.requestedById,
    status: review.status,
    message: review.message,
    startDate: review.startOn,
    dueDate: review.dueOn,
    decidedAt: review.decidedAt?.toISOString() ?? null,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
    sourceTask,
    rootTask,
    reviewer: toPublicUser(review.reviewer),
    requestedBy: toPublicUser(review.requestedBy)
  };
}

export const listReviews: RequestHandler = async (req, res, next) => {
  try {
    const authUser = getAuthUser(req);
    const parsed = listReviewsQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      throw new AppError(400, "Parametros de revisao invalidos", parsed.error.flatten());
    }

    const { status, page, limit } = parsed.data;
    const reviewerId = parsed.data.assigneeId === "me" ? authUser.id : parsed.data.assigneeId;
    const where: Prisma.TaskReviewWhereInput = {
      status,
      ...(reviewerId ? { reviewerId } : {})
    };
    const [total, reviews, catalog] = await Promise.all([
      prisma.taskReview.count({ where }),
      prisma.taskReview.findMany({
        where,
        include: reviewInclude,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit
      }),
      taskFieldCatalog()
    ]);

    res.json({
      reviews: reviews.map((review) => toReviewDto(review, catalog)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    next(error);
  }
};

export const getReviewById: RequestHandler = async (req, res, next) => {
  try {
    const [review, catalog] = await Promise.all([
      prisma.taskReview.findUnique({
        where: { id: req.params.id },
        include: reviewInclude
      }),
      taskFieldCatalog()
    ]);

    if (!review) {
      throw new AppError(404, "Revisao nao encontrada");
    }

    res.json({ review: toReviewDto(review, catalog) });
  } catch (error) {
    next(error);
  }
};

export const updateReview: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as { reviewerId?: string; startDate?: string | null; dueDate?: string | null };

    if (body.reviewerId) {
      const reviewer = await prisma.user.findUnique({
        where: { id: body.reviewerId },
        select: { id: true, role: true, isActive: true }
      });

      if (!reviewer?.isActive || !["ADMIN", "COORDINATOR"].includes(reviewer.role)) {
        throw new AppError(400, "Responsavel de revisao invalido");
      }
    }

    const review = await prisma.taskReview.update({
      where: { id: req.params.id },
      data: {
        reviewerId: body.reviewerId,
        startOn: dateOnly(body.startDate),
        dueOn: dateOnly(body.dueDate)
      },
      include: reviewInclude
    });
    const catalog = await taskFieldCatalog();

    res.json({ review: toReviewDto(review, catalog) });
  } catch (error) {
    next(error);
  }
};

export const approveReview: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as { message?: string };
    const reviewId = req.params.id;
    if (!reviewId) {
      throw new AppError(400, "Review id is required");
    }
    const review = await prisma.$transaction(async (tx) => {
      const existing = await tx.taskReview.findUnique({
        where: { id: reviewId },
        select: { id: true, sourceTaskId: true, status: true }
      });

      if (!existing) {
        throw new AppError(404, "Revisao nao encontrada");
      }

      if (existing.status !== "PENDING") {
        throw new AppError(400, "Esta revisao ja foi decidida");
      }

      await tx.task.update({
        where: { id: existing.sourceTaskId },
        data: {
          mikaStatus: TaskStatus.FINISHED,
          completed: true,
          completedAtAsana: new Date()
        }
      });

      return tx.taskReview.update({
        where: { id: reviewId },
        data: {
          status: "APPROVED",
          message: body.message?.trim() || null,
          decidedAt: new Date()
        },
        include: reviewInclude
      });
    });
    const catalog = await taskFieldCatalog();

    res.json({ review: toReviewDto(review, catalog) });
  } catch (error) {
    next(error);
  }
};

export const rejectReview: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as { message?: string };
    const reviewId = req.params.id;
    if (!reviewId) {
      throw new AppError(400, "Review id is required");
    }
    const message = body.message?.trim();

    if (!message) {
      throw new AppError(400, "Informe uma mensagem para o projetista");
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.taskReview.findUnique({
        where: { id: reviewId },
        select: { id: true, status: true }
      });

      if (!existing) {
        throw new AppError(404, "Revisao nao encontrada");
      }

      if (existing.status !== "PENDING") {
        throw new AppError(400, "Esta revisao ja foi decidida");
      }

      const adjustmentTaskId = await createAdjustmentTask(tx, reviewId, message);
      const reviewSource = await tx.taskReview.findUniqueOrThrow({
        where: { id: reviewId },
        select: { sourceTaskId: true }
      });
      await tx.task.update({
        where: { id: reviewSource.sourceTaskId },
        data: {
          mikaStatus: TaskStatus.FINISHED,
          completed: true,
          completedAtAsana: new Date()
        }
      });
      const review = await tx.taskReview.update({
        where: { id: reviewId },
        data: {
          status: "REJECTED",
          message,
          decidedAt: new Date()
        },
        include: reviewInclude
      });

      return { review, adjustmentTaskId };
    });
    const catalog = await taskFieldCatalog();

    res.json({ review: toReviewDto(result.review, catalog), adjustmentTaskId: result.adjustmentTaskId });
  } catch (error) {
    next(error);
  }
};
