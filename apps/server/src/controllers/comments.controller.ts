import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma.js";
import { toPublicUser, userSelect } from "../lib/asanaDto.js";
import { getAuthUser } from "../middleware/auth.js";
import { AppError } from "../middleware/errorHandler.js";
import { createAndEmitNotification } from "../lib/notify.js";
import { taskActivityTypes } from "../lib/taskActivity.js";
import { Role } from "../lib/enums.js";

interface CommentBody {
  content: string;
}

const commentEditWindowMs = 2 * 60 * 60 * 1000;
const privilegedCommentRoles = new Set<string>([Role.ADMIN, Role.COORDINATOR]);

function canMutateComment(
  user: { id: string; role: string },
  comment: { authorId: string | null; createdAt: Date }
): boolean {
  if (privilegedCommentRoles.has(user.role)) {
    return true;
  }

  if (!comment.authorId || comment.authorId !== user.id) {
    return false;
  }

  return Date.now() - comment.createdAt.getTime() <= commentEditWindowMs;
}

export const listComments: RequestHandler = async (req, res, next) => {
  try {
    const task = await prisma.task.findUnique({ where: { id: req.params.taskId }, select: { id: true } });

    if (!task) {
      throw new AppError(404, "Task not found");
    }

    const comments = await prisma.comment.findMany({
      where: { taskId: task.id },
      orderBy: { createdAt: "asc" },
      include: { author: { select: userSelect } }
    });

    res.json({
      comments: comments.map((comment) => ({
        id: comment.id,
        taskId: comment.taskId,
        authorId: comment.authorId,
        content: comment.content,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        asanaGid: comment.asanaGid,
        asanaCreatedAt: comment.asanaCreatedAt,
        author: toPublicUser(comment.author)
      }))
    });
  } catch (error) {
    next(error);
  }
};

export const createComment: RequestHandler = async (req, res, next) => {
  try {
    const task = await prisma.task.findUnique({ where: { id: req.params.taskId }, select: { id: true } });

    if (!task) {
      throw new AppError(404, "Task not found");
    }

    const body = req.body as CommentBody;
    const authUser = getAuthUser(req);
    const comment = await prisma.comment.create({
      data: {
        taskId: task.id,
        authorId: authUser.id,
        content: body.content
      },
      include: { author: { select: userSelect } }
    });

    await prisma.taskActivity.create({
      data: {
        taskId: task.id,
        actorId: authUser.id,
        type: taskActivityTypes.COMMENTED,
        field: "comment",
        toValue: comment.id
      }
    });

    const fullTask = await prisma.task.findUnique({
      where: { id: task.id },
      include: {
        assignee: { select: { id: true } },
        followers: { include: { user: { select: { id: true } } } }
      }
    });

    if (fullTask) {
      const recipients = new Set<string>();
      if (fullTask.assignee) {
        recipients.add(fullTask.assignee.id);
      }
      for (const follower of fullTask.followers) {
        if (follower.user) {
          recipients.add(follower.user.id);
        }
      }
      recipients.delete(authUser.id);

      for (const userId of recipients) {
        await createAndEmitNotification({
          userId,
          type: "COMMENT_ADDED",
          title: "Novo comentário",
          message: `${fullTask.name}: ${body.content.slice(0, 120)}${body.content.length > 120 ? "…" : ""}`,
          taskId: fullTask.id
        });
      }
    }

    res.status(201).json({
      comment: {
        id: comment.id,
        taskId: comment.taskId,
        authorId: comment.authorId,
        content: comment.content,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        asanaGid: comment.asanaGid,
        asanaCreatedAt: comment.asanaCreatedAt,
        author: toPublicUser(comment.author)
      }
    });
  } catch (error) {
    next(error);
  }
};

export const updateComment: RequestHandler = async (req, res, next) => {
  try {
    const authUser = getAuthUser(req);
    const body = req.body as CommentBody;
    const existing = await prisma.comment.findUnique({
      where: { id: req.params.id },
      select: { id: true, authorId: true, createdAt: true }
    });

    if (!existing) {
      throw new AppError(404, "Comment not found");
    }

    if (!canMutateComment(authUser, existing)) {
      throw new AppError(403, "Você não tem permissão para editar este comentário");
    }

    const comment = await prisma.comment.update({
      where: { id: existing.id },
      data: { content: body.content },
      include: { author: { select: userSelect } }
    });

    res.json({
      comment: {
        id: comment.id,
        taskId: comment.taskId,
        authorId: comment.authorId,
        content: comment.content,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        asanaGid: comment.asanaGid,
        asanaCreatedAt: comment.asanaCreatedAt,
        author: toPublicUser(comment.author)
      }
    });
  } catch (error) {
    next(error);
  }
};

export const deleteComment: RequestHandler = async (req, res, next) => {
  try {
    const authUser = getAuthUser(req);
    const existing = await prisma.comment.findUnique({
      where: { id: req.params.id },
      select: { id: true, authorId: true, createdAt: true }
    });

    if (!existing) {
      throw new AppError(404, "Comment not found");
    }

    if (!canMutateComment(authUser, existing)) {
      throw new AppError(403, "Você não tem permissão para apagar este comentário");
    }

    await prisma.comment.delete({ where: { id: existing.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
