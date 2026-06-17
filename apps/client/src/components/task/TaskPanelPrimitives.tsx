import { Fragment, type ReactNode, type RefObject } from "react";
import { CheckCircle2, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";

export const compactSelectTriggerClassName =
  "h-7 min-h-0 w-auto min-w-[84px] justify-start border-transparent bg-transparent px-1.5 text-left hover:bg-[--bg-3]";
export const compactDatePickerClassName =
  "h-7 min-h-0 w-auto min-w-[112px] justify-between border-transparent bg-transparent px-1.5 text-[13px] hover:bg-[--bg-3]";
export const compactInputClassName =
  "h-7 min-h-0 w-[112px] border-transparent bg-transparent px-1.5 text-[13px] hover:bg-[--bg-3] focus:bg-[--bg-3]";

interface TaskPanelShellProps {
  isOpen: boolean;
  asideRef?: RefObject<HTMLElement>;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  headerContent?: ReactNode;
  headerActions?: ReactNode;
}

export function TaskPanelShell({
  isOpen,
  asideRef,
  onClose,
  children,
  footer,
  headerContent,
  headerActions
}: TaskPanelShellProps) {
  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-0 z-40 bg-brand-black/60 transition-opacity duration-500 ease-out",
        isOpen ? "opacity-100" : "opacity-0"
      )}
      aria-hidden={!isOpen}
    >
      <aside
        ref={asideRef}
        className={cn(
          "pointer-events-auto fixed inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l border-border bg-surface shadow-2xl transition-transform duration-500 ease-out-expo will-change-transform",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between gap-4 border-b border-border bg-[--bg-2] px-6 py-4">
          <div className="min-w-0 flex-1">
            {headerContent ?? (
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <CheckCircle2 size={18} />
                <span>Tarefa</span>
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {headerActions}
            <Button variant="ghost" className="h-9 w-9 px-0" onClick={onClose} title="Fechar" aria-label="Fechar">
              <X size={18} />
            </Button>
          </div>
        </div>

        {children}
        {footer}
      </aside>
    </div>
  );
}

export function TaskFixedFieldGrid({
  fields
}: {
  fields: Array<{
    key: string;
    label: string;
    render: () => ReactNode;
  }>;
}) {
  return (
    <div className="mt-6 grid grid-cols-[140px_1fr] gap-x-4" data-testid="task-detail-field-grid">
      {fields.map((field) => (
        <Fragment key={field.key}>
          <div className="flex min-h-[32px] items-center border-b border-[--color-border-subtle]">
            <span className="text-[13px] font-normal text-[--color-text-secondary]">{field.label}</span>
          </div>
          <div className="flex min-h-[32px] items-center border-b border-[--color-border-subtle]">
            {field.render()}
          </div>
        </Fragment>
      ))}
    </div>
  );
}

export function DetailRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="relative grid min-h-10 grid-cols-[136px_minmax(0,1fr)] items-start gap-2">
      <div className="flex min-h-10 items-center gap-2 text-text-secondary">
        <span className="shrink-0">{icon}</span>
        <span className="min-w-0 leading-5">{label}</span>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function EmptyField() {
  return <span className="text-[13px] text-[--color-text-muted]">—</span>;
}

export function FieldPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("absolute left-36 top-11 z-50 grid max-h-72 w-64 gap-1 overflow-y-auto rounded-md border border-border bg-surface-card p-2 shadow-2xl", className)}>
      {children}
    </div>
  );
}

export function formatDecimal(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}
