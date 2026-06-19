import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  attachment: {
    findUnique: vi.fn(),
    delete: vi.fn()
  }
}));
const attachmentAccessMock = vi.hoisted(() => ({
  findAttachmentWithComment: vi.fn(),
  findCommentWithTask: vi.fn(),
  canAccessAttachment: vi.fn()
}));

vi.mock("../lib/prisma.js", () => ({ prisma: prismaMock }));
vi.mock("../lib/attachmentAccess.js", () => attachmentAccessMock);
vi.mock("../middleware/auth.js", () => ({
  getAuthUser: () => ({ id: "user-1", role: "DESIGNER" })
}));
vi.mock("node:fs/promises", () => ({
  default: {
    unlink: vi.fn(),
    access: vi.fn()
  }
}));

import {
  deleteAttachment,
  downloadAttachment,
  serveAttachment
} from "./uploads.controller.js";

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

describe("attachment delivery", () => {
  const next = vi.fn() as NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    attachmentAccessMock.findAttachmentWithComment.mockResolvedValue({
      id: "attachment-1",
      filename: "Indeferimento SumÃ¡rio.pdf",
      storedAs: "stored.pdf",
      mimeType: "application/pdf"
    });
    attachmentAccessMock.canAccessAttachment.mockResolvedValue(true);
  });

  function responseMock() {
    return {
      setHeader: vi.fn(),
      sendFile: vi.fn()
    } as unknown as Response;
  }

  it("serve visualização inline com nome Unicode corrigido", async () => {
    const response = responseMock();

    await serveAttachment(
      { params: { id: "attachment-1" } } as unknown as Request,
      response,
      next
    );

    expect(response.setHeader).toHaveBeenCalledWith(
      "Content-Disposition",
      "inline; filename=\"Indeferimento Sumario.pdf\"; filename*=UTF-8''Indeferimento%20Sum%C3%A1rio.pdf"
    );
  });

  it("força download com nome Unicode corrigido", async () => {
    const response = responseMock();

    await downloadAttachment(
      { params: { id: "attachment-1" } } as unknown as Request,
      response,
      next
    );

    expect(response.setHeader).toHaveBeenCalledWith(
      "Content-Disposition",
      "attachment; filename=\"Indeferimento Sumario.pdf\"; filename*=UTF-8''Indeferimento%20Sum%C3%A1rio.pdf"
    );
  });
});
