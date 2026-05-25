import { useEffect, useMemo } from "react";
import { Inbox, X } from "lucide-react";
import type { DisciplineType, Task } from "shared";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";

export const WORKLOAD_TASK_DRAG_MIME = "application/x-mk-workload-task";

type TaskWithDiscipline = Task & {
  discipline: {
    id: string;
    name: string;
    projectId: string;
    projectName?: string | null;
    type: DisciplineType;
  };
};

type WorkloadUndatedPanelProps = {
  open: boolean;
  onClose: () => void;
  tasks: TaskWithDiscipline[];
  labelForTask: (task: TaskWithDiscipline) => string;
  statusColorFor: (status: string) => string;
  onOpenTask: (task: TaskWithDiscipline) => void;
};

export function WorkloadUndatedPanel({
  open,
  onClose,
  tasks,
  labelForTask,
  statusColorFor,
  onOpenTask
}: WorkloadUndatedPanelProps) {
  const sorted = useMemo(
    () => [...tasks].sort((a, b) => a.title.localeCompare(b.title, "pt-BR")),
    [tasks]
  );

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (tasks.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-[35] bg-brand-black/60 transition-opacity duration-500 ease-out",
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      )}
      aria-hidden={!open}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Fechar painel"
        onClick={onClose}
      />
      <aside
        className={cn(
          "pointer-events-auto absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-border bg-surface shadow-2xl transition-transform duration-500 ease-out-expo will-change-transform",
          open ? "translate-x-0" : "translate-x-full"
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <Inbox size={18} />
            <span className="font-medium text-text-primary">Sem datas</span>
            <span className="rounded-md bg-bg-2 px-2 py-0.5 text-xs text-text-muted">{tasks.length}</span>
          </div>
          <Button type="button" variant="ghost" className="h-9 w-9 px-0" onClick={onClose} title="Fechar">
            <X size={18} />
          </Button>
        </div>
        <p className="shrink-0 border-b border-border-subtle px-4 py-2 text-xs text-text-muted">
          Arraste uma tarefa para a grade de datas para definir início e entrega no mesmo dia.
        </p>
        <ul className="min-h-0 flex-1 list-none space-y-1 overflow-y-auto p-3">
          {sorted.map((task) => (
            <li key={task.id}>
              <button
                type="button"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData(WORKLOAD_TASK_DRAG_MIME, task.id);
                  event.dataTransfer.effectAllowed = "copyMove";
                }}
                onClick={() => onOpenTask(task)}
                className="flex w-full cursor-grab items-center gap-2 rounded-md border border-border bg-bg-1 px-3 py-2 text-left text-sm font-medium text-text-primary transition hover:border-brand-orange active:cursor-grabbing"
                style={{ borderLeftWidth: 3, borderLeftColor: statusColorFor(task.status) }}
              >
                <span className="min-w-0 flex-1 truncate">{labelForTask(task)}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
