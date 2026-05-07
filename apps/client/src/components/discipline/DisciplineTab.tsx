import { getDefaultDiscipline, type Discipline } from "shared";
import { cn } from "../../lib/utils";

interface DisciplineTabProps {
  discipline: Discipline;
  active: boolean;
  onClick: () => void;
}

export function DisciplineTab({ discipline, active, onClick }: DisciplineTabProps) {
  const catalogItem = getDefaultDiscipline(discipline.type);

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
      <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: catalogItem.color }} />
      {discipline.name}
    </button>
  );
}
