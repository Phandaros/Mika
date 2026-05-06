import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantClass: Record<ButtonVariant, string> = {
  primary: "bg-brand-orange text-brand-white hover:bg-orange-600",
  secondary: "border border-border bg-surface-card text-text-primary hover:bg-surface-hover",
  ghost: "text-text-secondary hover:bg-surface-hover hover:text-text-primary",
  danger: "bg-red-600 text-brand-white hover:bg-red-700"
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        variantClass[variant],
        className
      )}
      {...props}
    />
  )
);

Button.displayName = "Button";
