import { useEffect, useState } from "react";
import { TaskStatus, type Task, type User } from "shared";
import { cn } from "../../lib/utils";
import { Avatar } from "../shared/Avatar";
import {
  CompletionStatusChip,
  DisciplineChip,
  editableTaskStatusOptions,
  PlatformChip,
  taskStatusLabels
} from "../shared/Chip";
import { enumColor } from "../shared/statusVisuals";
import { TaskStatusBadge } from "./TaskStatusBadge";
import { DatePicker } from "../ui/date-picker";
import { DecimalInput, parseDecimalInput } from "../ui/decimal-input";
import { Input } from "../ui/input";
import { SearchableSelect } from "../ui/searchable-select";
import {
  compactDatePickerClassName,
  compactInputClassName,
  compactSelectTriggerClassName,
  EmptyField,
  formatDecimal
} from "./TaskPanelPrimitives";

export type TaskInlineFieldVariant = "detail" | "table";
type TaskCustomField = NonNullable<Task["customFieldValues"]>[number];

const platformOptions = [
  { value: "CAD", label: "CAD" },
  { value: "REVIT", label: "REVIT" },
  { value: "COORD", label: "COORD" }
];

const disciplineOptions = [
  { value: "ELE", label: "ELE" },
  { value: "SPDA", label: "SPDA" },
  { value: "TEL", label: "TEL" },
  { value: "HID", label: "HID" },
  { value: "PPCI", label: "PPCI" },
  { value: "HVAC", label: "HVAC" },
  { value: "COORD", label: "COORD" },
  { value: "EP", label: "EP" }
];

function selectTriggerClass(variant: TaskInlineFieldVariant): string {
  if (variant === "table") {
    return "h-7 min-h-0 w-full min-w-0 max-w-[150px] justify-start border-transparent bg-transparent px-1.5 text-left hover:bg-[--bg-3]";
  }

  return compactSelectTriggerClassName;
}

function datePickerClass(variant: TaskInlineFieldVariant): string {
  if (variant === "table") {
    return "h-7 min-h-0 w-full min-w-0 max-w-[120px] justify-between border-transparent bg-transparent px-1.5 text-[13px] hover:bg-[--bg-3]";
  }

  return compactDatePickerClassName;
}

function decimalInputClass(variant: TaskInlineFieldVariant): string {
  if (variant === "table") {
    return "h-7 min-h-0 w-full min-w-0 max-w-[90px] border-transparent bg-transparent px-1.5 text-right font-mono text-[12px] hover:bg-[--bg-3] focus:bg-[--bg-3]";
  }

  return cn(compactInputClassName, "font-mono text-[12px]");
}

function stageInputClass(variant: TaskInlineFieldVariant): string {
  if (variant === "table") {
    return "h-7 min-h-0 w-full min-w-0 max-w-[120px] border-transparent bg-transparent px-1.5 text-[13px] hover:bg-[--bg-3] focus:bg-[--bg-3]";
  }

  return cn(compactInputClassName, "w-[220px]");
}

function popoverContentClass(variant: TaskInlineFieldVariant): string {
  return variant === "table" ? "min-w-[180px] max-w-[280px]" : "min-w-[220px] max-w-[320px]";
}

export function EditableStatusField({
  task,
  onSave,
  variant = "detail"
}: {
  task: Task;
  onSave: (value: TaskStatus) => void;
  variant?: TaskInlineFieldVariant;
}) {
  return (
    <SearchableSelect
      value={task.status}
      options={editableTaskStatusOptions(task).map((status) => ({
        value: status,
        label: taskStatusLabels[status],
        render: <TaskStatusBadge status={status} />
      }))}
      searchPlaceholder="Buscar status..."
      triggerClassName={selectTriggerClass(variant)}
      contentClassName={popoverContentClass(variant)}
      showSelectionIndicator={false}
      onValueChange={(nextValue) => onSave(nextValue as TaskStatus)}
    />
  );
}

export function EditableAssigneeField({
  users,
  assigneeId,
  onSave,
  variant = "detail"
}: {
  users: User[];
  assigneeId: string | null;
  onSave: (value: string | null) => void;
  variant?: TaskInlineFieldVariant;
}) {
  const avatarClassName = variant === "table" ? "h-5 w-5 shrink-0" : "h-7 w-7 shrink-0";

  return (
    <SearchableSelect
      value={assigneeId ?? "none"}
      options={[
        { value: "none", label: "Sem responsável", render: <span className="text-text-muted">Sem responsável</span> },
        ...users.map((item) => ({
          value: item.id,
          label: item.name,
          avatarUrl: item.avatarUrl
        }))
      ]}
      placeholder="Sem responsável"
      searchPlaceholder="Buscar responsável..."
      triggerClassName={variant === "table" ? selectTriggerClass("table") : compactSelectTriggerClassName}
      contentClassName={popoverContentClass(variant)}
      renderValue={(option) =>
        option.value === "none" ? (
          <span className="text-text-secondary">Sem responsável</span>
        ) : (
          <span className="flex min-w-0 items-center gap-1.5">
            <Avatar name={option.label} imageUrl={option.avatarUrl} className={avatarClassName} />
            <span className="min-w-0 truncate font-medium text-text-primary">{option.label}</span>
          </span>
        )
      }
      onValueChange={(nextValue) => onSave(nextValue === "none" ? null : nextValue)}
    />
  );
}

export function EditablePlatformField({
  value,
  onSave,
  variant = "detail"
}: {
  value: string | null | undefined;
  onSave: (value: string | null) => void;
  variant?: TaskInlineFieldVariant;
}) {
  return (
    <SearchableSelect
      value={value ?? "none"}
      options={[
        { value: "none", label: "Sem plataforma", render: <EmptyField /> },
        ...platformOptions.map((option) => ({
          ...option,
          render: <PlatformChip platform={option.value} />
        }))
      ]}
      searchPlaceholder="Buscar plataforma..."
      triggerClassName={selectTriggerClass(variant)}
      contentClassName={popoverContentClass(variant)}
      onValueChange={(nextValue) => onSave(nextValue === "none" ? null : nextValue)}
    />
  );
}

export function EditableDisciplineField({
  value,
  onSave,
  variant = "detail"
}: {
  value: string | null | undefined;
  onSave: (value: string | null) => void;
  variant?: TaskInlineFieldVariant;
}) {
  return (
    <SearchableSelect
      value={value ?? "none"}
      options={[
        { value: "none", label: "Sem disciplina", render: <EmptyField /> },
        ...disciplineOptions.map((option) => ({
          ...option,
          render: <DisciplineChip discipline={option.value} />
        }))
      ]}
      searchPlaceholder="Buscar disciplina..."
      triggerClassName={selectTriggerClass(variant)}
      contentClassName={popoverContentClass(variant)}
      onValueChange={(nextValue) => onSave(nextValue === "none" ? null : nextValue)}
    />
  );
}

export function EditableDecimalField({
  value,
  onSave,
  variant = "detail"
}: {
  value: number | null | undefined;
  onSave: (value: number | null) => void;
  variant?: TaskInlineFieldVariant;
}) {
  const initialValue = value == null ? "" : formatDecimal(value);
  const [draft, setDraft] = useState(initialValue);

  useEffect(() => {
    setDraft(initialValue);
  }, [initialValue]);

  return (
    <DecimalInput
      value={draft}
      onValueChange={setDraft}
      onBlur={() => {
        const parsed = parseDecimalInput(draft);
        const nextValue = parsed === null || Number.isNaN(parsed) ? null : parsed;
        if (nextValue !== (value ?? null)) {
          onSave(nextValue);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
      className={decimalInputClass(variant)}
      placeholder="—"
    />
  );
}

export function EditableMaxDeadlineField({
  value,
  onSave,
  variant = "detail"
}: {
  value: string | null | undefined;
  onSave: (value: string | null) => void;
  variant?: TaskInlineFieldVariant;
}) {
  return (
    <DatePicker
      value={value ?? null}
      onValueChange={(maxDeadline) => onSave(maxDeadline)}
      placeholder="—"
      className={datePickerClass(variant)}
    />
  );
}

export function EditableStageField({
  value,
  stageField,
  onSave,
  variant = "detail"
}: {
  value: string | null | undefined;
  stageField: TaskCustomField | null;
  onSave: (value: string | null) => void;
  variant?: TaskInlineFieldVariant;
}) {
  const enumOptions = stageField?.enumOptions?.filter((option) => option.name) ?? [];
  const [draft, setDraft] = useState(value ?? "");

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  if (enumOptions.length > 0) {
    return (
      <SearchableSelect
        value={value ?? "none"}
        options={[
          { value: "none", label: "Sem etapa", render: <EmptyField /> },
          ...enumOptions.map((option) => ({
            value: option.name,
            label: option.name,
            color: enumColor(option.name, option.color)
          }))
        ]}
        searchPlaceholder="Buscar etapa..."
        triggerClassName={selectTriggerClass(variant)}
        contentClassName={popoverContentClass(variant)}
        onValueChange={(nextValue) => onSave(nextValue === "none" ? null : nextValue)}
      />
    );
  }

  return (
    <Input
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        const nextValue = draft.trim() || null;
        if (nextValue !== (value ?? null)) {
          onSave(nextValue);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
      className={stageInputClass(variant)}
      placeholder="—"
    />
  );
}

export function EditableCompletionField({
  completed,
  onSave,
  variant = "detail"
}: {
  completed: boolean;
  onSave: (completed: boolean) => void;
  variant?: TaskInlineFieldVariant;
}) {
  return (
    <SearchableSelect
      value={completed ? "completed" : "open"}
      options={[
        { value: "open", label: "Aberta", render: <CompletionStatusChip completed={false} /> },
        { value: "completed", label: "Concluída", render: <CompletionStatusChip completed={true} /> }
      ]}
      searchPlaceholder="Buscar conclusão..."
      triggerClassName={selectTriggerClass(variant)}
      contentClassName={popoverContentClass(variant)}
      showSelectionIndicator={false}
      renderValue={(option) => <CompletionStatusChip completed={option.value === "completed"} />}
      onValueChange={(nextValue) => onSave(nextValue === "completed")}
    />
  );
}
