import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../generated/prisma/client.js";
import {
  attachmentContentDisposition,
  normalizeAttachmentFilename,
  repairStoredAttachmentFilenames,
  repairUtf8Mojibake
} from "./attachmentFilename.js";

describe("attachment filenames", () => {
  it("preserva nomes Unicode válidos", () => {
    expect(normalizeAttachmentFilename("Indeferimento Sumário.pdf")).toBe(
      "Indeferimento Sumário.pdf"
    );
  });

  it("recupera UTF-8 interpretado como Latin-1", () => {
    expect(repairUtf8Mojibake("Indeferimento SumÃ¡rio.pdf")).toBe(
      "Indeferimento Sumário.pdf"
    );
    expect(repairUtf8Mojibake("DELIBERAÃ\u0087Ã\u0083O.pdf")).toBe("DELIBERAÇÃO.pdf");
  });

  it("não inventa nomes para UUIDs ou sequências não recuperáveis", () => {
    expect(normalizeAttachmentFilename("4bfeeac9-3e1b-44e6-bac5-45b223c2652f.pdf")).toBe(
      "4bfeeac9-3e1b-44e6-bac5-45b223c2652f.pdf"
    );
    expect(repairUtf8Mojibake("nome-normal.pdf")).toBe("nome-normal.pdf");
  });

  it("remove caracteres de controle e normaliza para NFC", () => {
    expect(normalizeAttachmentFilename("  suma\u0301rio\u0000.pdf  ")).toBe("sumário.pdf");
  });

  it("gera Content-Disposition compatível com ASCII e UTF-8", () => {
    expect(attachmentContentDisposition("attachment", "Indeferimento Sumário.pdf")).toBe(
      "attachment; filename=\"Indeferimento Sumario.pdf\"; filename*=UTF-8''Indeferimento%20Sum%C3%A1rio.pdf"
    );
  });

  it("repara registros legados de forma idempotente", async () => {
    const update = vi.fn(({ data }: { data: { filename: string } }) => data);
    const records = [
      { id: "1", filename: "Indeferimento SumÃ¡rio.pdf" },
      { id: "2", filename: "Memorial.pdf" }
    ];
    const prisma = {
      attachment: {
        findMany: vi.fn(async () => records),
        update
      },
      $transaction: vi.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations))
    } as unknown as PrismaClient;

    await expect(repairStoredAttachmentFilenames(prisma)).resolves.toBe(1);
    expect(update).toHaveBeenCalledWith({
      where: { id: "1" },
      data: { filename: "Indeferimento Sumário.pdf" }
    });

    records[0] = { id: "1", filename: "Indeferimento Sumário.pdf" };
    update.mockClear();

    await expect(repairStoredAttachmentFilenames(prisma)).resolves.toBe(0);
    expect(update).not.toHaveBeenCalled();
  });
});
