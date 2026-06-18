import { NotificationType, TaskStatus } from "shared";
import type { Prisma } from "../generated/prisma/client.js";
import { toPublicUser, userSelect } from "./asanaDto.js";
import { prisma } from "./prisma.js";
import { emitNotification } from "./socket.js";

const notificationInclude = {
  actor: { select: userSelect }
} satisfies Prisma.NotificationInclude;

export type NotificationRecord = Prisma.NotificationGetPayload<{ include: typeof notificationInclude }>;

const systemTitles: Partial<Record<NotificationType, string>> = {
  [NotificationType.WEEKLY_REPORT_DUE]: "Relatório semanal",
  [NotificationType.DUE_SOON]: "Prazo próximo"
};

const taskStatusLabels: Record<TaskStatus, string> = {
  [TaskStatus.BACKLOG]: "Backlog",
  [TaskStatus.TODO]: "A fazer",
  [TaskStatus.ON_SCHEDULE]: "No Cronograma",
  [TaskStatus.OVERDUE]: "Atrasado",
  [TaskStatus.IN_PROGRESS]: "Em andamento",
  [TaskStatus.AWAITING_REVIEW]: "Aguardando Revisão",
  [TaskStatus.IN_ANALYSIS]: "Em Análise",
  [TaskStatus.AWAITING_DEFINITION]: "Aguardando Definição",
  [TaskStatus.FINISHED]: "Finalizado"
};

export function notificationTaskStatusLabel(status: TaskStatus | string): string {
  return taskStatusLabels[status as TaskStatus] ?? status;
}

export function notificationToPayload(notification: NotificationRecord) {
  const actor = toPublicUser(notification.actor);

  return {
    id: notification.id,
    userId: notification.userId,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    read: notification.read,
    taskId: notification.taskId,
    actor: actor
      ? {
          id: actor.id,
          name: actor.name,
          avatarUrl: actor.avatarUrl
        }
      : null,
    createdAt: notification.createdAt.toISOString()
  };
}

export function notificationPreview(content: string, maxLength = 160): string {
  const normalized = content
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/@?\[([^\]]+)\]\(mk:\/\/(?:user|task|project)\/[^)]+\)/g, "@$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```[^\n]*\n?/g, ""))
    .replace(/`([^`]+)`/g, "$1")
    .replace(/&nbsp;/gi, " ")
    .replace(/&(?:amp|lt|gt|quot|#39);/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/^\s{0,3}(?:#{1,6}|>|[-+*]|\d+\.)\s+/gm, "")
    .replace(/[*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function commentNotificationMessage(taskName: string, content: string): string {
  const preview = notificationPreview(content, 120);
  return preview ? `${taskName}: ${preview}` : taskName;
}

export async function createAndEmitNotification(input: {
  userId: string;
  type: NotificationType;
  actorId?: string | null;
  title?: string;
  message: string;
  taskId?: string | null;
}): Promise<NotificationRecord | null> {
  if (input.actorId && input.actorId === input.userId) {
    return null;
  }

  const actor = input.actorId
    ? await prisma.user.findUnique({
        where: { id: input.actorId },
        select: { name: true }
      })
    : null;
  const title = actor?.name ?? input.title ?? systemTitles[input.type] ?? "MK Projetos";

  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      actorId: input.actorId ?? null,
      type: input.type,
      title,
      message: input.message,
      taskId: input.taskId ?? null
    },
    include: notificationInclude
  });

  emitNotification(input.userId, notificationToPayload(notification));
  return notification;
}

export { notificationInclude };
