import { CalendarDays, FolderKanban, MessageSquare, PauseCircle } from "lucide-react";
import { Priority, type TeamBoardTaskDto } from "shared";
import { DisciplineChip } from "../shared/Chip";
import { PriorityBadge } from "../shared/PriorityBadge";
import { priorityColors } from "../shared/statusVisuals";
import { TaskStatusBadge } from "../task/TaskStatusBadge";
import { TaskContextMenu } from "../task/TaskContextMenu";
import { formatEffortLabel, isTaskStale } from "../../lib/teamBoardMetrics";
import { cn, formatDateOnly, toDateOnly } from "../../lib/utils";

interface TeamBoardTaskCardProps {
  task: TeamBoardTaskDto;
  today: string;
  nonWorkingDays: Set<string>;
  onOpen: (task: TeamBoardTaskDto) => void;
  variant?: "default" | "compact";
}

export function TeamBoardTaskCard({
  task,
  today,
  nonWorkingDays,
  onOpen,
  variant = "default"
}: TeamBoardTaskCardProps) {
  const compact = variant === "compact";
  const projectName = task.discipline?.projectName ?? task.projects?.[0]?.name ?? "Sem projeto";
  const sectionName = task.discipline?.name ?? task.projects?.[0]?.sectionName ?? "";
  const estimatedDays = task.estimatedDays ?? task.estimatedTime ?? null;
  const effortLabel = formatEffortLabel(task.metrics.elapsedBusinessDays, estimatedDays);
  const stale = isTaskStale(task.updatedAt, today, nonWorkingDays);
  const showMaxDeadline =
    Boolean(task.maxDeadline) && toDateOnly(task.maxDeadline) !== toDateOnly(task.dueDate);

  return (
    <TaskContextMenu task={task} projectId={task.discipline?.projectId} onOpen={onOpen} fallbackLinkPath="/team-board">
      <article
        role="button"
        tabIndex={0}
        onClick={() => onOpen(task)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen(task);
          }
        }}
        className={cn(
          "relative cursor-pointer overflow-hidden rounded-md border border-border bg-surface-card pl-4 transition hover:border-brand-orange hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-1 focus-visible:ring-offset-[--bg-2]",
          compact ? "p-2.5" : "p-3",
          task.metrics.isOverdue ? "border-[var(--status-late-text)]/40" : ""
        )}
      >
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-1"
          style={{ backgroundColor: priorityColors[task.priority] ?? priorityColors[Priority.MEDIUM] }}
        />

        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 min-w-0 text-sm font-semibold leading-5 text-text-primary">{task.title}</h3>
          {task.commentCount > 0 ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-surface px-2 py-1 text-[11px] font-semibold text-text-secondary">
              <MessageSquare size={12} />
              {task.commentCount}
            </span>
          ) : null}
        </div>

        <div className="mt-2 grid gap-1.5 text-xs text-text-secondary">
          <div className="flex min-w-0 items-center gap-2">
            <FolderKanban size={13} className="shrink-0 text-text-muted" />
            <span className="truncate" title={projectName}>
              {projectName}
            </span>
          </div>
          {sectionName ? <DisciplineChip discipline={sectionName} /> : null}
        </div>

        <div className={cn("flex flex-wrap items-center gap-2", compact ? "mt-2" : "mt-3")}>
          <TaskStatusBadge status={task.status} />
          <PriorityBadge priority={task.priority} />
        </div>

        <div className={cn("grid gap-1 text-xs", compact ? "mt-2" : "mt-3")}>
          {task.dueDate ? (
            <p className={cn("font-medium", task.metrics.isOverdue ? "text-red-300" : "text-text-secondary")}>
              <CalendarDays size={12} className="mr-1 inline -mt-px" />
              Entrega {formatDateOnly(task.dueDate, "dd/MM/yyyy")}
              {task.metrics.daysUntilDue != null && task.metrics.daysUntilDue < 0
                ? ` (${Math.abs(task.metrics.daysUntilDue)}d atraso)`
                : null}
            </p>
          ) : (
            <p className="text-text-muted">Sem data de entrega</p>
          )}

          {showMaxDeadline ? (
            <p className="text-text-muted">Prazo máximo {formatDateOnly(task.maxDeadline!, "dd/MM/yyyy")}</p>
          ) : null}

          <p className={cn("text-text-secondary", task.metrics.isOverEstimated ? "text-amber-200" : "")}>{effortLabel}</p>
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {task.metrics.isOverEstimated ? (
            <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
              Acima do estimado
            </span>
          ) : null}
          {stale ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-surface px-2 py-0.5 text-[11px] font-semibold text-text-muted">
              <PauseCircle size={11} />
              Parada
            </span>
          ) : null}
        </div>
      </article>
    </TaskContextMenu>
  );
}
