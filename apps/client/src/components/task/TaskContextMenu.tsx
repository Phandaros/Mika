import { useMemo, type MouseEvent, type ReactNode } from "react";
import {
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  CopyPlus,
  Eye,
  RefreshCw,
  RotateCcw,
  Trash2
} from "lucide-react";
import { Role, type Task } from "shared";
import { useAuth } from "../../hooks/useAuth";
import { useDeferredTaskDelete } from "../../hooks/useDeferredTaskDelete";
import { useTaskContextActions } from "../../hooks/useTaskContextActions";
import { useUsers } from "../../hooks/useUsers";
import { canCompleteTasks, canManageTasks } from "../../lib/permissions";
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
import { TaskCommonActionItems } from "./TaskCommonActionItems";

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
  const { user } = useAuth();
  const canManage = canManageTasks(user);
  const canComplete = canCompleteTasks(user);
  const { scheduleTaskDelete } = useDeferredTaskDelete(projectId);
  const { data: users = [] } = useUsers();
  const {
    duplicateTask,
    recalculateDates,
    changeStatus,
    toggleCompletion,
    sendToReview,
    canRecalculate,
    canSendToReview,
    isDuplicating,
    isUpdating
  } = useTaskContextActions(task, projectId);

  const statusOptions = editableTaskStatusOptions(task);
  const reviewerOptions = useMemo(
    () =>
      users
        .filter((item) => item.isActive && (item.role === Role.ADMIN || item.role === Role.COORDINATOR))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [users]
  );
  const currentReviewer = task.pendingReview?.reviewer;
  const currentReviewerName = currentReviewer?.name ?? (task.pendingReview ? "Sem revisor" : null);
  const reviewTriggerLabel = currentReviewerName ? `Revisão: ${currentReviewerName}` : "Enviar para revisão";

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
        <TaskCommonActionItems
          task={task}
          menu="context"
          projectId={projectId}
          fallbackLinkPath={fallbackLinkPath}
          includeDelete={false}
        />
        {canComplete ? (
          <ContextMenuItem disabled={isUpdating} onSelect={() => void toggleCompletion()}>
            {task.completed ? <RotateCcw className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            {task.completed ? "Reabrir tarefa" : "Marcar como concluída"}
          </ContextMenuItem>
        ) : null}
        {canManage && canSendToReview ? (
          <ContextMenuSub>
            <ContextMenuSubTrigger disabled={isUpdating || reviewerOptions.length === 0}>
              <ClipboardCheck className="h-4 w-4" />
              <span className="max-w-[180px] truncate">{reviewTriggerLabel}</span>
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-64">
              {reviewerOptions.length === 0 ? (
                <ContextMenuItem disabled>Nenhum coordenador ativo</ContextMenuItem>
              ) : (
                reviewerOptions.map((reviewer) => {
                  const isCurrentReviewer = reviewer.id === task.pendingReview?.reviewerId;

                  return (
                    <ContextMenuItem
                      key={reviewer.id}
                      disabled={isCurrentReviewer || isUpdating}
                      onSelect={() => void sendToReview(reviewer.id)}
                    >
                      {isCurrentReviewer ? <Check className="h-4 w-4 text-brand-orange" /> : <span className="h-4 w-4" />}
                      <span className="min-w-0 flex-1 truncate">{reviewer.name}</span>
                      <span className="ml-auto text-[11px] font-semibold text-text-muted">
                        {reviewer.role === Role.ADMIN ? "Admin" : "Coord."}
                      </span>
                    </ContextMenuItem>
                  );
                })
              )}
            </ContextMenuSubContent>
          </ContextMenuSub>
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
