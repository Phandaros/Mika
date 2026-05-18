import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";
import { Input } from "./input";

interface DecimalInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "inputMode" | "onChange"> {
  value: string;
  onValueChange?: (value: string) => void;
  onChange?: InputHTMLAttributes<HTMLInputElement>["onChange"];
}

export const DecimalInput = forwardRef<HTMLInputElement, DecimalInputProps>(({ className, onValueChange, onChange, ...props }, ref) => (
  <Input
    ref={ref}
    type="text"
    inputMode="decimal"
    className={cn("tabular-nums", className)}
    onChange={(event) => {
      onChange?.(event);
      onValueChange?.(event.target.value);
    }}
    {...props}
  />
));

DecimalInput.displayName = "DecimalInput";

export function parseDecimalInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = Number(trimmed.replace(",", "."));
  return Number.isNaN(normalized) ? null : normalized;
}
