import { useMemo, type MouseEvent, type ReactNode } from "react";
import {
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  CopyPlus,
  Eye,
  ExternalLink,
  GitBranch,
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
import { openTaskInNewContext } from "../../lib/taskLink";
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
    splitTask,
    recalculateDates,
    changeStatus,
    toggleCompletion,
    sendToReview,
    canRecalculate,
    canSendToReview,
    canSplitTask,
    isDuplicating,
    isSplitting,
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
  const newContextLabel = window.mkProjetos?.isDesktop === true ? "Abrir em nova janela" : "Abrir em nova guia";

  function shouldIgnoreNewContextGesture(event: MouseEvent): boolean {
    if (!(event.target instanceof Element) || !(event.currentTarget instanceof Element)) {
      return false;
    }

    if (event.target.closest("[data-task-open-ignore='true']")) {
      return true;
    }

    const interactiveTarget = event.target.closest(
      "a, button, input, textarea, select, [contenteditable='true'], [role='button'], [role='checkbox'], [role='combobox'], [role='menuitem']"
    );

    return interactiveTarget !== null && interactiveTarget !== event.currentTarget;
  }

  function openInNewContext() {
    openTaskInNewContext(task, { projectId, fallbackPath: fallbackLinkPath });
  }

  function handleTriggerClickCapture(event: MouseEvent) {
    if (event.button !== 0 || (!event.ctrlKey && !event.metaKey) || shouldIgnoreNewContextGesture(event)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    openInNewContext();
  }

  function handleTriggerAuxClickCapture(event: MouseEvent) {
    if (event.button !== 1 || shouldIgnoreNewContextGesture(event)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    openInNewContext();
  }

  function handleTriggerMouseDownCapture(event: MouseEvent) {
    if (event.button === 1 && !shouldIgnoreNewContextGesture(event)) {
      event.preventDefault();
    }
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger
        asChild
        onContextMenu={onContextMenu}
        onClickCapture={handleTriggerClickCapture}
        onAuxClickCapture={handleTriggerAuxClickCapture}
        onMouseDownCapture={handleTriggerMouseDownCapture}
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => onOpen(task)}>
          <Eye className="h-4 w-4" />
          Abrir detalhes da tarefa
        </ContextMenuItem>
        <ContextMenuItem onSelect={openInNewContext}>
          <ExternalLink className="h-4 w-4" />
          {newContextLabel}
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
          <ContextMenuItem disabled={!canSplitTask || isSplitting || isUpdating} onSelect={() => void splitTask()}>
            <GitBranch className="h-4 w-4" />
            Dividir tarefa
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
