import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: "default" | "orange" | "blue" | "green" | "purple" | "red" | "yellow" | "muted";
}

const toneVars: Record<NonNullable<BadgeProps["tone"]>, { bg: string; text: string; border: string }> = {
  default: { bg: "var(--bg-2)", text: "var(--color-text-primary)", border: "var(--color-border)" },
  orange: { bg: "var(--priority-high-bg)", text: "var(--priority-high-text)", border: "var(--priority-high-bg)" },
  blue: { bg: "var(--status-inprogress-bg)", text: "var(--status-inprogress-text)", border: "var(--status-inprogress-bg)" },
  green: { bg: "var(--status-done-bg)", text: "var(--status-done-text)", border: "var(--status-done-bg)" },
  purple: { bg: "var(--status-analysis-bg)", text: "var(--status-analysis-text)", border: "var(--status-analysis-bg)" },
  red: { bg: "var(--status-late-bg)", text: "var(--status-late-text)", border: "var(--status-late-bg)" },
  yellow: { bg: "var(--priority-medium-bg)", text: "var(--priority-medium-text)", border: "var(--priority-medium-bg)" },
  muted: { bg: "var(--disc-none-bg)", text: "var(--disc-none-text)", border: "var(--disc-none-bg)" }
};

export function Badge({ className, tone = "default", style, ...props }: BadgeProps) {
  const vars = toneVars[tone];

  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-md border px-2 text-xs font-semibold",
        className
      )}
      style={{ backgroundColor: vars.bg, borderColor: vars.border, color: vars.text, ...style }}
      {...props}
    />
  );
}
