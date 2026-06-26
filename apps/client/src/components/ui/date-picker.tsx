import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  startOfWeek
} from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { CalendarDays } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn, dateOnlyToLocalDate, localDateToDateOnly } from "../../lib/utils";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { ScrollArea } from "./scroll-area";

interface DatePickerProps {
  value: string | null | undefined;
  onChange?: (value: string | null) => void;
  onValueChange?: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSelectComplete?: () => void;
}

export function DatePicker({
  value,
  onChange,
  onValueChange,
  placeholder = "Selecionar data",
  disabled,
  className,
  triggerClassName,
  open,
  onOpenChange,
  onSelectComplete
}: DatePickerProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const selectedDate = dateOnlyToLocalDate(value);
  const isControlled = open !== undefined;
  const popoverOpen = isControlled ? open : internalOpen;
  const setPopoverOpen = (nextOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };
  const changeValue = (nextValue: string | null) => {
    onChange?.(nextValue);
    onValueChange?.(nextValue);
    setPopoverOpen(false);
    if (nextValue) {
      onSelectComplete?.();
    }
  };

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" className={className ?? triggerClassName ?? "h-10 w-full justify-between px-3"} disabled={disabled}>
          <span className={selectedDate ? "text-text-primary" : "text-text-muted"}>
            {selectedDate ? format(selectedDate, "dd/MM/yyyy") : placeholder}
          </span>
          <CalendarDays size={16} className="text-text-muted" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" collisionPadding={16} className="w-[min(360px,calc(100vw-32px))] overflow-hidden p-0">
        <SingleDateCalendarPanel
          selectedDate={selectedDate}
          onSelect={(date) => changeValue(localDateToDateOnly(date))}
        />
        {selectedDate ? (
          <div className="border-t border-border p-2">
            <Button variant="ghost" className="h-8 w-full" onClick={() => changeValue(null)}>
              Limpar
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function SingleDateCalendarPanel({
  selectedDate,
  onSelect
}: {
  selectedDate: Date | null;
  onSelect: (date: Date) => void;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface-card shadow-2xl">
      <ScrollableCalendarMonths anchorDate={selectedDate ?? new Date()}>
        {(month, today) => (
          <MonthGrid
            month={month}
            today={today}
            startDate={selectedDate}
            endDate={null}
            onDaySelect={onSelect}
          />
        )}
      </ScrollableCalendarMonths>
    </div>
  );
}

type DateRangeValue = {
  startDate: string | null;
  endDate: string | null;
};

interface DateRangePickerProps {
  startDate: string | null | undefined;
  endDate: string | null | undefined;
  onStartDateChange: (value: string | null) => void;
  onEndDateChange: (value: string | null) => void;
  onSave?: (value: DateRangeValue) => void | Promise<void>;
  onClear?: () => void | Promise<void>;
  disabled?: boolean;
  triggerClassName?: string;
  contentClassName?: string;
  placeholder?: string;
  clearLabel?: string;
  saveLabel?: string;
}

const weekDays = ["D", "S", "T", "Q", "Q", "S", "S"];

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onSave,
  onClear,
  disabled,
  triggerClassName,
  contentClassName,
  placeholder = "Sem data",
  clearLabel = "Apagar",
  saveLabel = "Salvar"
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [draftStart, setDraftStart] = useState<Date | null>(null);
  const [draftEnd, setDraftEnd] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);

  const displayedStartDate = open ? localDateToDateOnly(draftStart) : startDate ?? null;
  const displayedEndDate = open ? localDateToDateOnly(draftEnd) : endDate ?? null;

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setDraftStart(dateOnlyToLocalDate(startDate));
      setDraftEnd(dateOnlyToLocalDate(endDate));
      setOpen(true);
      return;
    }

    if (!saving) {
      setOpen(false);
    }
  }

  async function handleSave() {
    const normalized = normalizeDateDraft(draftStart, draftEnd);
    const nextValue = {
      startDate: localDateToDateOnly(normalized.startDate),
      endDate: localDateToDateOnly(normalized.endDate)
    };

    setSaving(true);
    try {
      onStartDateChange(nextValue.startDate);
      onEndDateChange(nextValue.endDate);
      await onSave?.(nextValue);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    setDraftStart(null);
    setDraftEnd(null);
    setSaving(true);
    try {
      onStartDateChange(null);
      onEndDateChange(null);
      await onClear?.();
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "min-h-10 w-full min-w-0 rounded-md px-2 text-left text-text-primary transition hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange disabled:cursor-not-allowed disabled:opacity-50",
            triggerClassName
          )}
        >
          <DateRangeLabel startDate={displayedStartDate} endDate={displayedEndDate} placeholder={placeholder} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" collisionPadding={16} className={cn("w-[min(360px,calc(100vw-32px))] overflow-hidden p-0", contentClassName)}>
        <DateRangeCalendarPanel
          startDate={draftStart}
          endDate={draftEnd}
          onStartDateChange={setDraftStart}
          onEndDateChange={setDraftEnd}
          onSave={() => void handleSave()}
          onClear={() => void handleClear()}
          clearLabel={clearLabel}
          saveLabel={saveLabel}
          saving={saving}
        />
      </PopoverContent>
    </Popover>
  );
}

function DateRangeCalendarPanel({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onSave,
  onClear,
  clearLabel,
  saveLabel,
  saving
}: {
  startDate: Date | null;
  endDate: Date | null;
  onStartDateChange: (date: Date | null) => void;
  onEndDateChange: (date: Date | null) => void;
  onSave: () => void;
  onClear: () => void;
  clearLabel: string;
  saveLabel: string;
  saving: boolean;
}) {
  const anchorDate = startDate ?? endDate ?? new Date();

  function handleDaySelect(day: Date) {
    if (!startDate || (startDate && endDate)) {
      onStartDateChange(day);
      onEndDateChange(null);
      return;
    }

    if (isBefore(day, startDate)) {
      onStartDateChange(day);
      onEndDateChange(startDate);
      return;
    }

    onEndDateChange(day);
  }

  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface-card shadow-2xl">
      <div className="grid gap-3 border-b border-border p-3">
        <div className="grid grid-cols-2 gap-2">
          <DateSummaryChip label="Inicio" date={startDate} active={Boolean(startDate && !endDate)} />
          <DateSummaryChip label="Entrega" date={endDate} active={Boolean(endDate)} />
        </div>
      </div>
      <ScrollableCalendarMonths anchorDate={anchorDate}>
        {(month, todayDate) => (
          <MonthGrid month={month} today={todayDate} startDate={startDate} endDate={endDate} onDaySelect={handleDaySelect} />
        )}
      </ScrollableCalendarMonths>
      <div className="flex items-center justify-between border-t border-border p-3">
        <Button variant="ghost" onClick={onClear} disabled={saving}>
          {clearLabel}
        </Button>
        <Button onClick={onSave} disabled={saving}>
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}

function ScrollableCalendarMonths({
  anchorDate,
  children
}: {
  anchorDate: Date;
  children: (month: Date, today: Date) => ReactNode;
}) {
  const today = startOfDay(new Date());
  const anchorMonthKey = monthKey(anchorDate);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const monthRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const months = useMemo(() => {
    const start = startOfMonth(addMonths(anchorDate, -12));
    return Array.from({ length: 49 }, (_, index) => addMonths(start, index));
  }, [anchorDate]);

  useEffect(() => {
    window.requestAnimationFrame(() => {
      const viewport = scrollAreaRef.current?.querySelector<HTMLElement>("[data-radix-scroll-area-viewport]");
      const targetMonth = monthRefs.current[anchorMonthKey];

      if (viewport && targetMonth) {
        viewport.scrollTop = targetMonth.offsetTop;
      }
    });
  }, [anchorMonthKey]);

  return (
    <ScrollArea ref={scrollAreaRef} className="h-[min(320px,calc(100vh-260px))] min-h-[220px] overflow-x-hidden">
      <div className="grid gap-4 p-3">
        {months.map((month) => {
          const key = monthKey(month);

          return (
            <div
              key={key}
              ref={(element) => {
                monthRefs.current[key] = element;
              }}
              className="grid gap-2"
            >
              <div className="sticky top-0 z-10 bg-surface-card/95 py-1 backdrop-blur">
                <span className="text-sm font-semibold text-text-primary">{formatMonthLabel(month)}</span>
              </div>
              {children(month, today)}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

function MonthGrid({
  month,
  today,
  startDate,
  endDate,
  onDaySelect
}: {
  month: Date;
  today: Date;
  startDate: Date | null;
  endDate: Date | null;
  onDaySelect: (date: Date) => void;
}) {
  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(month)),
        end: endOfWeek(endOfMonth(month))
      }),
    [month]
  );

  return (
    <div className="overflow-hidden rounded-md border border-border bg-border">
      <div className="grid grid-cols-7 gap-px bg-border text-center text-xs font-semibold text-text-muted">
        {weekDays.map((day, index) => (
          <span key={`${day}-${index}`} className="bg-surface-card py-1.5">
            {day}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-border">
        {days.map((day) => {
          const s0 = startDate ? startOfDay(startDate) : null;
          const e0 = endDate ? startOfDay(endDate) : null;
          const d0 = startOfDay(day);
          const rangeOk = Boolean(s0 && e0 && !isAfter(s0, e0));
          const inClosedRange = rangeOk && s0 && e0 ? isWithinInterval(d0, { start: s0, end: e0 }) : false;
          const isStart = Boolean(startDate && isSameDay(day, startDate));
          const isEnd = Boolean(endDate && isSameDay(day, endDate));
          const isMiddle = inClosedRange && !isStart && !isEnd;
          const isToday = isSameDay(day, today);

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onDaySelect(day)}
              aria-current={isToday ? "date" : undefined}
              className={cn(
                "relative flex h-8 items-center justify-center text-sm font-semibold transition outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-brand-orange",
                isSameMonth(day, month) ? "text-text-primary" : "text-text-muted",
                isMiddle && "bg-brand-orange/25 text-text-primary hover:bg-brand-orange/35",
                (isStart || isEnd) && "z-[1] bg-brand-orange text-brand-white hover:bg-brand-orange",
                !isMiddle && !isStart && !isEnd && "bg-surface-card hover:bg-surface-hover",
                isToday && !isStart && !isEnd && "text-brand-orange ring-1 ring-inset ring-brand-orange/70",
                isToday && !isMiddle && !isStart && !isEnd && "bg-brand-orange/10"
              )}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DateSummaryChip({ label, date, active }: { label: string; date: Date | null; active: boolean }) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-md border border-border bg-bg-2 px-3 py-2",
        active && "border-brand-orange bg-brand-orange/10"
      )}
    >
      <span className="block text-[11px] font-semibold uppercase text-text-muted">{label}</span>
      <span className={cn("mt-0.5 block truncate text-sm font-semibold", date ? "text-text-primary" : "text-text-muted")}>
        {date ? format(date, "dd/MM/yyyy") : "--"}
      </span>
    </div>
  );
}

function DateRangeLabel({
  startDate,
  endDate,
  placeholder
}: {
  startDate: string | null | undefined;
  endDate: string | null | undefined;
  placeholder: ReactNode;
}) {
  if (startDate && endDate) {
    return (
      <span>
        {formatDisplayDate(startDate)} - {formatDisplayDate(endDate)}
      </span>
    );
  }

  if (startDate) {
    return <span>Inicio {formatDisplayDate(startDate)}</span>;
  }

  if (endDate) {
    return <span>Entrega {formatDisplayDate(endDate)}</span>;
  }

  return <span className="text-text-secondary">{placeholder}</span>;
}

function normalizeDateDraft(startDate: Date | null, endDate: Date | null): { startDate: Date | null; endDate: Date | null } {
  if (startDate && endDate) {
    return isBefore(endDate, startDate)
      ? { startDate: endDate, endDate: startDate }
      : { startDate, endDate };
  }

  return { startDate: null, endDate: startDate ?? endDate };
}

function formatDisplayDate(value: string): string {
  const date = dateOnlyToLocalDate(value);
  return date ? format(date, "dd/MM/yyyy") : "";
}

function formatMonthLabel(date: Date): string {
  const label = format(date, "MMMM 'de' yyyy", { locale: ptBR });
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

function monthKey(date: Date): string {
  return format(startOfMonth(date), "yyyy-MM");
}
