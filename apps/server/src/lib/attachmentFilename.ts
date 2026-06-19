import type { PrismaClient } from "../generated/prisma/client.js";

function isControlCharacter(codePoint: number): boolean {
  return codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f);
}

function mojibakeScore(value: string): number {
  let utf8LeadBytes = 0;
  let controlCharacters = 0;

  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.charCodeAt(index);
    const nextCodePoint = value.charCodeAt(index + 1);

    if (
      (codePoint === 0xc2 || codePoint === 0xc3) &&
      nextCodePoint >= 0x80 &&
      nextCodePoint <= 0xbf
    ) {
      utf8LeadBytes += 1;
    }

    if (codePoint >= 0x80 && codePoint <= 0x9f) {
      controlCharacters += 1;
    }
  }

  return utf8LeadBytes * 2 + controlCharacters;
}

export function repairUtf8Mojibake(value: string): string {
  if (mojibakeScore(value) === 0) {
    return value;
  }

  const repaired = Buffer.from(value, "latin1").toString("utf8");

  if (
    repaired.includes("\uFFFD") ||
    Buffer.from(repaired, "utf8").toString("latin1") !== value ||
    mojibakeScore(repaired) >= mojibakeScore(value)
  ) {
    return value;
  }

  return repaired;
}

export function normalizeAttachmentFilename(value: string): string {
  const normalized = repairUtf8Mojibake(value)
    .normalize("NFC")
    .split("")
    .filter((character) => !isControlCharacter(character.charCodeAt(0)))
    .join("")
    .replace(/[\\/]/g, "_")
    .trim();

  return normalized || "arquivo";
}

function asciiFilenameFallback(value: string): string {
  const fallback = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\;]/g, "_")
    .trim();

  return fallback || "arquivo";
}

function encodeRfc5987Value(value: string): string {
  return encodeURIComponent(value).replace(/['()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

export function attachmentContentDisposition(
  disposition: "inline" | "attachment",
  filename: string
): string {
  const normalized = normalizeAttachmentFilename(filename);
  return `${disposition}; filename="${asciiFilenameFallback(normalized)}"; filename*=UTF-8''${encodeRfc5987Value(normalized)}`;
}

export async function repairStoredAttachmentFilenames(prisma: PrismaClient): Promise<number> {
  const attachments = await prisma.attachment.findMany({
    select: { id: true, filename: true }
  });
  const repairs = attachments
    .map((attachment) => ({
      id: attachment.id,
      filename: normalizeAttachmentFilename(attachment.filename)
    }))
    .filter((attachment, index) => attachment.filename !== attachments[index]?.filename);

  if (repairs.length === 0) {
    return 0;
  }

  await prisma.$transaction(
    repairs.map((attachment) =>
      prisma.attachment.update({
        where: { id: attachment.id },
        data: { filename: attachment.filename }
      })
    )
  );

  return repairs.length;
}
