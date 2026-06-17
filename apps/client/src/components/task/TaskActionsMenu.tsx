import { MoreHorizontal } from "lucide-react";
import type { Task } from "shared";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from "../ui/dropdown-menu";
import { TaskCommonActionItems } from "./TaskCommonActionItems";

interface TaskActionsMenuProps {
  task: Task;
  projectId?: string;
  fallbackLinkPath?: string;
  onDeleted?: () => void;
}

export function TaskActionsMenu({ task, projectId, fallbackLinkPath, onDeleted }: TaskActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-9 w-9 px-0"
          title="Ações da tarefa"
          aria-label="Ações da tarefa"
        >
          <MoreHorizontal size={18} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <TaskCommonActionItems
          task={task}
          menu="dropdown"
          projectId={projectId}
          fallbackLinkPath={fallbackLinkPath}
          onDeleted={onDeleted}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
