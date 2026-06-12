import { useState, type ReactNode } from "react";
import { format, isToday } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FolderKanban,
  ListChecks,
  MessageSquareText,
  TimerReset
} from "lucide-react";
import { Link } from "react-router-dom";
import type { HomeDashboardProject, HomeDashboardTask, Task } from "shared";
import { Priority } from "shared";
import { Chip, priorityLabels, priorityTokens } from "../components/shared/Chip";
import { EmptyState } from "../components/shared/EmptyState";
import { TaskContextMenu } from "../components/task/TaskContextMenu";
import { TaskStatusBadge } from "../components/task/TaskStatusBadge";
import { TaskDetail } from "../components/task/TaskDetail";
import { useAuth } from "../hooks/useAuth";
import { useHomeDashboard } from "../hooks/useHomeDashboard";
import { useTaskById } from "../hooks/useTasks";
import { cn, dateOnlyToLocalDate, formatDateOnly } from "../lib/utils";

function greetingLabel(): string {
  const h = new Date().getHours();
  if (h < 12) {
    return "Bom dia";
  }
  if (h < 18) {
    return "Boa tarde";
  }
  return "Boa noite";
}

export function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading, isError } = useHomeDashboard();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskDetailOpenVersion, setTaskDetailOpenVersion] = useState(0);
  const { data: selectedTask } = useTaskById(selectedTaskId);

  function openTask(taskId: string | null) {
    if (!taskId) {
      return;
    }

    setSelectedTaskId(taskId);
    setTaskDetailOpenVersion((version) => version + 1);
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-[1200px]">
        <section className="rounded-md border border-[--color-border] bg-[--bg-2] p-5">
          <h1 className="text-[20px] font-semibold text-[--color-text-primary]">Não foi possível carregar a página inicial</h1>
          <p className="mt-2 text-[13px] text-[--color-text-secondary]">Tente atualizar a página em alguns instantes.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-[1200px] gap-4">
      <header className="rounded-md border border-[--color-border] bg-[--bg-2] px-5 py-4">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-[--color-text-secondary]">
              {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
            </p>
            <h1 className="mt-1 truncate text-[20px] font-semibold text-[--color-text-primary]">
              {greetingLabel()}, {firstName(user?.name ?? "usuário")}
            </h1>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <MetricPill label="Abertas" value={data?.stats.assignedOpen} loading={isLoading} icon={<ListChecks size={14} />} />
            <MetricPill label="Hoje" value={data?.stats.dueToday} loading={isLoading} icon={<CalendarClock size={14} />} />
            <MetricPill label="Atrasadas" value={data?.stats.overdue} loading={isLoading} tone="danger" icon={<AlertTriangle size={14} />} />
            <MetricPill label="Concluídas na semana" value={data?.stats.completedThisWeek} loading={isLoading} icon={<CheckCircle2 size={14} />} />
          </div>
        </div>
      </header>

      <main className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
        <Panel
          title="Prioridades de hoje"
          icon={<TimerReset size={16} />}
          action={<PanelLink to="/my-tasks">Abrir minhas tarefas</PanelLink>}
        >
          {isLoading ? <TaskListSkeleton /> : <TaskPriorityList tasks={data?.myTasks ?? []} onOpenTask={openTask} />}
        </Panel>

        <div className="grid gap-4">
          {data?.myReviews ? (
            <Panel
              title="Minhas revisões"
              icon={<ClipboardCheck size={16} />}
              compact
              action={<PanelLink to="/reviews">Ver fila</PanelLink>}
            >
              <div className="mb-3 flex items-center justify-between rounded-md border border-[--color-border-subtle] bg-[--bg-1] px-3 py-2">
                <span className="text-[12px] text-[--color-text-secondary]">Pendentes atribuídas a você</span>
                <strong className="text-[13px] text-[--color-text-primary]">{data.myReviews.totalPendingMine}</strong>
              </div>
              <ReviewList reviews={data.myReviews.items} />
            </Panel>
          ) : null}

          {data?.myWeeklyReport !== undefined || data?.weeklyReportsSummary ? (
            <Panel title="Relatórios semanais" icon={<ClipboardList size={16} />} compact action={<PanelLink to={data.myWeeklyReport ? "/weekly-reports/mine" : "/weekly-reports"}>Abrir</PanelLink>}>
              {data.myWeeklyReport !== undefined ? <MyWeeklyReportCard report={data.myWeeklyReport} /> : null}
              {data.weeklyReportsSummary ? <WeeklyReportsSummary summary={data.weeklyReportsSummary} /> : null}
            </Panel>
          ) : null}

          <Panel title="Atividade recente" icon={<MessageSquareText size={16} />} compact>
            {isLoading ? (
              <ActivitySkeleton />
            ) : (data?.recentActivity.length ?? 0) === 0 ? (
              <EmptyState title="Sem atividade recente" />
            ) : (
              <ul className="grid gap-2">
                {data?.recentActivity.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      disabled={!item.taskId}
                      onClick={() => openTask(item.taskId)}
                      className="grid w-full gap-1 rounded-md border border-[--color-border-subtle] bg-[--bg-1] px-3 py-2 text-left transition-colors hover:bg-[--bg-3] disabled:cursor-default disabled:hover:bg-[--bg-1]"
                    >
                      <span className="truncate text-[13px] font-medium text-[--color-text-primary]">{item.title}</span>
                      <span className="line-clamp-2 text-[12px] text-[--color-text-secondary]">{item.subtitle}</span>
                      <span className="text-[11px] text-[--color-text-muted]">{formatActivityDate(item.at)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </main>

      <Panel
        title="Projetos ativos em atenção"
        icon={<FolderKanban size={16} />}
        action={<PanelLink to="/projects">Ver projetos</PanelLink>}
      >
        {isLoading ? <ProjectGridSkeleton /> : <ProjectAttentionGrid projects={data?.activeProjects ?? []} />}
      </Panel>

      <TaskDetail
        task={selectedTask ?? null}
        onClose={() => setSelectedTaskId(null)}
        onOpenTask={(task) => openTask(task.id)}
        openVersion={taskDetailOpenVersion}
      />
    </div>
  );
}

function Panel({
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

function PanelLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-[--color-brand-orange] hover:text-[--color-brand-orange-hover]">
      {children}
      <ArrowUpRight size={13} aria-hidden="true" />
    </Link>
  );
}

function MetricPill({
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

function TaskPriorityList({ tasks, onOpenTask }: { tasks: HomeDashboardTask[]; onOpenTask: (taskId: string) => void }) {
  if (!tasks.length) {
    return (
      <EmptyState title="Nenhuma prioridade para mostrar">
        Suas tarefas abertas aparecerão aqui quando tiverem responsável e prazo operacional.
      </EmptyState>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-[--color-border-subtle]">
      <div className="grid grid-cols-[minmax(220px,1fr)_120px_130px_110px] border-b border-[--color-border] bg-[--bg-1] px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-[--color-text-muted] max-lg:hidden">
        <span>Tarefa</span>
        <span>Status</span>
        <span>Projeto</span>
        <span>Entrega</span>
      </div>
      <ul>
        {tasks.map((task) => (
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
                className="grid w-full grid-cols-[minmax(220px,1fr)_120px_130px_110px] items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-[--bg-3] max-lg:grid-cols-1 max-lg:gap-2"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-[--color-text-primary]">{task.title}</span>
                  <span className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
                    <PriorityChip priority={task.priority} />
                    <span className="truncate text-[11px] text-[--color-text-muted]">{task.sectionName ?? "Sem seção"}</span>
                  </span>
                </span>
                <span>
                  <TaskStatusBadge status={task.status} />
                </span>
                <span className="truncate text-[12px] text-[--color-text-secondary]">{task.projectName ?? "Sem projeto"}</span>
                <DueDateLabel dueDate={task.dueDate} />
              </button>
            </TaskContextMenu>
          </li>
        ))}
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

function DueDateLabel({ dueDate }: { dueDate: string | null }) {
  if (!dueDate) {
    return <span className="text-[12px] text-[--color-text-muted]">Sem data</span>;
  }

  const parsed = dateOnlyToLocalDate(dueDate);
  const overdue = Boolean(parsed && parsed < new Date() && !isToday(parsed));

  return (
    <span className={cn("text-[12px] font-medium", overdue ? "text-[--status-late-text]" : "text-[--color-text-secondary]")}>
      {isToday(parsed ?? new Date(0)) ? "Hoje" : formatDateOnly(dueDate, "dd/MM")}
    </span>
  );
}

function ReviewList({ reviews }: { reviews: Array<{ id: string; title: string; dueDate: string | null; projectName: string | null; requestedByName: string | null }> }) {
  if (!reviews.length) {
    return <EmptyState title="Nenhuma revisão pendente" />;
  }

  return (
    <ul className="grid gap-2">
      {reviews.map((review) => (
        <li key={review.id} className="rounded-md border border-[--color-border-subtle] bg-[--bg-1] px-3 py-2">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-[--color-text-primary]">{review.title}</p>
              <p className="mt-1 truncate text-[12px] text-[--color-text-secondary]">{review.projectName ?? "Sem projeto"}</p>
            </div>
            <DueDateLabel dueDate={review.dueDate} />
          </div>
          {review.requestedByName ? <p className="mt-1 truncate text-[11px] text-[--color-text-muted]">Solicitada por {review.requestedByName}</p> : null}
        </li>
      ))}
    </ul>
  );
}

function MyWeeklyReportCard({ report }: { report: { status: "PENDING" | "SUBMITTED" | "LATE"; itemCount: number; weekStart: string; weekEnd: string } | null }) {
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
        <span className="text-[13px] font-medium text-[--color-text-primary]">Meu relatório</span>
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

function WeeklyReportsSummary({ summary }: { summary: { expected: number; submitted: number; late: number; pending: number; submissionRate: number } }) {
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

function ProjectAttentionGrid({ projects }: { projects: HomeDashboardProject[] }) {
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

function TaskListSkeleton() {
  return (
    <div className="grid gap-2">
      {Array.from({ length: 7 }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div className="grid gap-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-16 w-full" />
      ))}
    </div>
  );
}

function ProjectGridSkeleton() {
  return (
    <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-5">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-28 w-full" />
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

function firstName(name: string): string {
  return name.split(" ")[0] ?? name;
}

function formatActivityDate(value: string): string {
  try {
    return format(new Date(value), "dd/MM HH:mm");
  } catch {
    return "";
  }
}
