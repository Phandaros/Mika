import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const transactionClient = vi.hoisted(() => ({
  projectNote: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    findUniqueOrThrow: vi.fn()
  },
  attachment: {
    createMany: vi.fn()
  }
}));

const prismaMock = vi.hoisted(() => ({
  project: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn() },
  taskActivity: { findMany: vi.fn() },
  task: { findMany: vi.fn() },
  comment: { findMany: vi.fn() },
  projectNote: {
    count: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn()
  },
  meetingMinute: {
    count: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn()
  },
  user: { findMany: vi.fn() },
  $transaction: vi.fn(async (callback: (tx: typeof transactionClient) => unknown) => callback(transactionClient))
}));

vi.mock("../lib/prisma.js", () => ({ prisma: prismaMock }));
vi.mock("../middleware/auth.js", () => ({
  getAuthUser: () => ({ id: "user-1", role: "DESIGNER" })
}));
vi.mock("../lib/attachmentCleanup.js", () => ({
  deleteAttachmentsFromDisk: vi.fn()
}));

import {
  createProjectNote,
  createMeetingMinute,
  listProjectLog,
  listProjectTimelineEvents,
  listProjectNotes,
  updateProjectNote
} from "./projectDocuments.controller.js";

const author = {
  id: "user-1",
  asanaGid: null,
  email: "user@mk.test",
  name: "Usuário",
  role: "DESIGNER",
  isActive: true,
  photo21x21: null,
  photo27x27: null,
  photo36x36: null,
  photo60x60: null,
  photo128x128: null,
  photoOriginal: null,
  createdAt: new Date("2026-06-01T12:00:00.000Z"),
  updatedAt: new Date("2026-06-01T12:00:00.000Z")
};

function responseMock() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
    send: vi.fn()
  } as unknown as Response;
}

describe("project documents controller", () => {
  const next = vi.fn() as NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.project.findUnique.mockResolvedValue({ id: "project-1" });
  });

  it("pagina e busca anotações, ordenando pela data da anotação", async () => {
    prismaMock.projectNote.count.mockResolvedValue(12);
    prismaMock.projectNote.findMany.mockResolvedValue([
      {
        id: "note-1",
        projectId: "project-1",
        title: "Decisões",
        noteDate: "2026-06-01",
        content: "Texto",
        authorId: "user-1",
        author,
        attachments: [],
        createdAt: new Date("2026-06-01T12:00:00.000Z"),
        updatedAt: new Date("2026-06-02T12:00:00.000Z")
      }
    ]);
    const res = responseMock();

    await listProjectNotes(
      {
        params: { projectId: "project-1" },
        query: { page: "2", limit: "5", search: "decisões" }
      } as unknown as Request,
      res,
      next
    );

    expect(prismaMock.projectNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 5,
        take: 5,
        orderBy: [{ noteDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        where: {
          projectId: "project-1",
          OR: [
            { title: { contains: "decisões" } },
            { content: { contains: "decisões" } }
          ]
        }
      })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, limit: 5, total: 12, totalPages: 3 })
    );
  });

  it("retorna conflito quando expectedUpdatedAt não corresponde", async () => {
    transactionClient.projectNote.findUnique.mockResolvedValue({
      id: "note-1",
      updatedAt: new Date("2026-06-18T12:00:00.000Z"),
      _count: { attachments: 0 }
    });
    transactionClient.projectNote.updateMany.mockResolvedValue({ count: 0 });
    const res = responseMock();

    await updateProjectNote(
      {
        params: { id: "note-1" },
        body: {
          title: "Decisões",
          noteDate: "2026-06-18",
          content: "Conteúdo",
          expectedUpdatedAt: "2026-06-18T11:00:00.000Z"
        }
      } as unknown as Request,
      res,
      next
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 409 })
    );
  });

  it("atualiza a data da anotação mantendo o controle de concorrência", async () => {
    const updatedAt = new Date("2026-06-18T12:00:00.000Z");
    transactionClient.projectNote.findUnique.mockResolvedValue({
      id: "note-1",
      updatedAt,
      _count: { attachments: 0 }
    });
    transactionClient.projectNote.updateMany.mockResolvedValue({ count: 1 });
    transactionClient.projectNote.findUniqueOrThrow.mockResolvedValue({
      id: "note-1",
      projectId: "project-1",
      title: "Decisões atualizadas",
      noteDate: "2026-07-01",
      content: "Conteúdo",
      authorId: "user-1",
      author,
      attachments: [],
      createdAt: new Date("2026-06-01T12:00:00.000Z"),
      updatedAt
    });
    const res = responseMock();

    await updateProjectNote(
      {
        params: { id: "note-1" },
        body: {
          title: "Decisões atualizadas",
          noteDate: "2026-07-01",
          content: "Conteúdo",
          expectedUpdatedAt: updatedAt.toISOString()
        }
      } as unknown as Request,
      res,
      next
    );

    expect(transactionClient.projectNote.updateMany).toHaveBeenCalledWith({
      where: { id: "note-1", updatedAt },
      data: { title: "Decisões atualizadas", content: "Conteúdo", noteDate: "2026-07-01" }
    });
    expect(res.json).toHaveBeenCalledWith({ note: expect.objectContaining({ noteDate: "2026-07-01" }) });
  });

  it.each([
    [undefined, "ausente"],
    ["2026-02-30", "inválida"]
  ])("rejeita criação com data %s (%s)", async (noteDate, _description) => {
    const res = responseMock();

    await createProjectNote(
      {
        params: { projectId: "project-1" },
        body: { title: "Decisões", content: "Conteúdo", noteDate }
      } as unknown as Request,
      res,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ name: "ZodError" }));
    expect(prismaMock.projectNote.create).not.toHaveBeenCalled();
  });

  it("aceita data futura ao criar uma anotação", async () => {
    prismaMock.projectNote.create.mockResolvedValue({
      id: "note-future",
      projectId: "project-1",
      title: "Marco futuro",
      noteDate: "2030-01-15",
      content: "Conteúdo",
      authorId: "user-1",
      author,
      attachments: [],
      createdAt: new Date("2026-06-01T12:00:00.000Z"),
      updatedAt: new Date("2026-06-01T12:00:00.000Z")
    });
    const res = responseMock();

    await createProjectNote(
      {
        params: { projectId: "project-1" },
        body: { title: "Marco futuro", content: "Conteúdo", noteDate: "2030-01-15" }
      } as unknown as Request,
      res,
      next
    );

    expect(prismaMock.projectNote.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ noteDate: "2030-01-15" })
    }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("une anotações e atas na linha do tempo em ordem cronológica", async () => {
    prismaMock.projectNote.findMany.mockResolvedValue([{
      id: "note-1",
      projectId: "project-1",
      title: "Anotação",
      noteDate: "2026-06-20",
      author,
      createdAt: new Date("2026-06-18T12:00:00.000Z"),
      updatedAt: new Date("2026-06-18T12:00:00.000Z")
    }]);
    prismaMock.meetingMinute.findMany.mockResolvedValue([{
      id: "minute-1",
      projectId: "project-1",
      title: "Ata",
      meetingDate: "2026-06-19",
      author,
      createdAt: new Date("2026-06-19T12:00:00.000Z"),
      updatedAt: new Date("2026-06-19T12:00:00.000Z")
    }]);
    const res = responseMock();

    await listProjectTimelineEvents(
      { params: { projectId: "project-1" } } as unknown as Request,
      res,
      next
    );

    expect(res.json).toHaveBeenCalledWith({ events: [
      expect.objectContaining({ id: "minute-1", type: "MEETING_MINUTE", eventDate: "2026-06-19" }),
      expect.objectContaining({ id: "note-1", type: "NOTE", eventDate: "2026-06-20" })
    ] });
  });

  it("mescla histórico de tarefas, comentários e entradas manuais no log com cursor", async () => {
    const task = { id: "task-1", name: "Planta baixa", deletedAt: null };
    prismaMock.project.findUniqueOrThrow.mockResolvedValue({ asanaGid: "gid-1" });
    prismaMock.taskActivity.findMany.mockResolvedValue([
      {
        id: "act-1",
        taskId: "task-1",
        actorId: "user-1",
        type: "COMPLETED",
        field: "completed",
        fromValue: "false",
        toValue: "true",
        metadataJson: null,
        createdAt: new Date("2026-06-10T15:00:00.000Z"),
        actor: author,
        task
      }
    ]);
    prismaMock.task.findMany.mockImplementation(async (args: { where: Record<string, unknown> }) =>
      "asanaCreatedAt" in args.where && args.where.asanaCreatedAt !== null
        ? [{ ...task, asanaCreatedAt: new Date("2026-06-01T09:00:00.000Z"), createdAt: new Date(), creator: null }]
        : []
    );
    prismaMock.comment.findMany.mockImplementation(async (args: { where: Record<string, unknown> }) =>
      args.where.asanaCreatedAt === null
        ? [
            {
              id: "comment-1",
              content: "Revisar cotas",
              createdAt: new Date("2026-06-05T10:00:00.000Z"),
              asanaCreatedAt: null,
              author,
              task
            }
          ]
        : []
    );
    prismaMock.projectNote.findMany.mockResolvedValue([
      {
        id: "note-1",
        projectId: "project-1",
        title: "Visita à obra",
        noteDate: "2026-06-08",
        content: "Fotos",
        authorId: "user-1",
        author,
        attachments: [],
        createdAt: new Date("2026-06-08T18:00:00.000Z"),
        updatedAt: new Date("2026-06-08T18:00:00.000Z")
      }
    ]);
    prismaMock.meetingMinute.findMany.mockResolvedValue([]);
    const res = responseMock();

    await listProjectLog(
      { params: { projectId: "project-1" }, query: { limit: "3" } } as unknown as Request,
      res,
      next
    );

    const payload = vi.mocked(res.json).mock.calls[0]?.[0] as {
      entries: Array<{ id: string; type: string; derived: boolean }>;
      nextCursor: string | null;
    };
    expect(payload.entries.map((entry) => [entry.type, entry.id])).toEqual([
      ["TASK_COMPLETED", "activity:act-1"],
      ["NOTE", "note:note-1"],
      ["TASK_COMMENT", "comment:comment-1"]
    ]);
    expect(payload.nextCursor).toBe("2026-06-05T10:00:00.000Z|comment:comment-1");
    expect(prismaMock.taskActivity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ task: { memberships: { some: { projectGid: "gid-1" } } } })
      })
    );

    vi.mocked(res.json).mockClear();
    await listProjectLog(
      { params: { projectId: "project-1" }, query: { limit: "3", cursor: payload.nextCursor } } as unknown as Request,
      res,
      next
    );

    const secondPage = vi.mocked(res.json).mock.calls[0]?.[0] as typeof payload;
    expect(secondPage.entries).toEqual([
      expect.objectContaining({ id: "task-created:task-1", type: "TASK_CREATED", derived: true })
    ]);
    expect(secondPage.nextCursor).toBeNull();
  });

  it("trata status Finalizado como conclusão e não duplica a conclusão pelo botão", async () => {
    const task = { id: "task-1", name: "Planta baixa", deletedAt: null };
    const activity = (id: string, type: string, field: string, fromValue: string, toValue: string, at: string) => ({
      id,
      taskId: "task-1",
      actorId: "user-1",
      type,
      field,
      fromValue,
      toValue,
      metadataJson: null,
      createdAt: new Date(at),
      actor: author,
      task
    });
    prismaMock.project.findUniqueOrThrow.mockResolvedValue({ asanaGid: "gid-1" });
    prismaMock.taskActivity.findMany.mockResolvedValue([
      activity("act-3", "UPDATED", "status", "IN_ANALYSIS", "FINISHED", "2026-06-10T15:00:00.400Z"),
      activity("act-2", "COMPLETED", "completed", "false", "true", "2026-06-10T15:00:00.300Z"),
      activity("act-1", "UPDATED", "status", "FINISHED", "IN_PROGRESS", "2026-06-09T12:00:00.000Z")
    ]);
    prismaMock.task.findMany.mockResolvedValue([]);
    prismaMock.comment.findMany.mockResolvedValue([]);
    prismaMock.projectNote.findMany.mockResolvedValue([]);
    prismaMock.meetingMinute.findMany.mockResolvedValue([]);
    const res = responseMock();

    await listProjectLog({ params: { projectId: "project-1" }, query: {} } as unknown as Request, res, next);

    const payload = vi.mocked(res.json).mock.calls[0]?.[0] as { entries: Array<{ id: string; type: string }> };
    expect(payload.entries.map((entry) => [entry.type, entry.id])).toEqual([
      ["TASK_COMPLETED", "activity:act-3"],
      ["TASK_REOPENED", "activity:act-1"]
    ]);
  });

  it("consulta apenas as fontes dos tipos filtrados no log", async () => {
    prismaMock.project.findUniqueOrThrow.mockResolvedValue({ asanaGid: "gid-1" });
    prismaMock.projectNote.findMany.mockResolvedValue([]);
    const res = responseMock();

    await listProjectLog(
      { params: { projectId: "project-1" }, query: { types: "NOTE" } } as unknown as Request,
      res,
      next
    );

    expect(prismaMock.taskActivity.findMany).not.toHaveBeenCalled();
    expect(prismaMock.task.findMany).not.toHaveBeenCalled();
    expect(prismaMock.comment.findMany).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ entries: [], nextCursor: null });
  });

  it("rejeita a linha do tempo de um projeto inexistente", async () => {
    prismaMock.project.findUnique.mockResolvedValue(null);
    const res = responseMock();

    await listProjectTimelineEvents(
      { params: { projectId: "missing" } } as unknown as Request,
      res,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    expect(prismaMock.projectNote.findMany).not.toHaveBeenCalled();
  });

  it("remove participantes duplicados ao criar uma ata", async () => {
    prismaMock.user.findMany.mockResolvedValue([{ id: "user-1" }, { id: "user-2" }]);
    prismaMock.meetingMinute.create.mockImplementation(async ({ data }: { data: {
      participants: { create: Array<{ userId: string }> };
    } }) => ({
      id: "minute-1",
      projectId: "project-1",
      title: "Reunião de compatibilização",
      meetingDate: "2026-06-18",
      meetingTime: null,
      content: "Decisões",
      externalParticipants: ["Cliente"],
      authorId: "user-1",
      author,
      participants: data.participants.create.map((item, index) => ({
        id: `participant-${index}`,
        userId: item.userId,
        user: { ...author, id: item.userId }
      })),
      attachments: [],
      createdAt: new Date("2026-06-18T12:00:00.000Z"),
      updatedAt: new Date("2026-06-18T12:00:00.000Z")
    }));
    const res = responseMock();

    await createMeetingMinute(
      {
        params: { projectId: "project-1" },
        body: {
          title: "Reunião de compatibilização",
          meetingDate: "2026-06-18",
          meetingTime: "",
          content: "Decisões",
          participantUserIds: JSON.stringify(["user-1", "user-1", "user-2"]),
          externalParticipants: JSON.stringify(["Cliente"])
        }
      } as unknown as Request,
      res,
      next
    );

    const createCall = prismaMock.meetingMinute.create.mock.calls[0]?.[0] as {
      data: { participants: { create: Array<{ userId: string }> } };
    };
    expect(createCall.data.participants.create).toEqual([
      { userId: "user-1" },
      { userId: "user-2" }
    ]);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
