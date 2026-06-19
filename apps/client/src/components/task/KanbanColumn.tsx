import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { type TaskStatus } from "shared";
import { taskStatusLabels } from "../shared/Chip";
import { cn } from "../../lib/utils";

interface KanbanColumnProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  status: TaskStatus;
  label: string;
  count: number;
  isDraggingOver?: boolean;
  isDropBlocked?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  countTestId?: string;
}

export const KanbanColumn = forwardRef<HTMLElement, KanbanColumnProps>(function KanbanColumn(
  {
    status,
    label,
    count,
    isDraggingOver = false,
    isDropBlocked = false,
    children,
    footer,
    countTestId,
    className,
    ...props
  },
  ref
) {
  return (
    <section
      ref={ref}
      className={cn(
        "flex h-[calc(100vh-230px)] min-h-[520px] w-80 flex-none flex-col rounded-md border border-border bg-surface p-3 transition",
        isDraggingOver && !isDropBlocked && "border-brand-orange",
        isDraggingOver && isDropBlocked && "border-[var(--status-late-text)]",
        className
      )}
      {...props}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold text-text-primary">{label}</h2>
          <p className="mt-1 text-xs text-text-muted">{taskStatusLabels[status]}</p>
        </div>
        <span
          data-testid={countTestId}
          className="rounded-md bg-surface-card px-2 py-1 text-xs text-text-secondary"
        >
          {count}
        </span>
      </div>

      <div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto pr-1">{children}</div>
      {footer}
    </section>
  );
});
