import { useEffect, useRef, useState } from "react";
import type { TeamBoardTaskDto } from "shared";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { TeamBoardTaskCard } from "./TeamBoardTaskCard";
import { cn } from "../../lib/utils";

const OPEN_DELAY_MS = 200;
const CLOSE_DELAY_MS = 150;

interface TeamBoardOtherTasksPopoverProps {
  tasks: TeamBoardTaskDto[];
  today: string;
  nonWorkingDays: Set<string>;
  onOpenTask: (task: TeamBoardTaskDto) => void;
}

export function TeamBoardOtherTasksPopover({
  tasks,
  today,
  nonWorkingDays,
  onOpenTask
}: TeamBoardOtherTasksPopoverProps) {
  const [open, setOpen] = useState(false);
  const openTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (openTimerRef.current != null) {
        window.clearTimeout(openTimerRef.current);
      }
      if (closeTimerRef.current != null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  if (tasks.length === 0) {
    return null;
  }

  function clearTimers() {
    if (openTimerRef.current != null) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }

    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function scheduleOpen() {
    clearTimers();
    openTimerRef.current = window.setTimeout(() => {
      setOpen(true);
      openTimerRef.current = null;
    }, OPEN_DELAY_MS);
  }

  function scheduleClose() {
    clearTimers();
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      closeTimerRef.current = null;
    }, CLOSE_DELAY_MS);
  }

  function handleOpenChange(nextOpen: boolean) {
    clearTimers();
    setOpen(nextOpen);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center rounded-md border border-border bg-surface-card px-2 py-1 text-[11px] font-semibold text-text-secondary transition hover:border-brand-orange hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
          )}
          onMouseEnter={scheduleOpen}
          onMouseLeave={scheduleClose}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
        >
          +{tasks.length} outra{tasks.length === 1 ? "" : "s"}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 overflow-x-hidden p-2"
        onMouseEnter={scheduleOpen}
        onMouseLeave={scheduleClose}
      >
        <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Outras tarefas</p>
        <div className="grid max-h-72 gap-2 overflow-y-auto overflow-x-hidden pr-1">
          {tasks.map((task) => (
            <TeamBoardTaskCard
              key={task.id}
              task={task}
              today={today}
              nonWorkingDays={nonWorkingDays}
              onOpen={onOpenTask}
              variant="compact"
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
