import { format } from "date-fns";
import { CalendarDays } from "lucide-react";
import { dateOnlyToLocalDate, localDateToDateOnly } from "../../lib/utils";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

interface DatePickerProps {
  value: string | null | undefined;
  onChange?: (value: string | null) => void;
  onValueChange?: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
}

export function DatePicker({
  value,
  onChange,
  onValueChange,
  placeholder = "Selecionar data",
  disabled,
  className,
  triggerClassName
}: DatePickerProps) {
  const selectedDate = dateOnlyToLocalDate(value);
  const changeValue = (nextValue: string | null) => {
    onChange?.(nextValue);
    onValueChange?.(nextValue);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary" className={className ?? triggerClassName ?? "h-10 w-full justify-between px-3"} disabled={disabled}>
          <span className={selectedDate ? "text-text-primary" : "text-text-muted"}>
            {selectedDate ? format(selectedDate, "dd/MM/yyyy") : placeholder}
          </span>
          <CalendarDays size={16} className="text-text-muted" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar selected={selectedDate ?? undefined} onSelect={(date) => changeValue(localDateToDateOnly(date))} />
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

interface DateRangePickerProps {
  startDate: string | null | undefined;
  endDate: string | null | undefined;
  onStartDateChange: (value: string | null) => void;
  onEndDateChange: (value: string | null) => void;
}

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange
}: DateRangePickerProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <DatePicker value={startDate} onChange={onStartDateChange} placeholder="Início" />
      <DatePicker value={endDate} onChange={onEndDateChange} placeholder="Entrega" />
    </div>
  );
}
