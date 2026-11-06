import type { RequestHandler } from "express";
import { NotificationType, type AttachmentDto, type CommentRevisionType } from "shared";
import { prisma } from "../lib/prisma.js";
import { toPublicUser, userSelect } from "../lib/asanaDto.js";
import { getAuthUser } from "../middleware/auth.js";
import { AppError } from "../middleware/errorHandler.js";
import { commentNotificationMessage, createAndEmitNotification } from "../lib/notify.js";
import { extractUserMentionIds, findNewUserMentionIds } from "../lib/commentMentions.js";
import { taskActivityTypes } from "../lib/taskActivity.js";
import { activeTaskWhere } from "../lib/taskDeletion.js";
import { Role } from "../lib/enums.js";
import { normalizeAttachmentFilename } from "../lib/attachmentFilename.js";

interface CommentBody {
  content: string;
}

interface UpdateCommentBody extends CommentBody {
  expectedUpdatedAt?: string;
}

const commentEditWindowMs = 2 * 60 * 60 * 1000;
/** Tolerância para concluir uma edição aberta perto do fim da janela; não vale para apagar. */
const commentEditGraceMs = 15 * 60 * 1000;
const privilegedCommentRoles = new Set<string>([Role.ADMIN, Role.COORDINATOR]);

const commentInclude = {
  author: { select: userSelect },
  editedBy: { select: { id: true, name: true } },
  attachments: {
    include: {
      uploadedBy: { select: { id: true, name: true } }
    },
    orderBy: { createdAt: "asc" as const }
  }
};

function assertNoLocalImageLinks(content: string): void {
  if (/\]\(\s*blob:/i.test(content)) {
    throw new AppError(400, "O comentário contém uma imagem que não terminou de ser enviada. Remova a imagem e insira novamente.");
  }
}

function toAttachmentDto(attachment: {
  id: string;
  commentId: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedById: string;
  createdAt: Date;
  uploadedBy: { id: string; name: string };
}): AttachmentDto {
  return {
    id: attachment.id,
    commentId: attachment.commentId,
    filename: normalizeAttachmentFilename(attachment.filename),
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    uploadedById: attachment.uploadedById,
    uploadedBy: attachment.uploadedBy,
    createdAt: attachment.createdAt.toISOString()
  };
}

function toCommentDto(comment: {
  id: string;
  taskId: string;
  authorId: string | null;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  asanaGid: string | null;
  asanaCreatedAt: Date | null;
  author: Parameters<typeof toPublicUser>[0];
  attachments?: Array<Parameters<typeof toAttachmentDto>[0]>;
  editedAt: Date | null;
  editedBy: { id: string; name: string } | null;
}) {
  return {
    id: comment.id,
    taskId: comment.taskId,
    authorId: comment.authorId,
    content: comment.content,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    asanaGid: comment.asanaGid,
    asanaCreatedAt: comment.asanaCreatedAt,
    author: toPublicUser(comment.author),
    attachments: (comment.attachments ?? []).map(toAttachmentDto),
    editedAt: comment.editedAt,
    editedBy: comment.editedBy
  };
}

async function notifyMentionedUsers(options: {
  content: string;
  previousContent?: string;
  taskId: string;
  taskName: string;
  authorId: string;
  skipUserIds?: Set<string>;
}) {
  const mentionedUserIds =
    options.previousContent === undefined
      ? extractUserMentionIds(options.content)
      : findNewUserMentionIds(options.previousContent, options.content);
  const skipUserIds = options.skipUserIds ?? new Set<string>();

  for (const userId of mentionedUserIds) {
    if (userId === options.authorId || skipUserIds.has(userId)) {
      continue;
    }

    await createAndEmitNotification({
      userId,
      type: NotificationType.MENTIONED,
      actorId: options.authorId,
      message: commentNotificationMessage(options.taskName, options.content),
      taskId: options.taskId
    });
  }
}

function canMutateComment(
  user: { id: string; role: string },
  comment: { authorId: string | null; createdAt: Date },
  graceMs = 0
): boolean {
  if (privilegedCommentRoles.has(user.role)) {
    return true;
  }

  if (!comment.authorId || comment.authorId !== user.id) {
    return false;
  }

  return Date.now() - comment.createdAt.getTime() <= commentEditWindowMs + graceMs;
}

function revisionData(
  comment: { id: string; taskId: string; authorId: string | null; createdAt: Date; content: string },
  type: CommentRevisionType,
  actorId: string
) {
  return {
    taskId: comment.taskId,
    commentId: comment.id,
    type,
    content: comment.content,
    authorId: comment.authorId,
    actorId,
    commentCreatedAt: comment.createdAt
  };
}

export const listCommentRevisions: RequestHandler = async (req, res, next) => {
  try {
    const revisions = await prisma.commentRevision.findMany({
      where: { taskId: req.params.taskId },
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { id: true, name: true } },
        actor: { select: { id: true, name: true } },
        attachments: {
          include: { uploadedBy: { select: { id: true, name: true } } },
          orderBy: { createdAt: "asc" }
        }
      }
    });

    res.json({
      revisions: revisions.map((revision) => ({
        id: revision.id,
        taskId: revision.taskId,
        commentId: revision.commentId,
        type: revision.type,
        content: revision.content,
        commentCreatedAt: revision.commentCreatedAt,
        createdAt: revision.createdAt,
        author: revision.author,
        actor: revision.actor,
        attachments: revision.attachments.map(toAttachmentDto)
      }))
    });
  } catch (error) {
    next(error);
  }
};

export const listComments: RequestHandler = async (req, res, next) => {
  try {
    const task = await prisma.task.findFirst({ where: { id: req.params.taskId, ...activeTaskWhere() }, select: { id: true } });

    if (!task) {
      throw new AppError(404, "Task not found");
    }

    const comments = await prisma.comment.findMany({
      where: { taskId: task.id },
      orderBy: { createdAt: "asc" },
      include: commentInclude
    });

    res.json({
      comments: comments.map(toCommentDto)
    });
  } catch (error) {
    next(error);
  }
};

export const createComment: RequestHandler = async (req, res, next) => {
  try {
    const task = await prisma.task.findFirst({ where: { id: req.params.taskId, ...activeTaskWhere() }, select: { id: true } });

    if (!task) {
      throw new AppError(404, "Task not found");
    }

    const body = req.body as CommentBody;
    assertNoLocalImageLinks(body.content);
    const authUser = getAuthUser(req);
    const comment = await prisma.comment.create({
      data: {
        taskId: task.id,
        authorId: authUser.id,
        content: body.content
      },
      include: commentInclude
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

    if (fullTask && !fullTask.deletedAt) {
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
          type: NotificationType.COMMENT_ADDED,
          actorId: authUser.id,
          message: commentNotificationMessage(fullTask.name, body.content),
          taskId: fullTask.id
        });
      }

      await notifyMentionedUsers({
        content: body.content,
        taskId: fullTask.id,
        taskName: fullTask.name,
        authorId: authUser.id,
        skipUserIds: recipients
      });
    }

    res.status(201).json({
      comment: toCommentDto(comment)
    });
  } catch (error) {
    next(error);
  }
};

export const updateComment: RequestHandler = async (req, res, next) => {
  try {
    const authUser = getAuthUser(req);
    const body = req.body as UpdateCommentBody;
    const existing = await prisma.comment.findUnique({
      where: { id: req.params.id },
      select: { id: true, taskId: true, authorId: true, createdAt: true, updatedAt: true, content: true }
    });

    if (!existing) {
      throw new AppError(404, "Comment not found");
    }

    if (!canMutateComment(authUser, existing, commentEditGraceMs)) {
      throw new AppError(
        403,
        existing.authorId === authUser.id
          ? "O prazo para editar este comentário terminou"
          : "Você não tem permissão para editar este comentário"
      );
    }

    assertNoLocalImageLinks(body.content);

    if (existing.content === body.content) {
      const unchanged = await prisma.comment.findUniqueOrThrow({
        where: { id: existing.id },
        include: commentInclude
      });

      res.json({ comment: toCommentDto(unchanged) });
      return;
    }

    if (body.expectedUpdatedAt && new Date(body.expectedUpdatedAt).getTime() !== existing.updatedAt.getTime()) {
      throw new AppError(409, "Este comentário foi alterado por outra pessoa enquanto você editava.");
    }

    const comment = await prisma.$transaction(async (tx) => {
      await tx.commentRevision.create({
        data: revisionData(existing, "EDITED", authUser.id)
      });

      return tx.comment.update({
        where: { id: existing.id },
        data: { content: body.content, editedAt: new Date(), editedById: authUser.id },
        include: commentInclude
      });
    });

    const task = await prisma.task.findUnique({
      where: { id: comment.taskId },
      select: { id: true, name: true, deletedAt: true }
    });

    if (task && !task.deletedAt) {
      await notifyMentionedUsers({
        content: body.content,
        previousContent: existing.content,
        taskId: task.id,
        taskName: task.name,
        authorId: authUser.id
      });
    }

    res.json({
      comment: toCommentDto(comment)
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
      select: { id: true, taskId: true, authorId: true, createdAt: true, content: true }
    });

    if (!existing) {
      throw new AppError(404, "Comment not found");
    }

    if (!canMutateComment(authUser, existing)) {
      throw new AppError(403, "Você não tem permissão para apagar este comentário");
    }

    await prisma.$transaction(async (tx) => {
      const revision = await tx.commentRevision.create({
        data: revisionData(existing, "DELETED", authUser.id)
      });

      await tx.attachment.updateMany({
        where: { commentId: existing.id },
        data: { commentId: null, commentRevisionId: revision.id }
      });
      await tx.comment.delete({ where: { id: existing.id } });
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
