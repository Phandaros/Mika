import { Check, ChevronDown, Search } from "lucide-react";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { formatMultiSelectTriggerLabel, isAllSelected } from "../../lib/multiSelectFilter";
import { cn } from "../../lib/utils";
import { coloredFieldStyle } from "../shared/statusVisuals";
import { Button } from "./button";
import { Input } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import type { SearchableSelectOption } from "./searchable-select";

interface SearchableMultiSelectProps {
  values: string[];
  options: SearchableSelectOption[];
  onValuesChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  allSelectedLabel?: string;
  noneSelectedLabel?: string;
  partialSelectedLabel?: (count: number) => string;
  renderOption?: (option: SearchableSelectOption) => ReactNode;
  renderTrigger?: (values: string[], placeholder: string) => ReactNode;
  showIsolateActions?: boolean;
  showBulkActions?: boolean;
}

export function SearchableMultiSelect({
  values,
  options,
  onValuesChange,
  placeholder = "Selecionar",
  searchPlaceholder = "Buscar...",
  emptyText = "Nenhuma opção encontrada",
  emptyMessage,
  disabled,
  className,
  triggerClassName,
  contentClassName,
  allSelectedLabel = "Todos",
  noneSelectedLabel = "Nenhum selecionado",
  partialSelectedLabel = (count) => `${count} selecionados`,
  renderOption,
  renderTrigger,
  showIsolateActions = false,
  showBulkActions = true
}: SearchableMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedSet = useMemo(() => new Set(values), [values]);
  const allValues = useMemo(() => options.map((option) => option.value), [options]);
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

  const triggerLabel = formatMultiSelectTriggerLabel(values, allValues, {
    all: allSelectedLabel,
    none: noneSelectedLabel,
    partial: partialSelectedLabel
  });

  function toggleOption(optionValue: string) {
    const nextValues = selectedSet.has(optionValue)
      ? values.filter((value) => value !== optionValue)
      : [...values, optionValue];

    onValuesChange(nextValues);
  }

  function selectAll() {
    onValuesChange([...allValues]);
  }

  function clearAll() {
    onValuesChange([]);
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
          <span className={cn("min-w-0 flex-1 overflow-hidden", values.length > 0 ? "text-text-primary" : "text-text-muted")}>
            {renderTrigger ? renderTrigger(values, placeholder) : values.length > 0 ? triggerLabel : placeholder}
          </span>
          <ChevronDown size={16} className="shrink-0 text-text-muted" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        onWheel={(event) => event.stopPropagation()}
        className={cn(
          "min-w-[var(--radix-popover-trigger-width)] w-[min(360px,calc(100vw-32px))] max-w-[min(420px,calc(100vw-32px))] overflow-x-hidden p-2",
          contentClassName
        )}
      >
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
        <div
          className="mt-2 max-h-72 overscroll-contain overflow-y-auto"
          onWheel={(event) => event.stopPropagation()}
          onTouchMove={(event) => event.stopPropagation()}
        >
          {filteredOptions.length > 0 ? (
            <div className="grid gap-1">
              {filteredOptions.map((option) => {
                const checked = selectedSet.has(option.value);

                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={option.disabled}
                    onClick={() => toggleOption(option.value)}
                    className={cn(
                      "flex min-h-9 w-full min-w-0 items-center gap-2 overflow-hidden rounded-md border border-transparent px-2 py-1.5 text-left text-sm font-semibold text-text-primary transition hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50",
                      checked ? "bg-surface-hover" : ""
                    )}
                    style={option.color ? coloredFieldStyle(option.color) : undefined}
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                        checked ? "border-brand-orange bg-brand-orange/15" : "border-border bg-bg-2"
                      )}
                    >
                      {checked ? <Check size={12} className="text-brand-orange" /> : null}
                    </span>
                    <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                      {renderOption?.(option) ?? option.render ?? <DefaultOption option={option} />}
                    </span>
                    {showIsolateActions ? (
                      <span
                        role="button"
                        tabIndex={0}
                        className="ml-auto shrink-0 text-[11px] font-semibold text-[--color-text-secondary] transition hover:text-brand-orange"
                        onClick={(event) => {
                          event.stopPropagation();
                          onValuesChange([option.value]);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            event.stopPropagation();
                            onValuesChange([option.value]);
                          }
                        }}
                      >
                        Apenas
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="px-3 py-6 text-center text-sm text-text-muted">{emptyMessage ?? emptyText}</div>
          )}
        </div>
        {showBulkActions && options.length > 0 ? (
          <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-xs font-semibold">
            <button
              type="button"
              className="text-text-secondary transition hover:text-brand-orange disabled:opacity-50"
              disabled={isAllSelected(selectedSet, allValues)}
              onClick={selectAll}
            >
              Marcar todos
            </button>
            <button
              type="button"
              className="text-text-secondary transition hover:text-brand-orange disabled:opacity-50"
              disabled={values.length === 0}
              onClick={clearAll}
            >
              Desmarcar todos
            </button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function DefaultOption({ option }: { option: SearchableSelectOption }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      {option.avatarUrl || option.description ? <OptionAvatar option={option} /> : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{option.label}</span>
        {option.description ? <span className="block truncate text-xs font-medium text-text-muted">{option.description}</span> : null}
      </span>
    </span>
  );
}

function OptionAvatar({ option }: { option: SearchableSelectOption }) {
  const fallback = option.label
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  if (option.avatarUrl) {
    return <img src={option.avatarUrl} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />;
  }

  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-[10px] font-bold text-text-primary"
      style={avatarStyle(option.color)}
    >
      {fallback || "?"}
    </span>
  );
}

function avatarStyle(color?: string | null): CSSProperties {
  return color ? coloredFieldStyle(color) : { backgroundColor: "var(--color-surface-hover)" };
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
