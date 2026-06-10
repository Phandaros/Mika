import { NotificationType } from "shared";
import { Role } from "./enums.js";
import { createAndEmitNotification } from "./notify.js";
import { prisma } from "./prisma.js";
import {
  createWeeklyReportForUser,
  markPreviousWeekReportsLate
} from "./weeklyReportTasks.js";
import {
  getCurrentWeekStart,
  getPreviousWeekStart,
  isWeeklyReportGenerationWindow
} from "./weekUtils.js";

const CHECK_INTERVAL_MS = 60 * 60 * 1000;

let lastGenerationWeekStart: string | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;

async function runWeeklyReportGeneration(): Promise<void> {
  if (!isWeeklyReportGenerationWindow()) {
    return;
  }

  const weekStart = getCurrentWeekStart();
  const weekStartKey = weekStart.toISOString();

  if (lastGenerationWeekStart === weekStartKey) {
    return;
  }

  const designers = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { in: [Role.DESIGNER, Role.INTERN] }
    },
    select: { id: true, name: true }
  });

  const previousWeekStart = getPreviousWeekStart();
  await markPreviousWeekReportsLate(previousWeekStart);

  for (const designer of designers) {
    const { created } = await createWeeklyReportForUser(designer.id, weekStart);

    if (created) {
      await createAndEmitNotification({
        userId: designer.id,
        type: NotificationType.WEEKLY_REPORT_DUE,
        title: "Relatório semanal",
        message: "Seu relatório semanal está disponível para preenchimento."
      });
    }
  }

  lastGenerationWeekStart = weekStartKey;
  console.log(`[weeklyReportJob] Relatórios gerados para ${designers.length} projetistas.`);
}

export function startWeeklyReportJob(): void {
  if (intervalId) {
    return;
  }

  void runWeeklyReportGeneration();

  intervalId = setInterval(() => {
    void runWeeklyReportGeneration();
  }, CHECK_INTERVAL_MS);
}

export function stopWeeklyReportJob(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
