import { useMemo, useState } from "react";
import { Check, Plus } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

export type BuilderComboboxVariant = "form" | "table";

interface BuilderComboboxProps {
  value: string;
  suggestions: string[];
  onChange: (value: string) => void;
  variant?: BuilderComboboxVariant;
}

export function BuilderCombobox({ value, suggestions, onChange, variant = "form" }: BuilderComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const normalizedQuery = normalizeSearch(query);
  const normalizedValue = normalizeSearch(value);
  const options = useMemo(
    () =>
      Array.from(new Set(suggestions.map((suggestion) => suggestion.trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "pt-BR")
      ),
    [suggestions]
  );
  const visibleOptions = options.filter((suggestion) => !normalizedQuery || normalizeSearch(suggestion).includes(normalizedQuery));
  const canCreate = Boolean(query.trim()) && !options.some((suggestion) => normalizeSearch(suggestion) === normalizedQuery);

  function selectBuilder(nextValue: string) {
    onChange(nextValue.trim());
    setOpen(false);
  }

  const triggerClassName =
    variant === "table"
      ? "h-7 min-h-0 w-full min-w-0 justify-start border-transparent bg-transparent px-1.5 text-left text-[13px] font-normal hover:bg-[--bg-3]"
      : "h-10 w-full justify-between px-3 text-left";

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setQuery(value);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button variant={variant === "table" ? "ghost" : "secondary"} className={triggerClassName}>
          <span className={cn("min-w-0 truncate", value ? "text-text-primary" : "text-text-muted")}>
            {value || (variant === "table" ? "—" : "Selecionar construtora")}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(360px,calc(100vw-32px))] overflow-x-hidden p-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && query.trim()) {
              event.preventDefault();
              selectBuilder(query);
            }
          }}
          placeholder="Buscar ou adicionar construtora..."
          className="h-9"
          autoFocus
        />
        <div className="mt-2 max-h-64 overflow-y-auto overscroll-contain">
          <div className="grid gap-1">
            {value ? (
              <button
                type="button"
                onClick={() => selectBuilder("")}
                className="flex min-h-9 w-full min-w-0 items-center gap-2 overflow-hidden rounded-md px-2 py-1.5 text-left text-sm font-semibold text-text-muted transition hover:bg-surface-hover"
              >
                <span className="flex h-4 w-4 shrink-0" />
                <span className="min-w-0 truncate">Sem construtora</span>
              </button>
            ) : null}
            {canCreate ? (
              <button
                type="button"
                onClick={() => selectBuilder(query)}
                className="flex min-h-9 w-full min-w-0 items-center gap-2 overflow-hidden rounded-md px-2 py-1.5 text-left text-sm font-semibold text-text-primary transition hover:bg-surface-hover"
              >
                <Plus size={15} className="shrink-0 text-brand-orange" />
                <span className="min-w-0 truncate">Adicionar "{query.trim()}"</span>
              </button>
            ) : null}
            {visibleOptions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => selectBuilder(suggestion)}
                className={cn(
                  "flex min-h-9 w-full min-w-0 items-center gap-2 overflow-hidden rounded-md px-2 py-1.5 text-left text-sm font-semibold text-text-primary transition hover:bg-surface-hover",
                  normalizeSearch(suggestion) === normalizedValue ? "bg-surface-hover" : ""
                )}
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  {normalizeSearch(suggestion) === normalizedValue ? <Check size={15} className="text-brand-orange" /> : null}
                </span>
                <span className="min-w-0 truncate">{suggestion}</span>
              </button>
            ))}
            {visibleOptions.length === 0 && !canCreate ? (
              <div className="px-3 py-6 text-center text-sm text-text-muted">Nenhuma construtora encontrada</div>
            ) : null}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
