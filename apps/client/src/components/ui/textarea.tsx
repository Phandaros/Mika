import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "min-h-24 w-full rounded-md border border-border bg-brand-black px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-brand-orange",
        className
      )}
      {...props}
    />
  )
);

Textarea.displayName = "Textarea";
