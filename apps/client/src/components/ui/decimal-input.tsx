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
  const trimmed = value.trim().replace(/\s/g, "");
  if (!trimmed) {
    return null;
  }

  const lastComma = trimmed.lastIndexOf(",");
  const lastDot = trimmed.lastIndexOf(".");
  const hasComma = lastComma !== -1;
  const hasDot = lastDot !== -1;
  let normalized = trimmed;

  if (hasComma && hasDot) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandSeparator = decimalSeparator === "," ? "." : ",";
    normalized = trimmed.split(thousandSeparator).join("").replace(decimalSeparator, ".");
  } else if (hasComma) {
    normalized = trimmed.split(".").join("").replace(",", ".");
  } else if ((trimmed.match(/\./g) ?? []).length > 1) {
    normalized = trimmed.split(".").join("");
  }

  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}
