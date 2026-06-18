import { type ReactNode } from "react";
import { differenceInCalendarDays, format, isToday } from "date-fns";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { HomeDashboardProject, HomeDashboardTask, Task } from "shared";
import { Priority } from "shared";
import { Chip, priorityLabels, priorityTokens } from "../shared/Chip";
import { EmptyState } from "../shared/EmptyState";
import { TaskContextMenu } from "../task/TaskContextMenu";
import { TaskStatusBadge } from "../task/TaskStatusBadge";
import { cn, dateOnlyToLocalDate, formatDateOnly } from "../../lib/utils";
import { workloadTaskDisplayLabel } from "../../lib/workloadTaskLabel";

export function Panel({
  title,
  icon,
  action,
  compact = false,
  children
}: {
  title: string;
  icon: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={cn("min-w-0 rounded-md border border-[--color-border] bg-[--bg-2]", compact ? "p-4" : "p-5")}>
      <div className="mb-4 flex min-w-0 items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2 text-[16px] font-semibold text-[--color-text-primary]">
          <span className="shrink-0 text-[--color-text-secondary]" aria-hidden="true">
            {icon}
          </span>
          <span className="truncate">{title}</span>
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function PanelLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-[--color-brand-orange] hover:text-[--color-brand-orange-hover]">
      {children}
      <ArrowUpRight size={13} aria-hidden="true" />
    </Link>
  );
}

export function MetricPill({
  label,
  value,
  loading,
  icon,
  tone = "default"
}: {
  label: string;
  value: number | undefined;
  loading: boolean;
  icon: ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <div className="inline-flex h-9 items-center gap-2 rounded-md border border-[--color-border] bg-[--bg-1] px-3">
      <span className={cn("text-[--color-text-secondary]", tone === "danger" ? "text-[--status-late-text]" : "")} aria-hidden="true">
        {icon}
      </span>
      {loading ? <Skeleton className="h-3 w-10" /> : <strong className="text-[13px] text-[--color-text-primary]">{value ?? 0}</strong>}
      <span className="truncate text-[12px] font-medium text-[--color-text-secondary]">{label}</span>
    </div>
  );
}

export function TaskPriorityList({
  tasks,
  onOpenTask,
  emptyTitle = "Nenhuma prioridade para mostrar",
  emptyDescription = "As tarefas abertas aparecerão aqui quando tiverem responsável e prazo operacional."
}: {
  tasks: HomeDashboardTask[];
  onOpenTask: (taskId: string) => void;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (!tasks.length) {
    return (
      <EmptyState title={emptyTitle}>
        {emptyDescription}
      </EmptyState>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-[--color-border-subtle]">
      <div className="grid grid-cols-[minmax(260px,1fr)_160px_180px] gap-3 border-b border-[--color-border] bg-[--bg-1] px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-[--color-text-muted] max-2xl:hidden">
        <span>Tarefa</span>
        <span>Status</span>
        <span>Prazo</span>
      </div>
      <ul>
        {tasks.map((task) => {
          const displayLabel = workloadTaskDisplayLabel(task, "global");

          return (
            <li key={task.id} className="border-b border-[--color-border-subtle] last:border-b-0">
              <TaskContextMenu
                task={toTaskContextMenuTask(task)}
                projectId={task.projectId ?? undefined}
                fallbackLinkPath="/"
                onOpen={(contextTask) => onOpenTask(contextTask.id)}
              >
                <button
                  type="button"
                  onClick={() => onOpenTask(task.id)}
                  className="grid w-full grid-cols-[minmax(260px,1fr)_160px_180px] items-center gap-3 px-3 py-2 text-left transition-colors duration-100 hover:bg-[--bg-3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[--color-brand-orange] max-2xl:grid-cols-1 max-2xl:gap-2.5 max-2xl:py-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-[--color-text-primary]">
                      {displayLabel.taskTitle}
                    </span>
                    <span className="mt-1 flex min-w-0 items-center gap-1.5">
                      <span className="min-w-0 max-w-[42%] truncate text-[11px] font-medium text-[--status-inprogress-text]">
                        {displayLabel.projectName ?? "Sem projeto"}
                      </span>
                      <span className="shrink-0 text-[--color-border-focus]" aria-hidden="true">·</span>
                      <span className="shrink-0">
                        <PriorityChip priority={task.priority} />
                      </span>
                      <span className="shrink-0 text-[--color-border-focus]" aria-hidden="true">·</span>
                      <span className="min-w-0 truncate text-[11px] text-[--color-text-muted]">
                        {task.sectionName ?? "Sem seção"}
                      </span>
                    </span>
                  </span>
                  <span className="flex min-w-0 items-center gap-2 max-2xl:grid max-2xl:grid-cols-[72px_minmax(0,1fr)]">
                    <span className="hidden text-[11px] font-medium uppercase tracking-widest text-[--color-text-muted] max-2xl:inline">
                      Status
                    </span>
                    <span className="min-w-0">
                      <TaskStatusBadge status={task.status} />
                    </span>
                  </span>
                  <span className="flex min-w-0 items-center gap-2 max-2xl:grid max-2xl:grid-cols-[72px_minmax(0,1fr)]">
                    <span className="hidden text-[11px] font-medium uppercase tracking-widest text-[--color-text-muted] max-2xl:inline">
                      Prazo
                    </span>
                    <DueDateLabel dueDate={task.dueDate} relative />
                  </span>
                </button>
              </TaskContextMenu>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function toTaskContextMenuTask(task: HomeDashboardTask): Task {
  return {
    id: task.id,
    disciplineId: task.sectionId,
    title: task.title,
    description: null,
    status: task.status,
    priority: task.priority,
    assigneeId: null,
    creatorId: null,
    startDate: null,
    dueDate: task.dueDate,
    estimatedDays: null,
    completed: false,
    completedAt: null,
    createdAt: "",
    updatedAt: "",
    assignee: null,
    projects: task.projectId
      ? [{
          id: task.projectId,
          asanaGid: "",
          name: task.projectName ?? "Projeto",
          sectionId: task.sectionId,
          sectionName: task.sectionName ?? undefined
        }]
      : [],
    discipline: {
      id: task.sectionId,
      name: task.sectionName ?? "Sem seção",
      projectId: task.projectId ?? "",
      projectName: task.projectName
    }
  };
}

function PriorityChip({ priority }: { priority: Priority }) {
  const tokens = priorityTokens[priority];

  return (
    <Chip bg={tokens.bg} text={tokens.text}>
      {priorityLabels[priority]}
    </Chip>
  );
}

function DueDateLabel({ dueDate, relative = false }: { dueDate: string | null; relative?: boolean }) {
  if (!dueDate) {
    return <span className="truncate text-[12px] text-[--color-text-muted]">{relative ? "Sem prazo" : "Sem data"}</span>;
  }

  const parsed = dateOnlyToLocalDate(dueDate);
  if (!parsed) {
    return <span className="truncate text-[12px] text-[--color-text-muted]">{relative ? "Sem prazo" : "Sem data"}</span>;
  }

  if (!relative) {
    const overdue = parsed < new Date() && !isToday(parsed);

    return (
      <span className={cn("text-[12px] font-medium", overdue ? "text-[--status-late-text]" : "text-[--color-text-secondary]")}>
        {isToday(parsed) ? "Hoje" : formatDateOnly(dueDate, "dd/MM")}
      </span>
    );
  }

  const daysUntilDue = differenceInCalendarDays(parsed, new Date());
  const relativeLabel = dueDateRelativeLabel(daysUntilDue);

  return (
    <span
      className={cn(
        "truncate text-[12px] font-medium",
        daysUntilDue < 0 && "text-[--status-late-text]",
        daysUntilDue === 0 && "text-[--status-review-text]",
        daysUntilDue > 0 && "text-[--color-text-secondary]"
      )}
      title={`${relativeLabel} · ${formatDateOnly(dueDate, "dd/MM/yyyy")}`}
    >
      {relativeLabel} · {formatDateOnly(dueDate, "dd/MM")}
    </span>
  );
}

function dueDateRelativeLabel(daysUntilDue: number): string {
  if (daysUntilDue === 0) {
    return "Hoje";
  }

  if (daysUntilDue === 1) {
    return "Amanhã";
  }

  if (daysUntilDue > 1) {
    return `Em ${daysUntilDue} dias`;
  }

  const overdueDays = Math.abs(daysUntilDue);
  return `Atrasada há ${overdueDays} ${overdueDays === 1 ? "dia" : "dias"}`;
}

export function ReviewList({
  reviews,
  onOpenTask
}: {
  reviews: Array<{ id: string; taskId: string; title: string; dueDate: string | null; projectName: string | null; requestedByName: string | null }>;
  onOpenTask: (taskId: string) => void;
}) {
  if (!reviews.length) {
    return <EmptyState title="Nenhuma revisão pendente" />;
  }

  return (
    <ul className="grid min-w-0 gap-2">
      {reviews.map((review) => (
        <li key={review.id} className="min-w-0">
          <button
            type="button"
            onClick={() => onOpenTask(review.taskId)}
            className="block w-full min-w-0 rounded-md border border-[--color-border-subtle] bg-[--bg-1] px-3 py-2 text-left transition-colors hover:bg-[--bg-3]"
          >
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-[--color-text-primary]">{review.title}</p>
                <p className="mt-1 truncate text-[12px] text-[--color-text-secondary]">{review.projectName ?? "Sem projeto"}</p>
              </div>
              <span className="shrink-0">
                <DueDateLabel dueDate={review.dueDate} />
              </span>
            </div>
            {review.requestedByName ? <p className="mt-1 truncate text-[11px] text-[--color-text-muted]">Solicitada por {review.requestedByName}</p> : null}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function MyWeeklyReportCard({
  report,
  title = "Meu relatório"
}: {
  report: { status: "PENDING" | "SUBMITTED" | "LATE"; itemCount: number; weekStart: string; weekEnd: string } | null;
  title?: string;
}) {
  if (!report) {
    return (
      <div className="rounded-md border border-[--color-border-subtle] bg-[--bg-1] px-3 py-2">
        <p className="text-[13px] font-medium text-[--color-text-primary]">Relatório da semana ainda não gerado</p>
        <p className="mt-1 text-[12px] text-[--color-text-secondary]">Ele aparece aqui quando estiver disponível.</p>
      </div>
    );
  }

  const tokens = report.status === "SUBMITTED"
    ? { bg: "--status-done-bg", text: "--status-done-text" }
    : report.status === "LATE"
      ? { bg: "--status-late-bg", text: "--status-late-text" }
      : { bg: "--status-review-bg", text: "--status-review-text" };

  return (
    <div className="rounded-md border border-[--color-border-subtle] bg-[--bg-1] px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-medium text-[--color-text-primary]">{title}</span>
        <Chip bg={tokens.bg} text={tokens.text}>
          {weeklyReportStatusLabel(report.status)}
        </Chip>
      </div>
      <p className="mt-1 text-[12px] text-[--color-text-secondary]">
        {report.itemCount} tarefas · {formatDateOnly(report.weekStart, "dd/MM")} a {formatDateOnly(report.weekEnd, "dd/MM")}
      </p>
    </div>
  );
}

export function WeeklyReportsSummary({ summary }: { summary: { expected: number; submitted: number; late: number; pending: number; submissionRate: number } }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      <SummaryMetric label="Envio" value={`${summary.submissionRate}%`} />
      <SummaryMetric label="Pend." value={String(summary.pending)} />
      <SummaryMetric label="Env." value={String(summary.submitted)} />
      <SummaryMetric label="Atras." value={String(summary.late)} danger />
    </div>
  );
}

function SummaryMetric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-md border border-[--color-border-subtle] bg-[--bg-1] px-2 py-2">
      <p className="text-[11px] text-[--color-text-muted]">{label}</p>
      <p className={cn("mt-1 text-[13px] font-semibold text-[--color-text-primary]", danger ? "text-[--status-late-text]" : "")}>{value}</p>
    </div>
  );
}

export function ProjectAttentionGrid({ projects }: { projects: HomeDashboardProject[] }) {
  if (!projects.length) {
    return <EmptyState title="Nenhum projeto ativo" />;
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-5">
      {projects.map((project) => (
        <Link key={project.id} to={`/projects/${project.id}`} className="min-w-0 rounded-md border border-[--color-border-subtle] bg-[--bg-1] p-3 transition-colors hover:bg-[--bg-3]">
          <p className="truncate text-[13px] font-semibold text-[--color-text-primary]">{project.name}</p>
          <p className="mt-1 truncate text-[12px] text-[--color-text-secondary]">{project.client ?? "Sem cliente"}</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[--bg-4]">
            <div className="h-full rounded-full bg-[--color-brand-orange]" style={{ width: `${project.progress}%` }} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
            <ProjectMetric label="Aber." value={project.openTasks} />
            <ProjectMetric label="Rev." value={project.awaitingReviewTasks} />
            <ProjectMetric label="Atr." value={project.overdueTasks} danger />
          </div>
        </Link>
      ))}
    </div>
  );
}

function ProjectMetric({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <span className="min-w-0">
      <span className="block truncate text-[--color-text-muted]">{label}</span>
      <strong className={cn("mt-0.5 block text-[--color-text-primary]", danger && value > 0 ? "text-[--status-late-text]" : "")}>{value}</strong>
    </span>
  );
}

export function TaskListSkeleton() {
  return (
    <div className="grid gap-2">
      {Array.from({ length: 7 }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function ActivitySkeleton() {
  return (
    <div className="grid gap-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-16 w-full" />
      ))}
    </div>
  );
}

export function ProjectGridSkeleton() {
  return (
    <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-5">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-28 w-full" />
      ))}
    </div>
  );
}

export function MetricsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-9 w-32" />
      ))}
    </div>
  );
}

function Skeleton({ className }: { className: string }) {
  return <div className={cn("animate-pulse rounded-md bg-[--bg-4]", className)} />;
}

function weeklyReportStatusLabel(status: "PENDING" | "SUBMITTED" | "LATE"): string {
  const labels = {
    PENDING: "Pendente",
    SUBMITTED: "Enviado",
    LATE: "Atrasado"
  };

  return labels[status];
}

export function formatActivityDate(value: string): string {
  try {
    return format(new Date(value), "dd/MM HH:mm");
  } catch {
    return "";
  }
}
