import fs from "node:fs/promises";
import path from "node:path";
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
