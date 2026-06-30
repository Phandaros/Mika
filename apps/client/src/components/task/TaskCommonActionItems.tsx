import { useRef, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, FolderKanban, Trash2 } from "lucide-react";
import type { Task } from "shared";
import { useAuth } from "../../hooks/useAuth";
import { useCopyTaskLink } from "../../hooks/useCopyTaskLink";
import { useDeferredTaskDelete } from "../../hooks/useDeferredTaskDelete";
import { canManageTasks } from "../../lib/permissions";
import { buildAbsoluteAppUrl } from "../../lib/taskLink";
import { buildOpenProjectPath, resolveTaskProjectTargets } from "../../lib/taskProjectActions";
import { cn } from "../../lib/utils";
import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger
} from "../ui/context-menu";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from "../ui/dropdown-menu";

interface TaskCommonActionItemsProps {
  task: Task;
  menu: "dropdown" | "context";
  projectId?: string;
  fallbackLinkPath?: string;
  onDeleted?: () => void;
  includeDelete?: boolean;
}

export function TaskCommonActionItems({
  task,
  menu,
  projectId,
  fallbackLinkPath,
  onDeleted,
  includeDelete = true
}: TaskCommonActionItemsProps) {
  const navigate = useNavigate();
  const skipNextOpenProjectSelectRef = useRef(false);
  const { user } = useAuth();
  const { copyTaskLink } = useCopyTaskLink();
  const { scheduleTaskDelete } = useDeferredTaskDelete(projectId);
  const canManage = canManageTasks(user);
  const projectTargets = resolveTaskProjectTargets(task);

  const Item = menu === "dropdown" ? DropdownMenuItem : ContextMenuItem;
  const Separator = menu === "dropdown" ? DropdownMenuSeparator : ContextMenuSeparator;
  const Sub = menu === "dropdown" ? DropdownMenuSub : ContextMenuSub;
  const SubTrigger = menu === "dropdown" ? DropdownMenuSubTrigger : ContextMenuSubTrigger;
  const SubContent = menu === "dropdown" ? DropdownMenuSubContent : ContextMenuSubContent;

  function openProject(targetProjectId: string) {
    navigate(buildOpenProjectPath(targetProjectId, task.id));
  }

  function openProjectInNewTab(targetProjectId: string) {
    window.open(buildAbsoluteAppUrl(buildOpenProjectPath(targetProjectId, task.id)), "_blank", "noopener,noreferrer");
  }

  function skipNextOpenProjectSelect() {
    skipNextOpenProjectSelectRef.current = true;
    window.setTimeout(() => {
      skipNextOpenProjectSelectRef.current = false;
    }, 0);
  }

  function handleOpenProjectSelect(event: Event, targetProjectId: string) {
    if (skipNextOpenProjectSelectRef.current) {
      event.preventDefault();
      skipNextOpenProjectSelectRef.current = false;
      return;
    }

    openProject(targetProjectId);
  }

  function handleOpenProjectClick(event: MouseEvent, targetProjectId: string) {
    if (!event.ctrlKey && !event.metaKey) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    skipNextOpenProjectSelect();
    openProjectInNewTab(targetProjectId);
  }

  function handleOpenProjectAuxClick(event: MouseEvent, targetProjectId: string) {
    if (event.button !== 1) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    skipNextOpenProjectSelect();
    openProjectInNewTab(targetProjectId);
  }

  function handleDelete() {
    scheduleTaskDelete(task);
    onDeleted?.();
  }

  const destructiveClassName = "text-red-300 focus:text-red-200";

  return (
    <>
      {projectTargets.length === 1 ? (
        <Item
          onAuxClick={(event) => handleOpenProjectAuxClick(event, projectTargets[0]!.id)}
          onClick={(event) => handleOpenProjectClick(event, projectTargets[0]!.id)}
          onSelect={(event) => handleOpenProjectSelect(event, projectTargets[0]!.id)}
        >
          <FolderKanban className="h-4 w-4" />
          Abrir projeto
        </Item>
      ) : null}
      {projectTargets.length > 1 ? (
        <Sub>
          <SubTrigger>
            <FolderKanban className="h-4 w-4" />
            Abrir projeto
          </SubTrigger>
          <SubContent className="w-64">
            {projectTargets.map((target) => (
              <Item
                key={target.id}
                onAuxClick={(event) => handleOpenProjectAuxClick(event, target.id)}
                onClick={(event) => handleOpenProjectClick(event, target.id)}
                onSelect={(event) => handleOpenProjectSelect(event, target.id)}
              >
                <span className="min-w-0 flex-1 truncate">{target.label}</span>
              </Item>
            ))}
          </SubContent>
        </Sub>
      ) : null}
      <Item onSelect={() => void copyTaskLink(task, { fallbackPath: fallbackLinkPath })}>
        <Copy className="h-4 w-4" />
        Copiar link da tarefa
      </Item>
      {includeDelete && canManage ? (
        <>
          <Separator />
          {menu === "context" ? (
            <ContextMenuItem variant="destructive" onSelect={handleDelete}>
              <Trash2 className="h-4 w-4" />
              Excluir a tarefa
            </ContextMenuItem>
          ) : (
            <DropdownMenuItem className={cn(destructiveClassName)} onSelect={handleDelete}>
              <Trash2 className="h-4 w-4" />
              Excluir a tarefa
            </DropdownMenuItem>
          )}
        </>
      ) : null}
    </>
  );
}
