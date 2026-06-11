/**
 * Corrige tarefas legadas vinculadas ao projeto "Elétrico - Sprint Board".
 *
 * Uso:
 *   pnpm --filter server db:fix-sprint-board-tasks --dry-run
 *   pnpm --filter server db:fix-sprint-board-tasks --apply
 */

import { prisma } from "../src/lib/prisma.js";
import { printFixSprintBoardSummary, runFixSprintBoardTasks } from "../src/lib/fixSprintBoardTasks.js";

const apply = process.argv.includes("--apply");
const dryRun = process.argv.includes("--dry-run") || !apply;

async function main(): Promise<void> {
  if (!dryRun && !apply) {
    console.error("Informe --dry-run (padrão) ou --apply para gravar alterações.");
    process.exit(1);
  }

  const summary = await runFixSprintBoardTasks(prisma, { apply });
  printFixSprintBoardSummary(summary, apply);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
