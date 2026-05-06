import type { Discipline } from "shared";
import { cn } from "../../lib/utils";

interface DisciplineTabProps {
  discipline: Discipline;
  active: boolean;
  onClick: () => void;
}

export function DisciplineTab({ discipline, active, onClick }: DisciplineTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-3 py-2 text-sm font-semibold transition",
        active
          ? "border-brand-orange bg-brand-orange text-brand-white"
          : "border-border bg-surface-card text-text-secondary hover:bg-surface-hover hover:text-text-primary"
      )}
    >
      {discipline.name}
    </button>
  );
}
