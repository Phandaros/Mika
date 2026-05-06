import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: "default" | "orange" | "blue" | "green" | "purple" | "red" | "yellow" | "muted";
}

const toneClass: Record<NonNullable<BadgeProps["tone"]>, string> = {
  default: "border-border bg-surface-card text-text-primary",
  orange: "border-orange-500/40 bg-orange-500/15 text-orange-300",
  blue: "border-blue-500/40 bg-blue-500/15 text-blue-300",
  green: "border-green-500/40 bg-green-500/15 text-green-300",
  purple: "border-purple-500/40 bg-purple-500/15 text-purple-300",
  red: "border-red-500/40 bg-red-500/15 text-red-300",
  yellow: "border-yellow-500/40 bg-yellow-500/15 text-yellow-300",
  muted: "border-border bg-surface-hover text-text-secondary"
};

export function Badge({ className, tone = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-md border px-2 text-xs font-semibold",
        toneClass[tone],
        className
      )}
      {...props}
    />
  );
}
