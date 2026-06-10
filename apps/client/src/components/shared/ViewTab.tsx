import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export function ViewTab({
  active,
  icon,
  label,
  onClick
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-9 items-center gap-1 border-b-2 border-transparent",
        active ? "border-text-primary text-text-primary" : "hover:text-text-primary"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
