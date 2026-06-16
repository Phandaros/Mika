import { useEffect, useMemo, useRef, useState } from "react";
import { ProjectStatus, type ProjectCustomFieldValue } from "shared";
import { formatProjectAreaValue, projectStatusLabels } from "../../lib/projectLabels";
import { fieldMultiValues } from "../../lib/portfolioFields";
import { portfolioEnumColor, portfolioFieldLabel } from "../../lib/portfolioEnumColor";
import { cn } from "../../lib/utils";
import { ProjectPlatformChip, ProjectStatusChip } from "../shared/Chip";
import { StatusOptionPill } from "../shared/statusVisuals";
import { DatePicker } from "../ui/date-picker";
import { DecimalInput, parseDecimalInput } from "../ui/decimal-input";
import { SearchableMultiSelect } from "../ui/searchable-multi-select";
import { SearchableSelect } from "../ui/searchable-select";
import { EmptyField } from "../task/TaskPanelPrimitives";
import { ProjectMultiEnumChips, ProjectEnumChip } from "./ProjectPortfolioChips";
import { BuilderCombobox } from "./BuilderCombobox";

export type ProjectInlineFieldVariant = "detail" | "table";

const projectPlatformOptions = [
  { value: "CAD", label: "CAD" },
  { value: "BIM", label: "BIM" }
] as const;

function selectTriggerClass(variant: ProjectInlineFieldVariant): string {
  if (variant === "table") {
    return "h-7 min-h-0 w-full min-w-0 max-w-[150px] justify-start border-transparent bg-transparent px-1.5 text-left hover:bg-[--bg-3]";
  }

  return "h-7 min-h-0 w-auto min-w-[84px] justify-start border-transparent bg-transparent px-1.5 text-left hover:bg-[--bg-3]";
}

function datePickerClass(variant: ProjectInlineFieldVariant): string {
  if (variant === "table") {
    return "h-7 min-h-0 w-full min-w-0 max-w-[120px] justify-between border-transparent bg-transparent px-1.5 text-[13px] hover:bg-[--bg-3]";
  }

  return "h-7 min-h-0 w-auto min-w-[112px] justify-between border-transparent bg-transparent px-1.5 text-[13px] hover:bg-[--bg-3]";
}

function areaInputClass(variant: ProjectInlineFieldVariant): string {
  if (variant === "table") {
    return "h-7 min-h-0 w-full min-w-0 max-w-[110px] border-transparent bg-transparent px-1.5 text-right font-mono text-[12px] hover:bg-[--bg-3] focus:bg-[--bg-3]";
  }

  return "h-7 min-h-0 w-[112px] border-transparent bg-transparent px-1.5 text-right font-mono text-[12px] hover:bg-[--bg-3] focus:bg-[--bg-3]";
}

function popoverContentClass(variant: ProjectInlineFieldVariant): string {
  return variant === "table" ? "min-w-[180px] max-w-[280px]" : "min-w-[220px] max-w-[320px]";
}

export function EditableBuilderField({
  value,
  suggestions,
  onSave,
  variant = "table"
}: {
  value: string | null | undefined;
  suggestions: string[];
  onSave: (value: string | null) => void;
  variant?: ProjectInlineFieldVariant;
}) {
  return (
    <BuilderCombobox
      value={value ?? ""}
      suggestions={suggestions}
      variant={variant === "table" ? "table" : "form"}
      onChange={(nextValue) => {
        const normalized = nextValue.trim() || null;
        if (normalized !== (value?.trim() || null)) {
          onSave(normalized);
        }
      }}
    />
  );
}

export function EditableProjectPlatformField({
  value,
  onSave,
  variant = "table"
}: {
  value: string | null | undefined;
  onSave: (value: "CAD" | "BIM" | null) => void;
  variant?: ProjectInlineFieldVariant;
}) {
  return (
    <SearchableSelect
      value={value ?? "none"}
      options={[
        { value: "none", label: "Sem plataforma", render: <EmptyField /> },
        ...projectPlatformOptions.map((option) => ({
          value: option.value,
          label: option.label,
          render: <ProjectPlatformChip platform={option.value} />
        }))
      ]}
      searchPlaceholder="Buscar plataforma..."
      triggerClassName={selectTriggerClass(variant)}
      contentClassName={popoverContentClass(variant)}
      onValueChange={(nextValue) => onSave(nextValue === "none" ? null : (nextValue as "CAD" | "BIM"))}
    />
  );
}

export function EditableProjectStatusField({
  value,
  onSave,
  variant = "table"
}: {
  value: ProjectStatus;
  onSave: (value: ProjectStatus) => void;
  variant?: ProjectInlineFieldVariant;
}) {
  return (
    <SearchableSelect
      value={value}
      options={Object.values(ProjectStatus).map((status) => ({
        value: status,
        label: projectStatusLabels[status],
        render: <ProjectStatusChip status={status} />
      }))}
      searchPlaceholder="Buscar status..."
      triggerClassName={selectTriggerClass(variant)}
      contentClassName={popoverContentClass(variant)}
      showSelectionIndicator={false}
      onValueChange={(nextValue) => onSave(nextValue as ProjectStatus)}
    />
  );
}

export function EditableProjectAreaField({
  value,
  onSave,
  variant = "table"
}: {
  value: number | null | undefined;
  onSave: (value: number | null) => void;
  variant?: ProjectInlineFieldVariant;
}) {
  const initialValue = value == null ? "" : formatProjectAreaValue(value);
  const [draft, setDraft] = useState(initialValue);

  useEffect(() => {
    setDraft(initialValue);
  }, [initialValue]);

  return (
    <span className={cn("relative inline-flex w-full items-center", variant === "table" ? "justify-end" : "")}>
      <DecimalInput
        value={draft}
        onValueChange={setDraft}
        onBlur={() => {
          const parsed = parseDecimalInput(draft);
          const nextValue = parsed === null || Number.isNaN(parsed) ? null : Number(parsed.toFixed(2));
          setDraft(nextValue === null ? "" : formatProjectAreaValue(nextValue));
          if (nextValue !== (value ?? null)) {
            onSave(nextValue);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        className={cn(areaInputClass(variant), variant === "table" ? "pr-5" : "")}
        placeholder="—"
      />
      {variant === "table" ? (
        <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-[--color-text-muted]">
          m²
        </span>
      ) : null}
    </span>
  );
}

export function EditableProjectEndDateField({
  value,
  onSave,
  variant = "table"
}: {
  value: string | null | undefined;
  onSave: (value: string | null) => void;
  variant?: ProjectInlineFieldVariant;
}) {
  return (
    <DatePicker
      value={value ?? null}
      onValueChange={(endDate) => onSave(endDate)}
      placeholder="—"
      className={datePickerClass(variant)}
    />
  );
}

export function EditableProjectEnumField({
  field,
  onSave,
  variant = "table"
}: {
  field: ProjectCustomFieldValue | undefined;
  onSave: (value: string | null) => void;
  variant?: ProjectInlineFieldVariant;
}) {
  const fieldLabel = portfolioFieldLabel(field);
  const enumOptions = field?.enumOptions?.filter((option) => option.name) ?? [];
  const currentValue = field?.enumOptionName ?? field?.displayValue ?? null;

  if (!field || enumOptions.length === 0) {
    return <ProjectEnumChip field={field} />;
  }

  return (
    <SearchableSelect
      value={currentValue ?? "none"}
      options={[
        { value: "none", label: "—", render: <EmptyField /> },
        ...enumOptions.map((option) => ({
          value: option.name,
          label: option.name,
          render: (
            <StatusOptionPill
              label={option.name}
              color={portfolioEnumColor(fieldLabel, option.name, option.color)}
            />
          )
        }))
      ]}
      searchPlaceholder="Buscar..."
      triggerClassName={selectTriggerClass(variant)}
      contentClassName={popoverContentClass(variant)}
      showSelectionIndicator={false}
      renderValue={(option) =>
        option.value === "none" ? (
          <EmptyField />
        ) : (
          <StatusOptionPill
            label={option.label}
            color={portfolioEnumColor(fieldLabel, option.label, enumOptions.find((item) => item.name === option.label)?.color)}
          />
        )
      }
      onValueChange={(nextValue) => onSave(nextValue === "none" ? null : nextValue)}
    />
  );
}

export function EditableProjectMultiEnumField({
  field,
  onSave,
  variant = "table",
  compactLabels = false
}: {
  field: ProjectCustomFieldValue | undefined;
  onSave: (value: string[]) => void;
  variant?: ProjectInlineFieldVariant;
  compactLabels?: boolean;
}) {
  const fieldLabel = portfolioFieldLabel(field);
  const enumOptions = field?.enumOptions?.filter((option) => option.name) ?? [];
  const selectedValues = useMemo(() => fieldMultiValues(field).map((value) => value.name), [field]);
  const [draftValues, setDraftValues] = useState(selectedValues);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraftValues(selectedValues);
  }, [selectedValues]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  if (!field || enumOptions.length === 0) {
    return <ProjectMultiEnumChips field={field} compactLabels={compactLabels} />;
  }

  const options = enumOptions.map((option) => ({
    value: option.name,
    label: option.name,
    render: (
      <StatusOptionPill label={option.name} color={portfolioEnumColor(fieldLabel, option.name, option.color)} />
    )
  }));

  return (
    <SearchableMultiSelect
      values={draftValues}
      options={options}
      searchPlaceholder="Buscar..."
      placeholder="—"
      triggerClassName={cn(
        selectTriggerClass(variant),
        "h-auto min-h-7 max-w-full items-start py-1",
        variant === "table" ? "max-w-none" : ""
      )}
      contentClassName={popoverContentClass(variant)}
      noneSelectedLabel="Nenhum selecionado"
      partialSelectedLabel={(count) => `${count} selecionados`}
      showBulkActions
      renderTrigger={(values) =>
        values.length > 0 ? (
          <ProjectMultiEnumChips
            field={{
              ...field,
              multiEnumValues: values.map((name) => {
                const match = enumOptions.find((option) => option.name === name);
                return { gid: null, name, color: match?.color ?? null };
              })
            }}
            maxVisible={2}
            compactLabels={compactLabels}
          />
        ) : (
          <span className="text-[--color-text-muted]">—</span>
        )
      }
      onValuesChange={(nextValues) => {
        setDraftValues(nextValues);
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(() => {
          onSave(nextValues);
        }, 350);
      }}
    />
  );
}
