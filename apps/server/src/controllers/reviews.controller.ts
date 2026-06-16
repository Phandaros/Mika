import fs from "node:fs/promises";
import type { Prisma } from "../generated/prisma/client.js";
import type { RequestHandler } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { taskCustomFieldCatalogInclude, taskInclude, toPublicUser, toTaskDto, userSelect } from "../lib/asanaDto.js";
import { TaskStatus } from "../lib/enums.js";
import { createAdjustmentTask } from "../lib/taskRules.js";
import { AppError } from "../middleware/errorHandler.js";
import { getAuthUser } from "../middleware/auth.js";
import { createAndEmitNotification } from "../lib/notify.js";
import { extractUserMentionIds } from "../lib/commentMentions.js";
import { taskActivityTypes } from "../lib/taskActivity.js";

const reviewStatusValues = ["PENDING", "APPROVED", "REJECTED"] as const;
const listReviewsQuerySchema = z.object({
  status: z.enum(reviewStatusValues).optional().default("PENDING"),
  assigneeId: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(25)
});
const reviewDecisionSchema = z.object({
  message: z.string().trim().optional()
});

const reviewInclude = {
  sourceTask: { include: taskInclude },
  rootTask: { include: taskInclude },
  reviewer: { select: userSelect },
  requestedBy: { select: userSelect }
} satisfies Prisma.TaskReviewInclude;

type ReviewRecord = Prisma.TaskReviewGetPayload<{ include: typeof reviewInclude }>;
type UploadedFile = Express.Multer.File;

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
    title: sourceTask.title,
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

function uploadedFiles(req: Parameters<RequestHandler>[0]): UploadedFile[] {
  return Array.isArray(req.files) ? req.files : [];
}

async function cleanupFiles(files: UploadedFile[]): Promise<void> {
  await Promise.all(files.map((file) => fs.unlink(file.path).catch(() => undefined)));
}

function parseDecisionBody(body: unknown): { message?: string } {
  const parsed = reviewDecisionSchema.safeParse(body);

  if (!parsed.success) {
    throw new AppError(400, "Dados da decisão de revisão inválidos", parsed.error.flatten());
  }

  return parsed.data;
}

async function createReviewComment(
  tx: Prisma.TransactionClient,
  input: {
    taskId: string;
    authorId: string;
    content: string;
    files: UploadedFile[];
  }
): Promise<void> {
  const comment = await tx.comment.create({
    data: {
      taskId: input.taskId,
      authorId: input.authorId,
      content: input.content
    }
  });

  await tx.taskActivity.create({
    data: {
      taskId: input.taskId,
      actorId: input.authorId,
      type: taskActivityTypes.COMMENTED,
      field: "comment",
      toValue: comment.id
    }
  });

  for (const file of input.files) {
    await tx.attachment.create({
      data: {
        commentId: comment.id,
        filename: file.originalname,
        storedAs: file.filename,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        uploadedById: input.authorId
      }
    });
  }
}

async function notifyReviewComment(options: {
  taskId: string;
  taskName: string;
  content: string;
  authorId: string;
}) {
  const task = await prisma.task.findUnique({
    where: { id: options.taskId },
    include: {
      assignee: { select: { id: true } },
      followers: { include: { user: { select: { id: true } } } }
    }
  });

  if (!task) {
    return;
  }

  const recipients = new Set<string>();
  if (task.assignee) {
    recipients.add(task.assignee.id);
  }
  for (const follower of task.followers) {
    if (follower.user) {
      recipients.add(follower.user.id);
    }
  }
  recipients.delete(options.authorId);

  for (const userId of recipients) {
    await createAndEmitNotification({
      userId,
      type: "COMMENT_ADDED",
      title: "Novo comentário",
      message: `${options.taskName}: ${options.content.slice(0, 120)}${options.content.length > 120 ? "..." : ""}`,
      taskId: options.taskId
    });
  }

  for (const userId of extractUserMentionIds(options.content)) {
    if (userId === options.authorId || recipients.has(userId)) {
      continue;
    }

    await createAndEmitNotification({
      userId,
      type: "MENTIONED",
      title: "Você foi mencionado",
      message: `${options.taskName}: ${options.content.slice(0, 120)}${options.content.length > 120 ? "..." : ""}`,
      taskId: options.taskId
    });
  }
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
  const files = uploadedFiles(req);
  let filesLinked = false;
  try {
    const body = parseDecisionBody(req.body);
    const reviewId = req.params.id;
    if (!reviewId) {
      throw new AppError(400, "Review id is required");
    }
    const authUser = getAuthUser(req);
    const message = body.message?.trim() ?? "";
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.taskReview.findUnique({
        where: { id: reviewId },
        select: { id: true, sourceTaskId: true, reviewerId: true, status: true, sourceTask: { select: { id: true, name: true } } }
      });

      if (!existing) {
        throw new AppError(404, "Revisao nao encontrada");
      }

      if (existing.status !== "PENDING") {
        throw new AppError(400, "Esta revisao ja foi decidida");
      }

      if (existing.reviewerId !== authUser.id) {
        throw new AppError(403, "Apenas o revisor atribuido pode aprovar esta revisao");
      }

      if (message || files.length > 0) {
        await createReviewComment(tx, {
          taskId: existing.sourceTaskId,
          authorId: authUser.id,
          content: message || "Anexos da revisão.",
          files
        });
      }

      await tx.task.update({
        where: { id: existing.sourceTaskId },
        data: {
          mikaStatus: TaskStatus.FINISHED,
          completed: true,
          completedAtAsana: new Date()
        }
      });

      const review = await tx.taskReview.update({
        where: { id: reviewId },
        data: {
          status: "APPROVED",
          message: message || null,
          decidedAt: new Date()
        },
        include: reviewInclude
      });

      return {
        review,
        commentTask: message || files.length > 0 ? { id: existing.sourceTaskId, name: existing.sourceTask.name, content: message || "Anexos da revisão." } : null
      };
    });
    filesLinked = Boolean(result.commentTask);
    const catalog = await taskFieldCatalog();

    if (result.commentTask) {
      await notifyReviewComment({
        taskId: result.commentTask.id,
        taskName: result.commentTask.name,
        content: result.commentTask.content,
        authorId: authUser.id
      }).catch(() => undefined);
    }

    res.json({ review: toReviewDto(result.review, catalog) });
  } catch (error) {
    if (!filesLinked) {
      await cleanupFiles(files);
    }
    next(error);
  }
};

export const rejectReview: RequestHandler = async (req, res, next) => {
  const files = uploadedFiles(req);
  let filesLinked = false;
  try {
    const body = parseDecisionBody(req.body);
    const reviewId = req.params.id;
    if (!reviewId) {
      throw new AppError(400, "Review id is required");
    }
    const authUser = getAuthUser(req);
    const message = body.message?.trim();

    if (!message) {
      throw new AppError(400, "Informe uma mensagem para o projetista");
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.taskReview.findUnique({
        where: { id: reviewId },
        select: { id: true, reviewerId: true, status: true }
      });

      if (!existing) {
        throw new AppError(404, "Revisao nao encontrada");
      }

      if (existing.status !== "PENDING") {
        throw new AppError(400, "Esta revisao ja foi decidida");
      }

      if (existing.reviewerId !== authUser.id) {
        throw new AppError(403, "Apenas o revisor atribuido pode recusar esta revisao");
      }

      const adjustmentTaskId = await createAdjustmentTask(tx, reviewId);
      const reviewSource = await tx.taskReview.findUniqueOrThrow({
        where: { id: reviewId },
        select: { sourceTaskId: true }
      });
      const adjustmentTask = await tx.task.findUniqueOrThrow({
        where: { id: adjustmentTaskId },
        select: { id: true, name: true }
      });
      await createReviewComment(tx, {
        taskId: adjustmentTaskId,
        authorId: authUser.id,
        content: message,
        files
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

      return { review, adjustmentTaskId, adjustmentTaskName: adjustmentTask.name };
    });
    filesLinked = true;
    const catalog = await taskFieldCatalog();

    await notifyReviewComment({
      taskId: result.adjustmentTaskId,
      taskName: result.adjustmentTaskName,
      content: message,
      authorId: authUser.id
    }).catch(() => undefined);

    res.json({ review: toReviewDto(result.review, catalog), adjustmentTaskId: result.adjustmentTaskId });
  } catch (error) {
    if (!filesLinked) {
      await cleanupFiles(files);
    }
    next(error);
  }
};
