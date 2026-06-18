import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  attachment: {
    findUnique: vi.fn(),
    delete: vi.fn()
  }
}));

vi.mock("../lib/prisma.js", () => ({ prisma: prismaMock }));
vi.mock("../middleware/auth.js", () => ({
  getAuthUser: () => ({ id: "user-1", role: "DESIGNER" })
}));
vi.mock("node:fs/promises", () => ({
  default: {
    unlink: vi.fn(),
    access: vi.fn()
  }
}));

import { deleteAttachment } from "./uploads.controller.js";

describe("document attachment deletion", () => {
  const next = vi.fn() as NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("impede remover o último conteúdo de uma anotação sem markdown", async () => {
    prismaMock.attachment.findUnique.mockResolvedValue({
      id: "attachment-1",
      storedAs: "stored.pdf",
      uploadedById: "user-2",
      projectNote: {
        content: null,
        _count: { attachments: 1 }
      },
      meetingMinute: null
    });

    await deleteAttachment(
      { params: { id: "attachment-1" } } as unknown as Request,
      { status: vi.fn().mockReturnThis(), send: vi.fn() } as unknown as Response,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    expect(prismaMock.attachment.delete).not.toHaveBeenCalled();
  });
});
