import type { MouseEvent, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  ChevronRight,
  Copy,
  CopyPlus,
  Eye,
  FolderKanban,
  RefreshCw,
  RotateCcw,
  Trash2
} from "lucide-react";
import type { Task } from "shared";
import { useAuth } from "../../hooks/useAuth";
import { useCopyTaskLink } from "../../hooks/useCopyTaskLink";
import { useDeferredTaskDelete } from "../../hooks/useDeferredTaskDelete";
import { useTaskContextActions } from "../../hooks/useTaskContextActions";
import { canCompleteTasks, canManageTasks } from "../../lib/permissions";
import { resolveTaskProjectId } from "../../lib/taskLink";
import { editableTaskStatusOptions, taskStatusLabels } from "../shared/Chip";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger
} from "../ui/context-menu";

interface TaskContextMenuProps<TTask extends Task> {
  task: TTask;
  children: ReactNode;
  onOpen: (task: TTask) => void;
  projectId?: string;
  fallbackLinkPath?: string;
  onContextMenu?: (event: MouseEvent) => void;
}

export function TaskContextMenu<TTask extends Task>({
  task,
  children,
  onOpen,
  projectId,
  fallbackLinkPath,
  onContextMenu
}: TaskContextMenuProps<TTask>) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = canManageTasks(user);
  const canComplete = canCompleteTasks(user);
  const { copyTaskLink } = useCopyTaskLink();
  const { scheduleTaskDelete } = useDeferredTaskDelete(projectId);
  const {
    duplicateTask,
    recalculateDates,
    changeStatus,
    toggleCompletion,
    canRecalculate,
    isDuplicating,
    isUpdating
  } = useTaskContextActions(task, projectId);

  const taskProjectId = resolveTaskProjectId(task);
  const statusOptions = editableTaskStatusOptions(task);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild onContextMenu={onContextMenu}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => onOpen(task)}>
          <Eye className="h-4 w-4" />
          Abrir detalhes da tarefa
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => void copyTaskLink(task, { fallbackPath: fallbackLinkPath })}>
          <Copy className="h-4 w-4" />
          Copiar link da tarefa
        </ContextMenuItem>
        {taskProjectId ? (
          <ContextMenuItem onSelect={() => navigate(`/projects/${taskProjectId}`)}>
            <FolderKanban className="h-4 w-4" />
            Abrir projeto
          </ContextMenuItem>
        ) : null}
        {canComplete ? (
          <ContextMenuItem disabled={isUpdating} onSelect={() => void toggleCompletion()}>
            {task.completed ? <RotateCcw className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            {task.completed ? "Reabrir tarefa" : "Marcar como concluída"}
          </ContextMenuItem>
        ) : null}
        {canManage ? (
          <ContextMenuSub>
            <ContextMenuSubTrigger disabled={isUpdating}>
              <ChevronRight className="h-4 w-4" />
              Alterar status
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {statusOptions.map((status) => (
                <ContextMenuItem
                  key={status}
                  disabled={status === task.status || isUpdating}
                  onSelect={() => void changeStatus(status)}
                >
                  {taskStatusLabels[status]}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        ) : null}
        {canManage ? (
          <ContextMenuItem disabled={isDuplicating} onSelect={() => void duplicateTask()}>
            <CopyPlus className="h-4 w-4" />
            Duplicar tarefa
          </ContextMenuItem>
        ) : null}
        {canManage ? (
          <ContextMenuItem disabled={!canRecalculate || isUpdating} onSelect={() => void recalculateDates()}>
            <RefreshCw className="h-4 w-4" />
            Recalcular datas
          </ContextMenuItem>
        ) : null}
        {canManage ? (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive" onSelect={() => scheduleTaskDelete(task)}>
              <Trash2 className="h-4 w-4" />
              Excluir a tarefa
            </ContextMenuItem>
          </>
        ) : null}
      </ContextMenuContent>
    </ContextMenu>
  );
}
