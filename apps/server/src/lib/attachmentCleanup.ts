import fs from "node:fs/promises";
import path from "node:path";
import type { Prisma } from "../generated/prisma/client.js";
import { env } from "../config/env.js";

export async function deleteAttachmentsFromDisk(
  attachments: Array<{ storedAs: string }>
): Promise<void> {
  await Promise.all(
    attachments.map(async (attachment) => {
      const absolutePath = path.resolve(env.UPLOAD_DIR, attachment.storedAs);
      await fs.unlink(absolutePath).catch(() => undefined);
    })
  );
}

export async function deleteCommentAttachments(
  tx: Prisma.TransactionClient,
  commentId: string
): Promise<void> {
  const attachments = await tx.attachment.findMany({
    where: { commentId },
    select: { id: true, storedAs: true }
  });

  if (attachments.length === 0) {
    return;
  }

  await deleteAttachmentsFromDisk(attachments);
  await tx.attachment.deleteMany({ where: { commentId } });
}
