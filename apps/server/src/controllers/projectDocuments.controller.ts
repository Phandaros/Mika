import fs from "node:fs/promises";
import type { RequestHandler } from "express";
import type {
  AttachmentDto,
  MeetingMinuteDto,
  ProjectLogEntryDto,
  ProjectLogEntryType,
  ProjectNoteDto,
  ProjectTimelineEventDto,
  User
} from "shared";
import { z } from "zod";
import type { Prisma } from "../generated/prisma/client.js";
import { TaskStatus } from "../lib/enums.js";
import { prisma } from "../lib/prisma.js";
import { toPublicUser, userSelect } from "../lib/asanaDto.js";
import { deleteAttachmentsFromDisk } from "../lib/attachmentCleanup.js";
import { normalizeAttachmentFilename } from "../lib/attachmentFilename.js";
import { taskActivityTypes } from "../lib/taskActivity.js";
import { getAuthUser } from "../middleware/auth.js";
import { AppError } from "../middleware/errorHandler.js";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(25),
  search: z.string().trim().max(200).optional().default("")
});

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Data inválida");

const documentSchema = z.object({
  title: z.string().trim().min(2).max(200),
  content: z.string().trim().max(100_000).nullable().optional()
});

const noteSchema = documentSchema.extend({
  noteDate: dateOnlySchema
});

const meetingMinuteSchema = documentSchema.extend({
  meetingDate: dateOnlySchema,
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
    noteDate: body.noteDate,
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
  noteDate: string;
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
    noteDate: note.noteDate,
    authorId: note.authorId,
    author,
    attachments: note.attachments.map(toAttachmentDto),
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString()
  };
}

function toProjectTimelineEventDto(event: {
  id: string;
  projectId: string;
  type: ProjectTimelineEventDto["type"];
  title: string;
  eventDate: string;
  author: Parameters<typeof toPublicUser>[0];
  createdAt: Date;
  updatedAt: Date;
}): ProjectTimelineEventDto {
  const author = toDocumentUser(event.author);
  return {
    id: event.id,
    projectId: event.projectId,
    type: event.type,
    title: event.title,
    eventDate: event.eventDate,
    author: {
      id: author.id,
      name: author.name,
      avatarUrl: author.avatarUrl
    },
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString()
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

function toLogActor(user: Parameters<typeof toPublicUser>[0] | undefined): ProjectLogEntryDto["actor"] {
  const publicUser = toPublicUser(user);
  return publicUser ? { id: publicUser.id, name: publicUser.name, avatarUrl: publicUser.avatarUrl } : null;
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
        orderBy: [{ noteDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
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

export const listProjectTimelineEvents: RequestHandler = async (req, res, next) => {
  try {
    const projectId = await requireProject(req.params.projectId);
    const [notes, meetingMinutes] = await Promise.all([
      prisma.projectNote.findMany({
        where: { projectId },
        select: {
          id: true,
          projectId: true,
          title: true,
          noteDate: true,
          author: { select: userSelect },
          createdAt: true,
          updatedAt: true
        }
      }),
      prisma.meetingMinute.findMany({
        where: { projectId },
        select: {
          id: true,
          projectId: true,
          title: true,
          meetingDate: true,
          author: { select: userSelect },
          createdAt: true,
          updatedAt: true
        }
      })
    ]);

    const events = [
      ...notes.map((note) => toProjectTimelineEventDto({
        ...note,
        type: "NOTE",
        eventDate: note.noteDate
      })),
      ...meetingMinutes.map((minute) => toProjectTimelineEventDto({
        ...minute,
        type: "MEETING_MINUTE",
        eventDate: minute.meetingDate
      }))
    ].sort((left, right) =>
      left.eventDate.localeCompare(right.eventDate) ||
      left.type.localeCompare(right.type) ||
      left.id.localeCompare(right.id)
    );

    res.json({ events });
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
        noteDate: body.noteDate,
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
        data: { title: body.title, content: body.content || null, noteDate: body.noteDate }
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

const projectLogEntryTypes = [
  "NOTE",
  "MEETING_MINUTE",
  "TASK_CREATED",
  "TASK_COMPLETED",
  "TASK_REOPENED",
  "TASK_UPDATED",
  "TASK_REVIEW",
  "TASK_DELETED",
  "TASK_COMMENT"
] as const satisfies readonly ProjectLogEntryType[];

const projectLogQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(40),
  cursor: z.string().max(200).optional(),
  types: z
    .string()
    .optional()
    .transform((value) => (value ? value.split(",").map((item) => item.trim()).filter(Boolean) : []))
    .pipe(z.array(z.enum(projectLogEntryTypes)))
});

/** Folga para itens com o mesmo timestamp do cursor, descartados em memória após a consulta. */
const PROJECT_LOG_TIE_BUFFER = 50;

interface ProjectLogCursor {
  at: Date;
  id: string;
}

interface ProjectLogCandidate {
  at: Date;
  entry: ProjectLogEntryDto;
}

function parseProjectLogCursor(value: string | undefined): ProjectLogCursor | null {
  if (!value) {
    return null;
  }
  const separator = value.indexOf("|");
  const at = new Date(separator > 0 ? value.slice(0, separator) : "");
  const id = separator > 0 ? value.slice(separator + 1) : "";
  if (Number.isNaN(at.getTime()) || !id) {
    throw new AppError(400, "Cursor inválido");
  }
  return { at, id };
}

function compareLogCandidates(left: ProjectLogCandidate, right: ProjectLogCandidate): number {
  return right.at.getTime() - left.at.getTime() || right.entry.id.localeCompare(left.entry.id);
}

function isAfterCursor(candidate: ProjectLogCandidate, cursor: ProjectLogCursor | null): boolean {
  if (!cursor) {
    return true;
  }
  const delta = candidate.at.getTime() - cursor.at.getTime();
  return delta < 0 || (delta === 0 && candidate.entry.id.localeCompare(cursor.id) < 0);
}

function parseActivityMetadata(value: string | null): Record<string, unknown> | null {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const FINISHED_STATUS: string = TaskStatus.FINISHED;

/** Mudanças de status para/de Finalizado contam como conclusão/reabertura no log. */
const statusFinishedWhere = { type: taskActivityTypes.UPDATED, field: "status", toValue: FINISHED_STATUS };
const statusReopenedWhere = { type: taskActivityTypes.UPDATED, field: "status", fromValue: FINISHED_STATUS };

function activityLogType(activity: { type: string; field: string | null; fromValue: string | null; toValue: string | null }): ProjectLogEntryType {
  switch (activity.type) {
    case taskActivityTypes.CREATED:
      return "TASK_CREATED";
    case taskActivityTypes.COMPLETED:
      return "TASK_COMPLETED";
    case taskActivityTypes.REOPENED:
      return "TASK_REOPENED";
    case taskActivityTypes.REVIEW_REQUESTED:
    case taskActivityTypes.REVIEW_APPROVED:
    case taskActivityTypes.REVIEW_REJECTED:
      return "TASK_REVIEW";
    default:
      if (activity.field === "status" && activity.toValue === FINISHED_STATUS) {
        return "TASK_COMPLETED";
      }
      if (activity.field === "status" && activity.fromValue === FINISHED_STATUS) {
        return "TASK_REOPENED";
      }
      return "TASK_UPDATED";
  }
}

function activityWhereFor(types: Set<ProjectLogEntryType>): Prisma.TaskActivityWhereInput[] {
  const conditions: Prisma.TaskActivityWhereInput[] = [];
  if (types.has("TASK_CREATED")) {
    conditions.push({ type: taskActivityTypes.CREATED });
  }
  if (types.has("TASK_COMPLETED")) {
    conditions.push({ type: taskActivityTypes.COMPLETED }, statusFinishedWhere);
  }
  if (types.has("TASK_REOPENED")) {
    conditions.push({ type: taskActivityTypes.REOPENED }, statusReopenedWhere);
  }
  if (types.has("TASK_REVIEW")) {
    conditions.push({
      type: {
        in: [
          taskActivityTypes.REVIEW_REQUESTED,
          taskActivityTypes.REVIEW_APPROVED,
          taskActivityTypes.REVIEW_REJECTED
        ]
      }
    });
  }
  if (types.has("TASK_UPDATED")) {
    // Forma positiva (sem NOT): em SQL, NOT sobre colunas nulas descartaria a linha.
    conditions.push({
      type: taskActivityTypes.UPDATED,
      OR: [
        { field: null },
        { field: { not: "status" } },
        {
          field: "status",
          AND: [
            { OR: [{ toValue: null }, { toValue: { not: FINISHED_STATUS } }] },
            { OR: [{ fromValue: null }, { fromValue: { not: FINISHED_STATUS } }] }
          ]
        }
      ]
    });
  }
  return conditions;
}

/** Concluir pelo botão grava COMPLETED + mudança de status no mesmo instante: mantém só um registro. */
const COMPLETION_DEDUPE_WINDOW_MS = 5_000;

function dedupeCompletionEntries(ordered: ProjectLogCandidate[]): ProjectLogCandidate[] {
  const lastKept = new Map<string, number>();
  return ordered.filter((candidate) => {
    const { entry } = candidate;
    if ((entry.type !== "TASK_COMPLETED" && entry.type !== "TASK_REOPENED") || !entry.task || entry.derived) {
      return true;
    }
    const key = `${entry.task.id}:${entry.type}`;
    const previous = lastKept.get(key);
    if (previous !== undefined && previous - candidate.at.getTime() <= COMPLETION_DEDUPE_WINDOW_MS) {
      return false;
    }
    lastKept.set(key, candidate.at.getTime());
    return true;
  });
}

function emptyLogEntry(id: string, type: ProjectLogEntryType, at: Date): ProjectLogEntryDto {
  return {
    id,
    type,
    occurredAt: at.toISOString(),
    actor: null,
    task: null,
    activityType: null,
    field: null,
    fromValue: null,
    toValue: null,
    metadata: null,
    note: null,
    meetingMinute: null,
    comment: null,
    derived: false
  };
}

function logTask(task: { id: string; name: string; deletedAt: Date | null }): ProjectLogEntryDto["task"] {
  return { id: task.id, name: task.name, deleted: Boolean(task.deletedAt) };
}

const logTaskSelect = { id: true, name: true, deletedAt: true } as const;

const logCommentSelect = {
  id: true,
  content: true,
  createdAt: true,
  asanaCreatedAt: true,
  author: { select: userSelect },
  task: { select: logTaskSelect }
} as const;

export const listProjectLog: RequestHandler = async (req, res, next) => {
  try {
    const projectId = await requireProject(req.params.projectId);
    const query = projectLogQuerySchema.parse(req.query);
    const cursor = parseProjectLogCursor(query.cursor);
    const types = new Set<ProjectLogEntryType>(query.types.length ? query.types : projectLogEntryTypes);
    const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { asanaGid: true } });
    const take = query.limit + PROJECT_LOG_TIE_BUFFER;
    const upTo = cursor ? { lte: cursor.at } : undefined;
    const taskWhere = { memberships: { some: { projectGid: project.asanaGid } } };
    const activityConditions = activityWhereFor(types);
    const createdTaskSelect = {
      ...logTaskSelect,
      asanaCreatedAt: true,
      createdAt: true,
      creator: { select: userSelect }
    } as const;

    // Tarefas importadas (ou anteriores ao histórico) não têm TaskActivity: o log reconstrói
    // criação/conclusão a partir das datas da própria tarefa, sem duplicar eventos já registrados.
    const [
      activities,
      importedCreatedTasks,
      localCreatedTasks,
      derivedCompletedTasks,
      deletedTasks,
      importedComments,
      localComments,
      notes,
      meetingMinutes
    ] = await Promise.all([
      activityConditions.length
        ? prisma.taskActivity.findMany({
            where: { task: taskWhere, OR: activityConditions, createdAt: upTo },
            include: { actor: { select: userSelect }, task: { select: logTaskSelect } },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take
          })
        : [],
      types.has("TASK_CREATED")
        ? prisma.task.findMany({
            where: {
              ...taskWhere,
              activities: { none: { type: taskActivityTypes.CREATED } },
              asanaCreatedAt: upTo ?? { not: null }
            },
            select: createdTaskSelect,
            orderBy: [{ asanaCreatedAt: "desc" }, { id: "desc" }],
            take
          })
        : [],
      types.has("TASK_CREATED")
        ? prisma.task.findMany({
            where: {
              ...taskWhere,
              activities: { none: { type: taskActivityTypes.CREATED } },
              asanaCreatedAt: null,
              createdAt: upTo
            },
            select: createdTaskSelect,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take
          })
        : [],
      types.has("TASK_COMPLETED")
        ? prisma.task.findMany({
            where: {
              ...taskWhere,
              completed: true,
              activities: { none: { OR: [{ type: taskActivityTypes.COMPLETED }, statusFinishedWhere] } },
              completedAtAsana: upTo ?? { not: null }
            },
            select: { ...logTaskSelect, completedAtAsana: true },
            orderBy: [{ completedAtAsana: "desc" }, { id: "desc" }],
            take
          })
        : [],
      types.has("TASK_DELETED")
        ? prisma.task.findMany({
            where: { ...taskWhere, deletedAt: upTo ?? { not: null } },
            select: { ...logTaskSelect, deletedByUserId: true },
            orderBy: [{ deletedAt: "desc" }, { id: "desc" }],
            take
          })
        : [],
      types.has("TASK_COMMENT")
        ? prisma.comment.findMany({
            where: { task: taskWhere, asanaCreatedAt: upTo ?? { not: null } },
            select: logCommentSelect,
            orderBy: [{ asanaCreatedAt: "desc" }, { id: "desc" }],
            take
          })
        : [],
      types.has("TASK_COMMENT")
        ? prisma.comment.findMany({
            where: { task: taskWhere, asanaCreatedAt: null, createdAt: upTo },
            select: logCommentSelect,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take
          })
        : [],
      types.has("NOTE")
        ? prisma.projectNote.findMany({
            where: { projectId, createdAt: upTo },
            include: documentInclude,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take
          })
        : [],
      types.has("MEETING_MINUTE")
        ? prisma.meetingMinute.findMany({
            where: { projectId, createdAt: upTo },
            select: {
              id: true,
              title: true,
              meetingDate: true,
              meetingTime: true,
              createdAt: true,
              author: { select: userSelect }
            },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take
          })
        : []
    ]);

    const deleterIds = [
      ...new Set(deletedTasks.map((task) => task.deletedByUserId).filter((id): id is string => Boolean(id)))
    ];
    const deleters = deleterIds.length
      ? await prisma.user.findMany({ where: { id: { in: deleterIds } }, select: userSelect })
      : [];
    const deletersById = new Map(deleters.map((user) => [user.id, user]));

    const candidates: ProjectLogCandidate[] = [
      ...activities.map((activity) => ({
        at: activity.createdAt,
        entry: {
          ...emptyLogEntry(`activity:${activity.id}`, activityLogType(activity), activity.createdAt),
          actor: toLogActor(activity.actor),
          task: logTask(activity.task),
          activityType: activity.type,
          field: activity.field,
          fromValue: activity.fromValue,
          toValue: activity.toValue,
          metadata: parseActivityMetadata(activity.metadataJson)
        }
      })),
      ...[...importedCreatedTasks, ...localCreatedTasks].map((task) => {
        const at = task.asanaCreatedAt ?? task.createdAt;
        return {
          at,
          entry: {
            ...emptyLogEntry(`task-created:${task.id}`, "TASK_CREATED", at),
            actor: toLogActor(task.creator),
            task: logTask(task),
            derived: true
          }
        };
      }),
      ...derivedCompletedTasks.flatMap((task) =>
        task.completedAtAsana
          ? [
              {
                at: task.completedAtAsana,
                entry: {
                  ...emptyLogEntry(`task-completed:${task.id}`, "TASK_COMPLETED", task.completedAtAsana),
                  task: logTask(task),
                  derived: true
                }
              }
            ]
          : []
      ),
      ...deletedTasks.flatMap((task) =>
        task.deletedAt
          ? [
              {
                at: task.deletedAt,
                entry: {
                  ...emptyLogEntry(`task-deleted:${task.id}`, "TASK_DELETED", task.deletedAt),
                  actor: toLogActor(task.deletedByUserId ? deletersById.get(task.deletedByUserId) : null),
                  task: logTask(task)
                }
              }
            ]
          : []
      ),
      ...[...importedComments, ...localComments].map((comment) => {
        const at = comment.asanaCreatedAt ?? comment.createdAt;
        return {
          at,
          entry: {
            ...emptyLogEntry(`comment:${comment.id}`, "TASK_COMMENT", at),
            actor: toLogActor(comment.author),
            task: logTask(comment.task),
            comment: { id: comment.id, content: comment.content }
          }
        };
      }),
      ...notes.map((note) => ({
        at: note.createdAt,
        entry: {
          ...emptyLogEntry(`note:${note.id}`, "NOTE", note.createdAt),
          actor: toLogActor(note.author),
          note: toProjectNoteDto(note)
        }
      })),
      ...meetingMinutes.map((minute) => ({
        at: minute.createdAt,
        entry: {
          ...emptyLogEntry(`meeting-minute:${minute.id}`, "MEETING_MINUTE", minute.createdAt),
          actor: toLogActor(minute.author),
          meetingMinute: {
            id: minute.id,
            title: minute.title,
            meetingDate: minute.meetingDate,
            meetingTime: minute.meetingTime
          }
        }
      }))
    ];

    const ordered = dedupeCompletionEntries(
      candidates.filter((candidate) => isAfterCursor(candidate, cursor)).sort(compareLogCandidates)
    );
    const page = ordered.slice(0, query.limit);
    const last = page.at(-1);

    res.json({
      entries: page.map((candidate) => candidate.entry),
      nextCursor: ordered.length > query.limit && last ? `${last.at.toISOString()}|${last.entry.id}` : null
    });
  } catch (error) {
    next(error);
  }
};
