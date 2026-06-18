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
  project: { findUnique: vi.fn() },
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
  createMeetingMinute,
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

  it("pagina e busca anotações, ordenando pela atualização", async () => {
    prismaMock.projectNote.count.mockResolvedValue(12);
    prismaMock.projectNote.findMany.mockResolvedValue([
      {
        id: "note-1",
        projectId: "project-1",
        title: "Decisões",
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
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
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
