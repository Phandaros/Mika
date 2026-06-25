import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { ClipboardList, FolderKanban, ListTodo, UserRound } from "lucide-react";
import type { MentionEntityType, MentionSuggestionItem } from "../../lib/mentionUtils";
import { cn } from "../../lib/utils";

export interface MentionListHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

interface MentionListProps {
  items: MentionSuggestionItem[];
  command: (item: MentionSuggestionItem) => void;
}

function MentionIcon({ type }: { type: MentionEntityType }) {
  if (type === "user") {
    return <UserRound size={14} className="shrink-0 text-text-muted" />;
  }

  if (type === "task") {
    return <ListTodo size={14} className="shrink-0 text-text-muted" />;
  }

  if (type === "meeting-minute") {
    return <ClipboardList size={14} className="shrink-0 text-text-muted" />;
  }

  return <FolderKanban size={14} className="shrink-0 text-text-muted" />;
}

function groupLabel(type: MentionEntityType): string {
  if (type === "user") {
    return "Usuários";
  }

  if (type === "task") {
    return "Tarefas";
  }

  if (type === "meeting-minute") {
    return "Atas de reunião";
  }

  return "Projetos";
}

export const MentionList = forwardRef<MentionListHandle, MentionListProps>(function MentionList({ items, command }, ref) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((index) => (index + items.length - 1) % Math.max(items.length, 1));
        return true;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((index) => (index + 1) % Math.max(items.length, 1));
        return true;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const item = items[selectedIndex];

        if (item) {
          command(item);
        }

        return true;
      }

      return false;
    }
  }));

  if (items.length === 0) {
    return (
      <div className="w-72 rounded-md border border-border bg-bg-2 p-3 text-[13px] text-text-muted shadow-lg">
        Nenhum resultado.
      </div>
    );
  }

  let lastType: MentionEntityType | null = null;

  return (
    <div className="max-h-64 w-80 overflow-y-auto overflow-x-hidden rounded-md border border-border bg-bg-2 py-1 shadow-lg">
      {items.map((item, index) => {
        const showHeading = item.type !== lastType;
        lastType = item.type;

        return (
          <div key={`${item.type}-${item.id}`}>
            {showHeading ? (
              <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-widest text-text-muted">
                {groupLabel(item.type)}
              </p>
            ) : null}
            <button
              type="button"
              className={cn(
                "flex w-full min-w-0 items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors",
                index === selectedIndex ? "bg-bg-4 text-text-primary" : "text-text-secondary hover:bg-bg-3"
              )}
              onMouseDown={(event) => {
                event.preventDefault();
                command(item);
              }}
            >
              <MentionIcon type={item.type} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{item.label}</span>
                {item.subtitle ? <span className="block truncate text-[11px] text-text-muted">{item.subtitle}</span> : null}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
});
