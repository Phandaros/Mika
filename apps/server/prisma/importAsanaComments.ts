/**
 * Importa comentários do dump JSON do AsanaScrapper para a tabela `Comment`.
 *
 * Uso:
 *   pnpm --filter server tsx prisma/importAsanaComments.ts "D:/caminho/asana_dump"
 *   ou defina ASANA_DUMP_DIR no .env do server.
 *
 * Idempotente: `upsert` por `asanaGid` (único).
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { prisma } from "../src/lib/prisma.js";

const dumpCommentSchema = z.object({
  gid: z.string().min(1),
  task_gid: z.string().min(1),
  created_at: z.string(),
  text: z.string().optional(),
  html_text: z.string().optional(),
  resource_subtype: z.string().optional(),
  created_by: z
    .object({
      gid: z.string(),
      name: z.string().optional()
    })
    .nullable()
    .optional()
});

function resolveDumpDir(): string {
  const argv = process.argv.slice(2).filter((a) => a !== "--");
  const positional = argv.find((a) => !a.startsWith("-"));
  const fromEnv = process.env.ASANA_DUMP_DIR?.trim();
  const dir = positional ?? fromEnv;
  if (!dir) {
    console.error(
      "Informe o diretório do dump: variável ASANA_DUMP_DIR ou argumento.\n" +
        'Ex.: pnpm --filter server tsx prisma/importAsanaComments.ts "D:/Projetos Cursor/AsanaScrapper/asana_dump"'
    );
    process.exit(1);
  }
  return path.resolve(dir);
}

function commentContent(row: z.infer<typeof dumpCommentSchema>): string {
  const fromText = row.text?.replace(/\r\n/g, "\n").trim() ?? "";
  if (fromText.length > 0) {
    return fromText;
  }
  const html = row.html_text ?? "";
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.length > 0 ? stripped : "(sem texto)";
}

const dryRun = process.argv.includes("--dry-run");

async function main(): Promise<void> {
  const dumpDir = resolveDumpDir();
  const names = await readdir(dumpDir);
  const commentFiles = names.filter((n) => n.startsWith("comments_") && n.endsWith(".json")).sort();

  if (commentFiles.length === 0) {
    console.error(`Nenhum arquivo comments_*.json em: ${dumpDir}`);
    process.exit(1);
  }

  const [tasks, users] = await Promise.all([
    prisma.task.findMany({ select: { id: true, asanaGid: true } }),
    prisma.user.findMany({
      where: { asanaGid: { not: null } },
      select: { id: true, asanaGid: true }
    })
  ]);

  const taskByAsanaGid = new Map<string, string>();
  for (const t of tasks) {
    taskByAsanaGid.set(t.asanaGid, t.id);
  }

  const userIdByAsanaGid = new Map<string, string>();
  for (const u of users) {
    if (u.asanaGid) {
      userIdByAsanaGid.set(u.asanaGid, u.id);
    }
  }

  let filesOk = 0;
  let rowsSeen = 0;
  let rowsValid = 0;
  let upserted = 0;
  let skippedNoTask = 0;
  let skippedSubtype = 0;
  let parseErrors = 0;

  for (const fileName of commentFiles) {
    const full = path.join(dumpDir, fileName);
    let raw: unknown;
    try {
      raw = JSON.parse(await readFile(full, "utf8")) as unknown;
    } catch {
      parseErrors += 1;
      continue;
    }

    if (!Array.isArray(raw)) {
      parseErrors += 1;
      continue;
    }

    filesOk += 1;

    for (const item of raw) {
      rowsSeen += 1;
      const parsed = dumpCommentSchema.safeParse(item);
      if (!parsed.success) {
        parseErrors += 1;
        continue;
      }

      const row = parsed.data;
      if (row.resource_subtype && row.resource_subtype !== "comment_added") {
        skippedSubtype += 1;
        continue;
      }

      rowsValid += 1;
      const taskId = taskByAsanaGid.get(row.task_gid);
      if (!taskId) {
        skippedNoTask += 1;
        continue;
      }

      const authorGid = row.created_by?.gid ?? null;
      const authorId = authorGid ? (userIdByAsanaGid.get(authorGid) ?? null) : null;
      const asanaCreatedAt = new Date(row.created_at);
      const content = commentContent(row);

      if (dryRun) {
        upserted += 1;
        continue;
      }

      await prisma.comment.upsert({
        where: { asanaGid: row.gid },
        create: {
          taskId,
          authorId,
          content,
          asanaGid: row.gid,
          authorAsanaGid: authorGid,
          asanaCreatedAt: Number.isNaN(asanaCreatedAt.getTime()) ? null : asanaCreatedAt
        },
        update: {
          taskId,
          authorId,
          content,
          authorAsanaGid: authorGid,
          asanaCreatedAt: Number.isNaN(asanaCreatedAt.getTime()) ? null : asanaCreatedAt
        }
      });
      upserted += 1;
    }
  }

  console.log(
    [
      dryRun ? "[dry-run] " : "",
      `Arquivos JSON lidos: ${filesOk}/${commentFiles.length}`,
      `Linhas no dump: ${rowsSeen}`,
      `Registros válidos (comment_added + schema): ${rowsValid}`,
      `Gravados/reprocessados (upsert): ${upserted}`,
      `Ignorados — tarefa não encontrada (task_gid): ${skippedNoTask}`,
      `Ignorados — subtype: ${skippedSubtype}`,
      `Erros de parse/schema: ${parseErrors}`
    ].join("\n")
  );
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
