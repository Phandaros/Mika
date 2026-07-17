import type { TaskSearchMatchContext } from "shared";
import { findNormalizedMatchRange } from "../../lib/searchHighlight";
import { cn } from "../../lib/utils";

interface SearchMatchContextProps {
  context: TaskSearchMatchContext;
  query: string;
  compact?: boolean;
}

export function SearchMatchContext({ context, query, compact = false }: SearchMatchContextProps) {
  const range = findNormalizedMatchRange(context.excerpt, query);
  const label = context.source === "description" ? "Descrição" : "Comentário";

  return (
    <p className={cn("min-w-0 truncate text-xs text-text-muted", compact ? "w-full" : "mt-1")}>
      <span className="font-medium text-text-secondary">{label}:</span>{" "}
      {range ? (
        <>
          {context.excerpt.slice(0, range.start)}
          <mark className="rounded-sm bg-brand-orange/20 px-0.5 text-text-primary">
            {context.excerpt.slice(range.start, range.end)}
          </mark>
          {context.excerpt.slice(range.end)}
        </>
      ) : (
        context.excerpt
      )}
    </p>
  );
}
