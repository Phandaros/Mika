import { type DisciplineType, type Task } from "shared";
import { Avatar } from "../shared/Avatar";
import { DisciplineChip } from "../shared/Chip";
import { PriorityBadge } from "../shared/PriorityBadge";
import { cn, formatDateOnly } from "../../lib/utils";
import { TaskContextMenu } from "./TaskContextMenu";

export type TaskCardTask = Task & {
  discipline?: {
    id: string;
    name: string;
    projectId: string;
    type?: DisciplineType;
  };
};

interface TaskCardProps<TTask extends TaskCardTask> {
  task: TTask;
  disciplineName?: string;
  onOpen?: (task: TTask) => void;
}

export function TaskCard<TTask extends TaskCardTask>({
  task,
  disciplineName,
  onOpen
}: TaskCardProps<TTask>) {
  const card = (
    <div
      className={cn(
        "w-full rounded-md border border-border bg-surface-card p-3 text-left transition hover:border-brand-orange hover:bg-surface-hover",
        task.completed ? "opacity-70" : ""
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <button type="button" onClick={() => onOpen?.(task)} className="min-w-0 text-left">
            <h3 className={cn("text-sm font-semibold leading-5", task.completed ? "text-text-muted" : "text-text-primary")}>
              {task.title}
            </h3>
          </button>
        </div>
        {task.assignee ? <Avatar name={task.assignee.name} imageUrl={task.assignee.avatarUrl} className="h-7 w-7" /> : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <PriorityBadge priority={task.priority} />
        {task.tags?.slice(0, 2).map((tag) => (
          <span key={tag.id} className="inline-flex h-6 items-center rounded-md border border-border px-2 text-xs font-semibold text-text-secondary">
            {tag.name}
          </span>
        ))}
        {disciplineName ? <DisciplineChip discipline={task.discipline?.name ?? disciplineName} /> : null}
      </div>
      {task.dueDate ? (
        <p className="mt-3 text-xs text-text-secondary">Entrega {formatDateOnly(task.dueDate, "dd/MM/yyyy")}</p>
      ) : null}
    </div>
  );

  if (!onOpen) {
    return card;
  }

  return (
    <TaskContextMenu task={task} projectId={task.discipline?.projectId} onOpen={onOpen}>
      {card}
    </TaskContextMenu>
  );
}
