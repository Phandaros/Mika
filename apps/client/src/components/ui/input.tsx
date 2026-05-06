import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-md border border-border bg-brand-black px-3 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-brand-orange",
        className
      )}
      {...props}
    />
  )
);

Input.displayName = "Input";
