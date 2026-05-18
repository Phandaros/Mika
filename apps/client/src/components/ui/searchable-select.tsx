import { Check, ChevronDown, Search } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { cn } from "../../lib/utils";
import { Button } from "./button";
import { Input } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export interface SearchableSelectOption {
  value: string;
  label: string;
  description?: string;
  color?: string | null;
  disabled?: boolean;
  render?: ReactNode;
}

interface SearchableSelectProps {
  value: string | null | undefined;
  options: SearchableSelectOption[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  renderValue?: (option: SearchableSelectOption) => ReactNode;
  renderOption?: (option: SearchableSelectOption) => ReactNode;
}

export function SearchableSelect({
  value,
  options,
  onValueChange,
  placeholder = "Selecionar",
  searchPlaceholder = "Buscar...",
  emptyText = "Nenhuma opção encontrada",
  emptyMessage,
  disabled,
  className,
  triggerClassName,
  contentClassName,
  renderValue,
  renderOption
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.value === value);
  const normalizedQuery = normalize(query);
  const filteredOptions = useMemo(
    () =>
      options.filter((option) => {
        if (!normalizedQuery) {
          return true;
        }

        return normalize(`${option.label} ${option.description ?? ""}`).includes(normalizedQuery);
      }),
    [normalizedQuery, options]
  );

  function selectOption(nextValue: string) {
    onValueChange(nextValue);
    setOpen(false);
    setQuery("");
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (!disabled) {
          setOpen(nextOpen);
          if (!nextOpen) {
            setQuery("");
          }
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          className={cn("h-10 w-full justify-between px-3 text-left", className, triggerClassName)}
          disabled={disabled}
        >
          <span className={cn("min-w-0 truncate", selected ? "text-text-primary" : "text-text-muted")}>
            {selected ? renderValue?.(selected) ?? selected.render ?? selected.label : placeholder}
          </span>
          <ChevronDown size={16} className="shrink-0 text-text-muted" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className={cn("w-[var(--radix-popover-trigger-width)] p-2", contentClassName)}>
        <label className="relative block">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 pl-9"
            autoFocus
          />
        </label>
        <div className="mt-2 max-h-72 overflow-y-auto">
          {filteredOptions.length > 0 ? (
            <div className="grid gap-1">
              {filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={option.disabled}
                  onClick={() => selectOption(option.value)}
                  className={cn(
                    "flex min-h-9 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-semibold text-text-primary transition hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50",
                    option.value === value ? "bg-surface-hover" : ""
                  )}
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                    {option.value === value ? <Check size={15} className="text-brand-orange" /> : null}
                  </span>
                  {option.color ? <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: option.color }} /> : null}
                  <span className="min-w-0 flex-1">
                    {renderOption?.(option) ?? option.render ?? (
                      <>
                        <span className="block truncate">{option.label}</span>
                        {option.description ? <span className="block truncate text-xs text-text-muted">{option.description}</span> : null}
                      </>
                    )}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-3 py-6 text-center text-sm text-text-muted">{emptyMessage ?? emptyText}</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
