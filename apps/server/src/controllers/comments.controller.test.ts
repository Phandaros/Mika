import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../middleware/errorHandler.js";

const prismaMock = vi.hoisted(() => {
  const client = {
    comment: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    commentRevision: {
      create: vi.fn(),
      findMany: vi.fn()
    },
    attachment: {
      updateMany: vi.fn()
    },
    task: {
      findUnique: vi.fn()
    },
    $transaction: vi.fn()
  };

  client.$transaction.mockImplementation((callback: (tx: typeof client) => unknown) => callback(client));

  return client;
});

const notifyMock = vi.hoisted(() => ({
  commentNotificationMessage: vi.fn(() => "mensagem"),
  createAndEmitNotification: vi.fn()
}));

vi.mock("../lib/prisma.js", () => ({ prisma: prismaMock }));
vi.mock("../lib/notify.js", () => notifyMock);
vi.mock("../middleware/auth.js", () => ({
  getAuthUser: (req: Request & { authUser: unknown }) => req.authUser
}));

const { deleteComment, updateComment } = await import("./comments.controller.js");

const HOUR_MS = 60 * 60 * 1000;
const updatedAt = new Date("2026-11-06T10:00:00.000Z");

function existingComment(ageMs: number, content = "Texto original") {
  return {
    id: "comment-1",
    taskId: "task-1",
    authorId: "designer",
    createdAt: new Date(Date.now() - ageMs),
    updatedAt,
    content
  };
}

function savedComment(content: string) {
  return {
    ...existingComment(0, content),
    asanaGid: null,
    asanaCreatedAt: null,
    author: null,
    attachments: [],
    editedAt: new Date(),
    editedBy: { id: "designer", name: "Projetista" }
  };
}

function request(body: unknown, role = "DESIGNER", userId = "designer") {
  return {
    params: { id: "comment-1" },
    body,
    authUser: { id: userId, role }
  } as unknown as Request;
}

function response() {
  const res = { json: vi.fn(), status: vi.fn(), send: vi.fn() };
  res.status.mockReturnValue(res);
  return res as unknown as Response & typeof res;
}

async function run(handler: typeof updateComment, req: Request, res: Response) {
  const next = vi.fn() as unknown as NextFunction & ReturnType<typeof vi.fn>;
  await handler(req, res, next);
  return next.mock.calls[0]?.[0] as AppError | undefined;
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation((callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock));
  prismaMock.comment.update.mockImplementation(({ data }: { data: { content: string } }) => savedComment(data.content));
  prismaMock.commentRevision.create.mockResolvedValue({ id: "revision-1" });
  prismaMock.task.findUnique.mockResolvedValue({ id: "task-1", name: "Tarefa", deletedAt: null });
});

describe("updateComment", () => {
  it("stores the previous content and who edited", async () => {
    prismaMock.comment.findUnique.mockResolvedValue(existingComment(HOUR_MS));

    const error = await run(updateComment, request({ content: "Texto novo" }), response());

    expect(error).toBeUndefined();
    expect(prismaMock.commentRevision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "EDITED", content: "Texto original", actorId: "designer" })
    });
    expect(prismaMock.comment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ content: "Texto novo", editedById: "designer" }) })
    );
  });

  it("does not create a version when nothing changed", async () => {
    prismaMock.comment.findUnique.mockResolvedValue(existingComment(HOUR_MS));
    prismaMock.comment.findUniqueOrThrow.mockResolvedValue(savedComment("Texto original"));

    await run(updateComment, request({ content: "Texto original" }), response());

    expect(prismaMock.comment.update).not.toHaveBeenCalled();
    expect(prismaMock.commentRevision.create).not.toHaveBeenCalled();
  });

  it("accepts an edit inside the 15 minute grace period", async () => {
    prismaMock.comment.findUnique.mockResolvedValue(existingComment(2 * HOUR_MS + 5 * 60 * 1000));

    expect(await run(updateComment, request({ content: "Texto novo" }), response())).toBeUndefined();
  });

  it("rejects an edit after the grace period", async () => {
    prismaMock.comment.findUnique.mockResolvedValue(existingComment(2 * HOUR_MS + 16 * 60 * 1000));

    const error = await run(updateComment, request({ content: "Texto novo" }), response());

    expect(error?.statusCode).toBe(403);
    expect(prismaMock.comment.update).not.toHaveBeenCalled();
  });

  it("explains that only the author can edit a colleague's comment", async () => {
    prismaMock.comment.findUnique.mockResolvedValue(existingComment(HOUR_MS));

    const error = await run(updateComment, request({ content: "Texto novo" }, "DESIGNER", "colega"), response());

    expect(error?.statusCode).toBe(403);
    expect(error?.message).toBe("Você não tem permissão para editar este comentário");
  });

  it("returns 409 when the comment changed since the edit started", async () => {
    prismaMock.comment.findUnique.mockResolvedValue(existingComment(HOUR_MS));

    const error = await run(
      updateComment,
      request({ content: "Texto novo", expectedUpdatedAt: "2026-11-06T09:00:00.000Z" }),
      response()
    );

    expect(error?.statusCode).toBe(409);
    expect(prismaMock.comment.update).not.toHaveBeenCalled();
  });

  it("rejects local image links", async () => {
    prismaMock.comment.findUnique.mockResolvedValue(existingComment(HOUR_MS));

    const error = await run(updateComment, request({ content: "![a](blob:http://x/1)" }), response());

    expect(error?.statusCode).toBe(400);
  });

  it("notifies only people mentioned for the first time", async () => {
    const previous = "Olá @[João](mk://user/user-1)";
    prismaMock.comment.findUnique.mockResolvedValue(existingComment(HOUR_MS, previous));

    await run(updateComment, request({ content: `${previous} e @[Maria](mk://user/user-2)` }), response());

    expect(notifyMock.createAndEmitNotification).toHaveBeenCalledTimes(1);
    expect(notifyMock.createAndEmitNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-2" }));
  });
});

describe("deleteComment", () => {
  it("keeps the content and attachments in the history", async () => {
    prismaMock.comment.findUnique.mockResolvedValue(existingComment(HOUR_MS));
    const res = response();

    expect(await run(deleteComment, request({}), res)).toBeUndefined();

    expect(prismaMock.commentRevision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "DELETED", content: "Texto original" })
    });
    expect(prismaMock.attachment.updateMany).toHaveBeenCalledWith({
      where: { commentId: "comment-1" },
      data: { commentId: null, commentRevisionId: "revision-1" }
    });
    expect(prismaMock.comment.delete).toHaveBeenCalledWith({ where: { id: "comment-1" } });
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("does not apply the edit grace period to deletions", async () => {
    prismaMock.comment.findUnique.mockResolvedValue(existingComment(2 * HOUR_MS + 5 * 60 * 1000));

    const error = await run(deleteComment, request({}), response());

    expect(error?.statusCode).toBe(403);
    expect(prismaMock.comment.delete).not.toHaveBeenCalled();
  });
});
