import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  icon?: ReactNode;
  children?: ReactNode;
}

export function EmptyState({ title, icon, children }: EmptyStateProps) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-md border border-dashed border-border bg-surface-card p-8 text-center">
      {icon ? <div className="mb-3 text-text-muted">{icon}</div> : null}
      <h3 className="text-base font-semibold text-text-primary">{title}</h3>
      {children ? <p className="mt-2 max-w-md text-sm text-text-secondary">{children}</p> : null}
    </div>
  );
}
