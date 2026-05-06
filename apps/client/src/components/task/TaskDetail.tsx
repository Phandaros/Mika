import { X } from "lucide-react";
import type { Task } from "shared";
import { Avatar } from "../shared/Avatar";
import { PriorityBadge } from "../shared/PriorityBadge";
import { Button } from "../ui/button";
import { TaskStatusBadge } from "./TaskStatusBadge";

interface TaskDetailProps {
  task: Task | null;
  onClose: () => void;
}

export function TaskDetail({ task, onClose }: TaskDetailProps) {
  if (!task) {
    return null;
  }

  return (
    <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-xl border-l border-border bg-surface p-6 shadow-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-orange">Tarefa</p>
          <h2 className="mt-2 text-2xl font-bold text-text-primary">{task.title}</h2>
        </div>
        <Button variant="ghost" className="h-9 w-9 px-0" onClick={onClose} title="Fechar">
          <X size={18} />
        </Button>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <TaskStatusBadge status={task.status} />
        <PriorityBadge priority={task.priority} />
      </div>
      <div className="mt-6 rounded-md border border-border bg-surface-card p-4">
        <p className="text-sm text-text-secondary">{task.description ?? "Sem descricao cadastrada."}</p>
      </div>
      <div className="mt-6 space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase text-text-muted">Responsavel</p>
          {task.assignee ? (
            <div className="mt-2 flex items-center gap-3">
              <Avatar name={task.assignee.name} imageUrl={task.assignee.avatarUrl} />
              <span className="text-sm font-medium text-text-primary">{task.assignee.name}</span>
            </div>
          ) : (
            <p className="mt-2 text-sm text-text-secondary">Nao atribuido</p>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-text-muted">Criador</p>
          <p className="mt-2 text-sm text-text-primary">{task.creator?.name ?? "Nao informado"}</p>
        </div>
      </div>
    </aside>
  );
}
