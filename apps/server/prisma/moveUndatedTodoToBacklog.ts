/**
 * Move tarefas abertas em "A fazer" sem data para o status BACKLOG.
 *
 * Uso:
 *   pnpm --filter server db:move-undated-todo-to-backlog --dry-run
 *   pnpm --filter server db:move-undated-todo-to-backlog --apply
 */

import { prisma } from "../src/lib/prisma.js";
import { printMoveUndatedTodoToBacklogSummary, runMoveUndatedTodoToBacklog } from "../src/lib/moveUndatedTodoToBacklog.js";

const apply = process.argv.includes("--apply");
const dryRun = process.argv.includes("--dry-run") || !apply;

async function main(): Promise<void> {
  if (!dryRun && !apply) {
    console.error("Informe --dry-run (padrão) ou --apply para gravar alterações.");
    process.exit(1);
  }

  const summary = await runMoveUndatedTodoToBacklog(prisma, { apply });
  printMoveUndatedTodoToBacklogSummary(summary, apply);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
