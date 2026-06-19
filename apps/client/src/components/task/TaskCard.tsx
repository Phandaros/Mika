import { CalendarDays, FolderKanban, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { type Task } from "shared";
import { Avatar } from "../shared/Avatar";
import { CompletionStatusChip, DisciplineChip } from "../shared/Chip";
import { PriorityBadge } from "../shared/PriorityBadge";
import { statusTimelineStyle } from "../../lib/taskTimelineStyle";
import { cn, formatDateOnly } from "../../lib/utils";
import { TaskContextMenu } from "./TaskContextMenu";

interface KanbanTaskCardProps<TTask extends Task> {
  task: TTask;
  onOpen: (task: TTask) => void;
  fallbackLinkPath: string;
}

export function KanbanTaskCard<TTask extends Task>({
  task,
  onOpen,
  fallbackLinkPath
}: KanbanTaskCardProps<TTask>) {
  const projectName = task.discipline?.projectName ?? task.projects?.[0]?.name ?? "Sem projeto";
  const sectionName = task.taskDiscipline ?? task.discipline?.name ?? task.projects?.[0]?.sectionName ?? "";
  const dateLabel = task.maxDeadline ?? task.dueDate;
  const projectId = task.discipline?.projectId ?? task.projects?.[0]?.id;

  return (
    <TaskContextMenu task={task} projectId={projectId} onOpen={onOpen} fallbackLinkPath={fallbackLinkPath}>
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
          "cursor-pointer rounded-md border p-3 transition-[transform,box-shadow,opacity] duration-150 ease-out-expo hover:-translate-y-px hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-1 focus-visible:ring-offset-[--bg-2]",
          task.completed ? "opacity-70" : ""
        )}
        style={statusTimelineStyle(task.status)}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 min-w-0 flex-1 text-sm font-semibold leading-5">{task.title}</h3>
          {task.assignee ? <Avatar name={task.assignee.name} imageUrl={task.assignee.avatarUrl} className="size-7" /> : null}
        </div>

        <div className="mt-3 grid gap-2 text-xs text-text-secondary">
          <InfoLine icon={<FolderKanban size={13} />} value={projectName} />
          <InfoLine icon={<UserRound size={13} />} value={task.assignee?.name ?? "Sem responsável"} />
          {dateLabel ? <InfoLine icon={<CalendarDays size={13} />} value={formatDateOnly(dateLabel, "dd/MM/yyyy")} /> : null}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <PriorityBadge priority={task.priority} />
          {sectionName ? <DisciplineChip discipline={sectionName} /> : null}
          <CompletionStatusChip completed={task.completed} />
        </div>
      </article>
    </TaskContextMenu>
  );
}

function InfoLine({ icon, value }: { icon: ReactNode; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-text-muted">{icon}</span>
      <span className="truncate" title={value}>
        {value}
      </span>
    </div>
  );
}
