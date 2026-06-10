import { useRef } from "react";
import { toast } from "sonner";
import type { Task } from "shared";
import type { TaskCacheSnapshot } from "./useTasks";
import {
  optimisticallyRemoveTaskFromCaches,
  restoreTaskCachesSnapshot,
  snapshotTaskCaches,
  useDeleteTask
} from "./useTasks";
import { resolveTaskProjectId } from "../lib/taskLink";

const DELETE_UNDO_MS = 8000;

type PendingDelete = {
  cancelled: boolean;
  timeoutId: number;
  snapshot: TaskCacheSnapshot;
};

export function useDeferredTaskDelete(projectId?: string) {
  const deleteTask = useDeleteTask(projectId);
  const pendingDeletesRef = useRef<Map<string, PendingDelete>>(new Map());

  async function commitDelete(task: Task) {
    const pending = pendingDeletesRef.current.get(task.id);
    if (!pending || pending.cancelled) {
      return;
    }

    pendingDeletesRef.current.delete(task.id);

    try {
      await deleteTask.mutateAsync(task.id);
    } catch {
      restoreTaskCachesSnapshot(pending.snapshot);
      toast.error("Não foi possível excluir a tarefa");
    }
  }

  function scheduleTaskDelete(task: Task) {
    const resolvedProjectId = projectId ?? resolveTaskProjectId(task);
    const snapshot = snapshotTaskCaches(task.id);
    optimisticallyRemoveTaskFromCaches(task.id, resolvedProjectId);

    const pending: PendingDelete = {
      cancelled: false,
      snapshot,
      timeoutId: window.setTimeout(() => {
        void commitDelete(task);
      }, DELETE_UNDO_MS)
    };

    pendingDeletesRef.current.set(task.id, pending);

    toast.success(`"${task.title}" excluída`, {
      duration: DELETE_UNDO_MS,
      action: {
        label: "Desfazer",
        onClick: () => {
          const currentPending = pendingDeletesRef.current.get(task.id);
          if (!currentPending) {
            return;
          }

          currentPending.cancelled = true;
          window.clearTimeout(currentPending.timeoutId);
          pendingDeletesRef.current.delete(task.id);
          restoreTaskCachesSnapshot(snapshot);
          toast.success("Exclusão desfeita");
        }
      }
    });
  }

  return {
    scheduleTaskDelete,
    isDeleting: deleteTask.isPending
  };
}
