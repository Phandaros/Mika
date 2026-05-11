import { format } from "date-fns";
import { CheckCircle2, Circle } from "lucide-react";
import { getDefaultDiscipline, type DisciplineType, type Task } from "shared";
import { Avatar } from "../shared/Avatar";
import { PriorityBadge } from "../shared/PriorityBadge";
import { cn } from "../../lib/utils";

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
  onToggleCompletion?: (task: TTask) => void;
}

export function TaskCard<TTask extends TaskCardTask>({ task, disciplineName, onOpen, onToggleCompletion }: TaskCardProps<TTask>) {
  const disciplineColor = task.discipline?.type ? getDefaultDiscipline(task.discipline.type).color : undefined;

  return (
    <div
      className={cn(
        "w-full rounded-md border border-border bg-surface-card p-3 text-left transition hover:border-brand-orange hover:bg-surface-hover",
        task.completed ? "opacity-70" : ""
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleCompletion?.(task);
            }}
            className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full text-text-secondary transition hover:text-brand-orange"
            title={task.completed ? "Reabrir tarefa" : "Concluir tarefa"}
          >
            {task.completed ? <CheckCircle2 size={16} className="text-green-400" /> : <Circle size={16} />}
          </button>
          <button type="button" onClick={() => onOpen?.(task)} className="min-w-0 text-left">
            <h3 className={cn("text-sm font-semibold leading-5 text-text-primary", task.completed ? "text-text-muted line-through" : "")}>
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
        {disciplineName ? (
          <span
            className="inline-flex h-6 items-center rounded-md border border-border px-2 text-xs font-semibold text-text-primary"
            style={disciplineColor ? { borderColor: `${disciplineColor}66`, backgroundColor: `${disciplineColor}22` } : undefined}
          >
            {disciplineName}
          </span>
        ) : null}
      </div>
      {task.dueDate ? (
        <p className="mt-3 text-xs text-text-secondary">Entrega {format(new Date(task.dueDate), "dd/MM/yyyy")}</p>
      ) : null}
    </div>
  );
}
