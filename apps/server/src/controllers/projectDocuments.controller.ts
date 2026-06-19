import fs from "node:fs/promises";
import type { RequestHandler } from "express";
import type {
  AttachmentDto,
  MeetingMinuteDto,
  ProjectNoteDto,
  User
} from "shared";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { toPublicUser, userSelect } from "../lib/asanaDto.js";
import { deleteAttachmentsFromDisk } from "../lib/attachmentCleanup.js";
import { normalizeAttachmentFilename } from "../lib/attachmentFilename.js";
import { getAuthUser } from "../middleware/auth.js";
import { AppError } from "../middleware/errorHandler.js";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(25),
  search: z.string().trim().max(200).optional().default("")
});

const noteSchema = z.object({
  title: z.string().trim().min(2).max(200),
  content: z.string().trim().max(100_000).nullable().optional()
});

const meetingMinuteSchema = noteSchema.extend({
  meetingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  meetingTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  participantUserIds: z.array(z.string().min(1)).max(100).default([]),
  externalParticipants: z.array(z.string().trim().min(1).max(120)).max(100).default([])
});

const expectedUpdatedAtSchema = z.string().datetime();

const attachmentInclude = {
  uploadedBy: { select: { id: true, name: true } }
} as const;

const documentInclude = {
  author: { select: userSelect },
  attachments: {
    include: attachmentInclude,
    orderBy: { createdAt: "asc" as const }
  }
} as const;

const meetingMinuteInclude = {
  ...documentInclude,
  participants: {
    include: { user: { select: userSelect } },
    orderBy: { user: { name: "asc" as const } }
  }
} as const;

function uploadedFiles(req: Parameters<RequestHandler>[0]): Express.Multer.File[] {
  return Array.isArray(req.files) ? req.files : [];
}

async function removeUploadedFiles(files: Express.Multer.File[]): Promise<void> {
  await Promise.all(files.map((file) => fs.unlink(file.path).catch(() => undefined)));
}

function parseJsonArray(value: unknown, field: string): unknown[] {
  if (value === undefined || value === null || value === "") {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string") {
    throw new AppError(400, `Campo ${field} inválido`);
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error("not-array");
    }
    return parsed;
  } catch {
    throw new AppError(400, `Campo ${field} inválido`);
  }
}

function parseNoteBody(body: Record<string, unknown>) {
  return noteSchema.parse({
    title: body.title,
    content: body.content === "" ? null : body.content
  });
}

function parseMeetingMinuteBody(body: Record<string, unknown>) {
  return meetingMinuteSchema.parse({
    title: body.title,
    content: body.content === "" ? null : body.content,
    meetingDate: body.meetingDate,
    meetingTime: body.meetingTime === "" ? null : body.meetingTime,
    participantUserIds: parseJsonArray(body.participantUserIds, "participantUserIds"),
    externalParticipants: parseJsonArray(body.externalParticipants, "externalParticipants")
  });
}

function requireContent(content: string | null | undefined, attachmentCount: number): void {
  if (!content?.trim() && attachmentCount === 0) {
    throw new AppError(400, "Informe um conteúdo markdown ou adicione pelo menos um anexo");
  }
}

function toAttachmentDto(attachment: {
  id: string;
  commentId: string | null;
  projectNoteId: string | null;
  meetingMinuteId: string | null;
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
    projectNoteId: attachment.projectNoteId,
    meetingMinuteId: attachment.meetingMinuteId,
    filename: normalizeAttachmentFilename(attachment.filename),
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    uploadedById: attachment.uploadedById,
    uploadedBy: attachment.uploadedBy,
    createdAt: attachment.createdAt.toISOString()
  };
}

function toProjectNoteDto(note: {
  id: string;
  projectId: string;
  title: string;
  content: string | null;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
  author: Parameters<typeof toPublicUser>[0];
  attachments: Array<Parameters<typeof toAttachmentDto>[0]>;
}): ProjectNoteDto {
  const author = toDocumentUser(note.author);
  return {
    id: note.id,
    projectId: note.projectId,
    title: note.title,
    content: note.content,
    authorId: note.authorId,
    author,
    attachments: note.attachments.map(toAttachmentDto),
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString()
  };
}

function externalParticipantNames(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function toMeetingMinuteDto(minute: {
  id: string;
  projectId: string;
  title: string;
  meetingDate: string;
  meetingTime: string | null;
  content: string | null;
  externalParticipants: unknown;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
  author: Parameters<typeof toPublicUser>[0];
  attachments: Array<Parameters<typeof toAttachmentDto>[0]>;
  participants: Array<{
    id: string;
    userId: string;
    user: Parameters<typeof toPublicUser>[0];
  }>;
}): MeetingMinuteDto {
  const author = toDocumentUser(minute.author);
  return {
    id: minute.id,
    projectId: minute.projectId,
    title: minute.title,
    meetingDate: minute.meetingDate,
    meetingTime: minute.meetingTime,
    content: minute.content,
    externalParticipants: externalParticipantNames(minute.externalParticipants),
    authorId: minute.authorId,
    author,
    participants: minute.participants.map((participant) => ({
      id: participant.id,
      userId: participant.userId,
      user: toDocumentUser(participant.user)
    })),
    attachments: minute.attachments.map(toAttachmentDto),
    createdAt: minute.createdAt.toISOString(),
    updatedAt: minute.updatedAt.toISOString()
  };
}

function toDocumentUser(user: Parameters<typeof toPublicUser>[0]): User {
  const publicUser = toPublicUser(user);
  if (!publicUser) {
    throw new AppError(500, "Usuário relacionado ao documento não encontrado");
  }

  return {
    ...publicUser,
    role: publicUser.role as User["role"],
    createdAt: publicUser.createdAt.toISOString(),
    updatedAt: publicUser.updatedAt.toISOString()
  };
}

async function requireProject(projectId: string | undefined): Promise<string> {
  if (!projectId) {
    throw new AppError(400, "ID do projeto é obrigatório");
  }

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) {
    throw new AppError(404, "Projeto não encontrado");
  }
  return project.id;
}

function createAttachmentData(
  files: Express.Multer.File[],
  uploadedById: string,
  owner: { projectNoteId?: string; meetingMinuteId?: string }
) {
  return files.map((file) => ({
    filename: file.originalname,
    storedAs: file.filename,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    uploadedById,
    ...owner
  }));
}

async function validateParticipantUsers(
  participantUserIds: string[],
  client: Pick<typeof prisma, "user">
): Promise<string[]> {
  const uniqueIds = [...new Set(participantUserIds)];
  if (!uniqueIds.length) {
    return uniqueIds;
  }

  const users = await client.user.findMany({
    where: { id: { in: uniqueIds }, isActive: true },
    select: { id: true }
  });
  if (users.length !== uniqueIds.length) {
    throw new AppError(400, "Um ou mais participantes internos são inválidos");
  }
  return uniqueIds;
}

export const listProjectNotes: RequestHandler = async (req, res, next) => {
  try {
    const projectId = await requireProject(req.params.projectId);
    const query = paginationSchema.parse(req.query);
    const where = {
      projectId,
      ...(query.search
        ? { OR: [{ title: { contains: query.search } }, { content: { contains: query.search } }] }
        : {})
    };
    const [total, notes] = await Promise.all([
      prisma.projectNote.count({ where }),
      prisma.projectNote.findMany({
        where,
        include: documentInclude,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit
      })
    ]);

    res.json({
      items: notes.map(toProjectNoteDto),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit)
    });
  } catch (error) {
    next(error);
  }
};

export const getProjectNote: RequestHandler = async (req, res, next) => {
  try {
    const note = await prisma.projectNote.findUnique({ where: { id: req.params.id }, include: documentInclude });
    if (!note) {
      throw new AppError(404, "Anotação não encontrada");
    }
    res.json({ note: toProjectNoteDto(note) });
  } catch (error) {
    next(error);
  }
};

export const createProjectNote: RequestHandler = async (req, res, next) => {
  const files = uploadedFiles(req);
  try {
    const projectId = await requireProject(req.params.projectId);
    const body = parseNoteBody(req.body as Record<string, unknown>);
    requireContent(body.content, files.length);
    const authUser = getAuthUser(req);
    const note = await prisma.projectNote.create({
      data: {
        projectId,
        title: body.title,
        content: body.content || null,
        authorId: authUser.id,
        attachments: {
          create: createAttachmentData(files, authUser.id, {})
        }
      },
      include: documentInclude
    });
    res.status(201).json({ note: toProjectNoteDto(note) });
  } catch (error) {
    await removeUploadedFiles(files);
    next(error);
  }
};

export const updateProjectNote: RequestHandler = async (req, res, next) => {
  const files = uploadedFiles(req);
  try {
    const body = parseNoteBody(req.body as Record<string, unknown>);
    const expectedUpdatedAt = expectedUpdatedAtSchema.parse(req.body.expectedUpdatedAt);
    const authUser = getAuthUser(req);
    const note = await prisma.$transaction(async (tx) => {
      const existing = await tx.projectNote.findUnique({
        where: { id: req.params.id },
        select: { id: true, updatedAt: true, _count: { select: { attachments: true } } }
      });
      if (!existing) {
        throw new AppError(404, "Anotação não encontrada");
      }
      requireContent(body.content, existing._count.attachments + files.length);
      const updated = await tx.projectNote.updateMany({
        where: { id: existing.id, updatedAt: new Date(expectedUpdatedAt) },
        data: { title: body.title, content: body.content || null }
      });
      if (updated.count === 0) {
        throw new AppError(409, "Esta anotação foi alterada por outra pessoa");
      }
      if (files.length) {
        await tx.attachment.createMany({
          data: createAttachmentData(files, authUser.id, { projectNoteId: existing.id })
        });
      }
      return tx.projectNote.findUniqueOrThrow({ where: { id: existing.id }, include: documentInclude });
    });
    res.json({ note: toProjectNoteDto(note) });
  } catch (error) {
    await removeUploadedFiles(files);
    next(error);
  }
};

export const deleteProjectNote: RequestHandler = async (req, res, next) => {
  try {
    const note = await prisma.projectNote.findUnique({
      where: { id: req.params.id },
      include: { attachments: { select: { storedAs: true } } }
    });
    if (!note) {
      throw new AppError(404, "Anotação não encontrada");
    }
    await deleteAttachmentsFromDisk(note.attachments);
    await prisma.projectNote.delete({ where: { id: note.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const listMeetingMinutes: RequestHandler = async (req, res, next) => {
  try {
    const projectId = await requireProject(req.params.projectId);
    const query = paginationSchema.parse(req.query);
    const where = {
      projectId,
      ...(query.search
        ? { OR: [{ title: { contains: query.search } }, { content: { contains: query.search } }] }
        : {})
    };
    const [total, minutes] = await Promise.all([
      prisma.meetingMinute.count({ where }),
      prisma.meetingMinute.findMany({
        where,
        include: meetingMinuteInclude,
        orderBy: [{ meetingDate: "desc" }, { meetingTime: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit
      })
    ]);
    res.json({
      items: minutes.map(toMeetingMinuteDto),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit)
    });
  } catch (error) {
    next(error);
  }
};

export const getMeetingMinute: RequestHandler = async (req, res, next) => {
  try {
    const minute = await prisma.meetingMinute.findUnique({
      where: { id: req.params.id },
      include: meetingMinuteInclude
    });
    if (!minute) {
      throw new AppError(404, "Ata de reunião não encontrada");
    }
    res.json({ meetingMinute: toMeetingMinuteDto(minute) });
  } catch (error) {
    next(error);
  }
};

export const createMeetingMinute: RequestHandler = async (req, res, next) => {
  const files = uploadedFiles(req);
  try {
    const projectId = await requireProject(req.params.projectId);
    const body = parseMeetingMinuteBody(req.body as Record<string, unknown>);
    requireContent(body.content, files.length);
    const authUser = getAuthUser(req);
    const participantUserIds = await validateParticipantUsers(body.participantUserIds, prisma);
    const minute = await prisma.meetingMinute.create({
      data: {
        projectId,
        title: body.title,
        meetingDate: body.meetingDate,
        meetingTime: body.meetingTime || null,
        content: body.content || null,
        externalParticipants: body.externalParticipants,
        authorId: authUser.id,
        participants: {
          create: participantUserIds.map((userId) => ({ userId }))
        },
        attachments: {
          create: createAttachmentData(files, authUser.id, {})
        }
      },
      include: meetingMinuteInclude
    });
    res.status(201).json({ meetingMinute: toMeetingMinuteDto(minute) });
  } catch (error) {
    await removeUploadedFiles(files);
    next(error);
  }
};

export const updateMeetingMinute: RequestHandler = async (req, res, next) => {
  const files = uploadedFiles(req);
  try {
    const body = parseMeetingMinuteBody(req.body as Record<string, unknown>);
    const expectedUpdatedAt = expectedUpdatedAtSchema.parse(req.body.expectedUpdatedAt);
    const authUser = getAuthUser(req);
    const minute = await prisma.$transaction(async (tx) => {
      const existing = await tx.meetingMinute.findUnique({
        where: { id: req.params.id },
        select: { id: true, updatedAt: true, _count: { select: { attachments: true } } }
      });
      if (!existing) {
        throw new AppError(404, "Ata de reunião não encontrada");
      }
      requireContent(body.content, existing._count.attachments + files.length);
      const updated = await tx.meetingMinute.updateMany({
        where: { id: existing.id, updatedAt: new Date(expectedUpdatedAt) },
        data: {
          title: body.title,
          meetingDate: body.meetingDate,
          meetingTime: body.meetingTime || null,
          content: body.content || null,
          externalParticipants: body.externalParticipants
        }
      });
      if (updated.count === 0) {
        throw new AppError(409, "Esta ata foi alterada por outra pessoa");
      }
      await tx.meetingMinuteParticipant.deleteMany({ where: { meetingMinuteId: existing.id } });
      const participantUserIds = await validateParticipantUsers(body.participantUserIds, tx);
      if (participantUserIds.length) {
        await tx.meetingMinuteParticipant.createMany({
          data: participantUserIds.map((userId) => ({ meetingMinuteId: existing.id, userId }))
        });
      }
      if (files.length) {
        await tx.attachment.createMany({
          data: createAttachmentData(files, authUser.id, { meetingMinuteId: existing.id })
        });
      }
      return tx.meetingMinute.findUniqueOrThrow({ where: { id: existing.id }, include: meetingMinuteInclude });
    });
    res.json({ meetingMinute: toMeetingMinuteDto(minute) });
  } catch (error) {
    await removeUploadedFiles(files);
    next(error);
  }
};

export const deleteMeetingMinute: RequestHandler = async (req, res, next) => {
  try {
    const minute = await prisma.meetingMinute.findUnique({
      where: { id: req.params.id },
      include: { attachments: { select: { storedAs: true } } }
    });
    if (!minute) {
      throw new AppError(404, "Ata de reunião não encontrada");
    }
    await deleteAttachmentsFromDisk(minute.attachments);
    await prisma.meetingMinute.delete({ where: { id: minute.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
