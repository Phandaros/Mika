import { CheckCircle2, Circle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";

interface TaskCompletionButtonProps {
  completed: boolean;
  disabled?: boolean;
  onToggle: () => void;
  title?: string;
  className?: string;
}

export function TaskCompletionButton({ completed, disabled, onToggle, title, className }: TaskCompletionButtonProps) {
  const [burst, setBurst] = useState(false);
  const prevCompleted = useRef(completed);

  useEffect(() => {
    if (completed && !prevCompleted.current) {
      setBurst(true);
      const timeoutId = window.setTimeout(() => setBurst(false), 650);
      prevCompleted.current = completed;
      return () => window.clearTimeout(timeoutId);
    }
    prevCompleted.current = completed;
  }, [completed]);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      className={cn(
        "flex h-5 w-5 flex-none items-center justify-center rounded-full text-text-secondary transition-colors hover:text-brand-orange disabled:pointer-events-none disabled:opacity-40",
        className
      )}
      title={title ?? (completed ? "Reabrir tarefa" : "Concluir tarefa")}
    >
      {completed ? (
        <CheckCircle2
          size={16}
          className={cn("text-emerald-400", burst ? "animate-task-complete-pop" : "")}
        />
      ) : (
        <Circle size={16} />
      )}
    </button>
  );
}
