import {
  AtSign,
  Bell,
  CalendarClock,
  CheckCircle2,
  CircleUserRound,
  Clock3,
  MessageSquareText,
  RefreshCcw,
  UserRoundPlus,
  type LucideIcon
} from "lucide-react";
import type { NavigateFunction } from "react-router-dom";
import { NotificationType, type Notification, type Task } from "shared";
import { api } from "./api";
import { buildOpenProjectPath, resolveTaskProjectTargets } from "./taskProjectActions";

export interface NotificationPresentation {
  icon: LucideIcon;
  action: string;
  tone: "orange" | "blue" | "green" | "purple" | "yellow" | "muted";
}

const presentationByType: Partial<Record<NotificationType, NotificationPresentation>> = {
  [NotificationType.COMMENT_ADDED]: {
    icon: MessageSquareText,
    action: "comentou em uma tarefa",
    tone: "blue"
  },
  [NotificationType.MENTIONED]: {
    icon: AtSign,
    action: "mencionou você",
    tone: "purple"
  },
  [NotificationType.TASK_ASSIGNED]: {
    icon: UserRoundPlus,
    action: "atribuiu uma tarefa a você",
    tone: "orange"
  },
  [NotificationType.TASK_UPDATED]: {
    icon: RefreshCcw,
    action: "alterou uma tarefa",
    tone: "yellow"
  },
  [NotificationType.TASK_REVIEW_REQUESTED]: {
    icon: CheckCircle2,
    action: "solicitou uma revisão",
    tone: "green"
  },
  [NotificationType.DUE_SOON]: {
    icon: Clock3,
    action: "Prazo próximo",
    tone: "yellow"
  },
  [NotificationType.WEEKLY_REPORT_DUE]: {
    icon: CalendarClock,
    action: "Relatório disponível",
    tone: "orange"
  }
};

const mojibakeReplacements: Array<[string, string]> = [
  ["Notificacoes", "Notificações"],
  ["notificacao", "notificação"],
  ["comentÃ¡rio", "comentário"],
  ["VocÃª", "Você"],
  ["revisÃ£o", "revisão"],
  ["RelatÃ³rio", "Relatório"],
  ["estÃ¡", "está"],
  ["â€¦", "…"],
  ["Nova tarefa atribuida", "Nova tarefa atribuída"],
  ["Tarefa atribuida a voce", "Tarefa atribuída a você"]
];

const legacyStatusLabels: Array<[RegExp, string]> = [
  [/\bAWAITING_DEFINITION\b|\bAWAITINGDEFINITION\b/g, "Aguardando Definição"],
  [/\bAWAITING_REVIEW\b|\bAWAITINGREVIEW\b|\bIN_REVIEW\b/g, "Aguardando Revisão"],
  [/\bIN_PROGRESS\b|\bINPROGRESS\b/g, "Em andamento"],
  [/\bIN_ANALYSIS\b|\bINANALYSIS\b/g, "Em Análise"],
  [/\bON_SCHEDULE\b|\bONSCHEDULE\b/g, "No Cronograma"],
  [/\bFINISHED\b|\bDONE\b/g, "Finalizado"],
  [/\bOVERDUE\b/g, "Atrasado"],
  [/\bTODO\b/g, "A fazer"],
  [/\bBACKLOG\b/g, "Backlog"]
];

export function normalizeLegacyNotificationText(value: string): string {
  let normalized = value;

  for (const [broken, corrected] of mojibakeReplacements) {
    normalized = normalized.split(broken).join(corrected);
  }

  normalized = normalized
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/@?\[([^\]]+)\]\(mk:\/\/(?:user|task|project)\/[^)]+\)/g, "@$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/&nbsp;/gi, " ")
    .replace(/&(?:amp|lt|gt|quot|#39);/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[*_~#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  for (const [pattern, label] of legacyStatusLabels) {
    normalized = normalized.replace(pattern, label);
  }

  return normalized;
}

export function notificationPresentation(type: string): NotificationPresentation {
  return (
    presentationByType[type as NotificationType] ?? {
      icon: Bell,
      action: "enviou uma notificação",
      tone: "muted"
    }
  );
}

export function notificationActorName(notification: Notification): string {
  return normalizeLegacyNotificationText(notification.actor?.name ?? notification.title ?? "MK Projetos");
}

export async function openNotificationDestination(
  notification: Notification,
  navigate: NavigateFunction
): Promise<boolean> {
  if (notification.type === NotificationType.WEEKLY_REPORT_DUE) {
    navigate("/weekly-reports/mine");
    return true;
  }

  if (!notification.taskId) {
    return false;
  }

  try {
    const response = await api.get<{ task: Task }>(`/tasks/${notification.taskId}`);
    const target = resolveTaskProjectTargets(response.data.task)[0];

    if (target) {
      navigate(buildOpenProjectPath(target.id, notification.taskId));
    } else {
      navigate(`/my-tasks?task=${encodeURIComponent(notification.taskId)}`);
    }

    return true;
  } catch {
    return false;
  }
}

export const notificationToneStyles: Record<NotificationPresentation["tone"], { background: string; color: string }> = {
  orange: { background: "var(--priority-high-bg)", color: "var(--priority-high-text)" },
  blue: { background: "var(--status-inprogress-bg)", color: "var(--status-inprogress-text)" },
  green: { background: "var(--status-done-bg)", color: "var(--status-done-text)" },
  purple: { background: "var(--status-analysis-bg)", color: "var(--status-analysis-text)" },
  yellow: { background: "var(--priority-medium-bg)", color: "var(--priority-medium-text)" },
  muted: { background: "var(--disc-none-bg)", color: "var(--disc-none-text)" }
};

export const notificationFallbackIcon = CircleUserRound;
