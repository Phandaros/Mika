import { format } from "date-fns";
import { getDefaultDiscipline, type DisciplineType, type Task } from "shared";
import { Avatar } from "../shared/Avatar";
import { PriorityBadge } from "../shared/PriorityBadge";

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

export function TaskCard<TTask extends TaskCardTask>({ task, disciplineName, onOpen }: TaskCardProps<TTask>) {
  const disciplineColor = task.discipline?.type ? getDefaultDiscipline(task.discipline.type).color : undefined;

  return (
    <button
      type="button"
      onClick={() => onOpen?.(task)}
      className="w-full rounded-md border border-border bg-surface-card p-3 text-left transition hover:border-brand-orange hover:bg-surface-hover"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold leading-5 text-text-primary">{task.title}</h3>
        {task.assignee ? <Avatar name={task.assignee.name} imageUrl={task.assignee.avatarUrl} className="h-7 w-7" /> : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <PriorityBadge priority={task.priority} />
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
    </button>
  );
}
