import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma.js";
import { toPublicUser, userSelect } from "../lib/asanaDto.js";
import { getAuthUser } from "../middleware/auth.js";
import { AppError } from "../middleware/errorHandler.js";

interface CommentBody {
  content: string;
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

    res.status(201).json({
      comment: {
        id: comment.id,
        taskId: comment.taskId,
        authorId: comment.authorId,
        content: comment.content,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        author: toPublicUser(comment.author)
      }
    });
  } catch (error) {
    next(error);
  }
};

export const deleteComment: RequestHandler = async (req, res, next) => {
  try {
    await prisma.comment.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
