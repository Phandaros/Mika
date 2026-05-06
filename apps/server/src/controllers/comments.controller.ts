import type { RequestHandler } from "express";
import { Role } from "../lib/enums.js";
import { prisma } from "../lib/prisma.js";
import { emitNotification } from "../lib/socket.js";
import { getAuthUser } from "../middleware/auth.js";
import { AppError } from "../middleware/errorHandler.js";

interface CommentBody {
  content: string;
}

export const listComments: RequestHandler = async (req, res, next) => {
  try {
    const comments = await prisma.comment.findMany({
      where: { taskId: req.params.taskId },
      orderBy: { createdAt: "asc" },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatarUrl: true,
            isActive: true,
            createdAt: true,
            updatedAt: true
          }
        }
      }
    });

    res.json({ comments });
  } catch (error) {
    next(error);
  }
};

export const createComment: RequestHandler = async (req, res, next) => {
  try {
    const user = getAuthUser(req);
    const body = req.body as CommentBody;

    const task = await prisma.task.findUnique({ where: { id: req.params.taskId } });

    if (!task) {
      throw new AppError(404, "Task not found");
    }

    const comment = await prisma.comment.create({
      data: {
        taskId: req.params.taskId,
        authorId: user.id,
        content: body.content
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatarUrl: true,
            isActive: true,
            createdAt: true,
            updatedAt: true
          }
        }
      }
    });

    if (task.assigneeId && task.assigneeId !== user.id) {
      const notification = await prisma.notification.create({
        data: {
          userId: task.assigneeId,
          type: "COMMENT_ADDED",
          title: "Novo comentario",
          message: `${user.name} comentou na tarefa ${task.title}`,
          taskId: task.id
        }
      });

      emitNotification(task.assigneeId, notification);
    }

    res.status(201).json({ comment });
  } catch (error) {
    next(error);
  }
};

export const deleteComment: RequestHandler = async (req, res, next) => {
  try {
    const user = getAuthUser(req);
    const comment = await prisma.comment.findUnique({ where: { id: req.params.id } });

    if (!comment) {
      throw new AppError(404, "Comment not found");
    }

    if (comment.authorId !== user.id && user.role !== Role.ADMIN) {
      throw new AppError(403, "Insufficient permissions");
    }

    await prisma.comment.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
