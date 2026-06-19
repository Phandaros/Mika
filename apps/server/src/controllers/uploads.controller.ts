import fs from "node:fs/promises";
import path from "node:path";
import type { RequestHandler } from "express";
import type { AttachmentDto } from "shared";
import { env } from "../config/env.js";
import { Role } from "../lib/enums.js";
import {
  attachmentContentDisposition,
  normalizeAttachmentFilename
} from "../lib/attachmentFilename.js";
import { canAccessAttachment, findAttachmentWithComment, findCommentWithTask } from "../lib/attachmentAccess.js";
import { prisma } from "../lib/prisma.js";
import { IMAGE_MIME_TYPES } from "../lib/upload.js";
import { getAuthUser } from "../middleware/auth.js";
import { AppError } from "../middleware/errorHandler.js";

function toAttachmentDto(
  attachment: {
    id: string;
    commentId: string | null;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    uploadedById: string;
    createdAt: Date;
    uploadedBy: { id: string; name: string };
  }
): AttachmentDto {
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

const attachmentInclude = {
  uploadedBy: {
    select: { id: true, name: true }
  }
} as const;

export const uploadInlineImage: RequestHandler = async (req, res, next) => {
  try {
    const authUser = getAuthUser(req);
    const file = req.file;

    if (!file) {
      throw new AppError(400, "Nenhum arquivo enviado");
    }

    if (!IMAGE_MIME_TYPES.has(file.mimetype)) {
      await fs.unlink(file.path).catch(() => undefined);
      throw new AppError(415, "Somente imagens JPEG, PNG, GIF ou WebP são permitidas para inserção inline");
    }

    const attachment = await prisma.attachment.create({
      data: {
        commentId: null,
        filename: file.originalname,
        storedAs: file.filename,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        uploadedById: authUser.id
      },
      include: attachmentInclude
    });

    res.status(201).json({
      id: attachment.id,
      url: `/api/v1/attachments/${attachment.id}/file`,
      filename: attachment.filename,
      attachment: toAttachmentDto(attachment)
    });
  } catch (error) {
    next(error);
  }
};

export const uploadAttachments: RequestHandler = async (req, res, next) => {
  try {
    const authUser = getAuthUser(req);
    const files = req.files;

    if (!Array.isArray(files) || files.length === 0) {
      throw new AppError(400, "Nenhum arquivo enviado");
    }

    const commentId = req.params.commentId;

    if (!commentId) {
      throw new AppError(400, "ID do comentário é obrigatório");
    }

    const comment = await findCommentWithTask(commentId);

    if (!comment) {
      for (const file of files) {
        await fs.unlink(file.path).catch(() => undefined);
      }
      throw new AppError(404, "Comentário não encontrado");
    }

    for (const file of files) {
      if (IMAGE_MIME_TYPES.has(file.mimetype)) {
        for (const uploaded of files) {
          await fs.unlink(uploaded.path).catch(() => undefined);
        }
        throw new AppError(415, "Imagens devem ser inseridas no texto do comentário, não como anexo de documento");
      }
    }

    const created = await prisma.$transaction(
      files.map((file) =>
        prisma.attachment.create({
          data: {
            commentId: comment.id,
            filename: file.originalname,
            storedAs: file.filename,
            mimeType: file.mimetype,
            sizeBytes: file.size,
            uploadedById: authUser.id
          },
          include: attachmentInclude
        })
      )
    );

    res.status(201).json({
      attachments: created.map(toAttachmentDto)
    });
  } catch (error) {
    next(error);
  }
};

async function sendAttachment(
  req: Parameters<RequestHandler>[0],
  res: Parameters<RequestHandler>[1],
  next: Parameters<RequestHandler>[2],
  disposition: "inline" | "attachment"
): Promise<void> {
  try {
    getAuthUser(req);

    const attachmentId = req.params.id;

    if (!attachmentId) {
      throw new AppError(400, "ID do anexo é obrigatório");
    }

    const attachment = await findAttachmentWithComment(attachmentId);

    if (!attachment) {
      throw new AppError(404, "Anexo não encontrado");
    }

    const canAccess = await canAccessAttachment(attachmentId);

    if (!canAccess) {
      throw new AppError(403, "Você não tem permissão para acessar este anexo");
    }

    const absolutePath = path.resolve(env.UPLOAD_DIR, attachment.storedAs);

    try {
      await fs.access(absolutePath);
    } catch {
      throw new AppError(500, "Arquivo do anexo não encontrado no servidor");
    }

    res.setHeader("Content-Type", attachment.mimeType);
    res.setHeader(
      "Content-Disposition",
      attachmentContentDisposition(disposition, attachment.filename)
    );
    res.sendFile(absolutePath);
  } catch (error) {
    next(error);
  }
}

export const serveAttachment: RequestHandler = async (req, res, next) => {
  await sendAttachment(req, res, next, "inline");
};

export const downloadAttachment: RequestHandler = async (req, res, next) => {
  await sendAttachment(req, res, next, "attachment");
};

export const deleteAttachment: RequestHandler = async (req, res, next) => {
  try {
    const authUser = getAuthUser(req);
    const attachmentId = req.params.id;

    if (!attachmentId) {
      throw new AppError(400, "ID do anexo é obrigatório");
    }

    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        projectNote: {
          select: {
            content: true,
            _count: { select: { attachments: true } }
          }
        },
        meetingMinute: {
          select: {
            content: true,
            _count: { select: { attachments: true } }
          }
        }
      }
    });

    if (!attachment) {
      throw new AppError(404, "Anexo não encontrado");
    }

    const isOwner = attachment.uploadedById === authUser.id;
    const isPrivileged = authUser.role === Role.ADMIN || authUser.role === Role.COORDINATOR;

    const isCollaborativeDocument = Boolean(attachment.projectNote || attachment.meetingMinute);

    if (!isCollaborativeDocument && !isOwner && !isPrivileged) {
      throw new AppError(403, "Você não tem permissão para remover este anexo");
    }

    if (
      attachment.projectNote &&
      !attachment.projectNote.content?.trim() &&
      attachment.projectNote._count.attachments <= 1
    ) {
      throw new AppError(400, "A anotação precisa manter conteúdo markdown ou pelo menos um anexo");
    }

    if (
      attachment.meetingMinute &&
      !attachment.meetingMinute.content?.trim() &&
      attachment.meetingMinute._count.attachments <= 1
    ) {
      throw new AppError(400, "A ata precisa manter conteúdo markdown ou pelo menos um anexo");
    }

    const absolutePath = path.resolve(env.UPLOAD_DIR, attachment.storedAs);
    await fs.unlink(absolutePath).catch(() => undefined);
    await prisma.attachment.delete({ where: { id: attachment.id } });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// Mantido para compatibilidade com rotas legadas de tarefa (Fase 1).
export const uploadAttachment: RequestHandler = async (_req, _res, next) => {
  next(new AppError(501, "Use POST /comments/:commentId/attachments para anexar documentos a comentários."));
};
