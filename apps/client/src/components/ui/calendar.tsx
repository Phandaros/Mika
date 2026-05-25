import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";
import { cn } from "../../lib/utils";
import { Button } from "./button";

interface CalendarProps {
  selected?: Date;
  onSelect: (date: Date) => void;
}

const weekDays = ["D", "S", "T", "Q", "Q", "S", "S"];

export function Calendar({ selected, onSelect }: CalendarProps) {
  const [month, setMonth] = useState(() => selected ?? new Date());
  const today = new Date();

  const days = useMemo(() => {
    const monthStart = startOfMonth(month);
    return eachDayOfInterval({
      start: startOfWeek(monthStart),
      end: endOfWeek(endOfMonth(monthStart))
    });
  }, [month]);

  return (
    <div className="w-72 rounded-md border border-border bg-surface-card p-3 shadow-2xl">
      <div className="mb-3 flex items-center justify-between">
        <Button variant="ghost" className="h-8 w-8 px-0" onClick={() => setMonth((current) => addMonths(current, -1))} title="Mês anterior">
          <ChevronLeft size={16} />
        </Button>
        <span className="text-sm font-semibold text-text-primary">{format(month, "MM/yyyy")}</span>
        <Button variant="ghost" className="h-8 w-8 px-0" onClick={() => setMonth((current) => addMonths(current, 1))} title="Próximo mês">
          <ChevronRight size={16} />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-text-muted">
        {weekDays.map((day, index) => (
          <span key={`${day}-${index}`} className="py-1 font-semibold">
            {day}
          </span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((day) => {
          const isSelected = selected ? isSameDay(day, selected) : false;
          const isToday = isSameDay(day, today);

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelect(day)}
              className={cn(
                "flex h-8 items-center justify-center rounded-md text-sm transition hover:bg-surface-hover",
                isSameMonth(day, month) ? "text-text-primary" : "text-text-muted",
                isToday ? "font-bold" : "",
                isSelected ? "bg-brand-orange text-brand-white hover:bg-brand-orange" : ""
              )}
              style={todayHatchStyle(isToday)}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function todayHatchStyle(isToday: boolean): CSSProperties | undefined {
  if (!isToday) {
    return undefined;
  }

  return {
    backgroundImage:
      "repeating-linear-gradient(135deg, rgba(255, 111, 0, 0.35) 0 2px, transparent 2px 6px)",
    boxShadow: "inset 0 0 0 1px rgba(255, 111, 0, 0.65)"
  };
}
