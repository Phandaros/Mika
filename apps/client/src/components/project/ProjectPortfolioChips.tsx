import type { ProjectCustomFieldValue } from "shared";
import { compactFinanceLabel, fieldMultiValues, formatPortfolioNumber } from "../../lib/portfolioFields";
import { portfolioEnumColor, portfolioFieldLabel } from "../../lib/portfolioEnumColor";
import { EmptyCell } from "../shared/DataTable";
import { StatusOptionPill } from "../shared/statusVisuals";

export function ProjectMultiEnumChips({
  field,
  maxVisible = 2,
  compactLabels = false
}: {
  field: ProjectCustomFieldValue | undefined;
  maxVisible?: number;
  compactLabels?: boolean;
}) {
  const values = fieldMultiValues(field);
  if (!values.length) {
    return <EmptyCell />;
  }

  const visibleValues = values.slice(0, maxVisible);
  const hiddenCount = values.length - visibleValues.length;
  const title = values.map((value) => value.name).join(", ");

  const fieldLabel = portfolioFieldLabel(field);

  return (
    <div className="flex min-w-0 max-w-full items-center gap-1 overflow-hidden" title={title}>
      {visibleValues.map((value) => (
        <StatusOptionPill
          key={`${field?.id ?? "field"}-${value.name}`}
          label={compactLabels ? compactFinanceLabel(value.name) : value.name}
          color={portfolioEnumColor(fieldLabel, value.name, value.color)}
        />
      ))}
      {hiddenCount > 0 ? (
        <span className="shrink-0 rounded bg-[--bg-4] px-1.5 py-0.5 text-[11px] font-medium text-[--color-text-secondary]">
          +{hiddenCount}
        </span>
      ) : null}
    </div>
  );
}

export function ProjectEnumChip({ field }: { field: ProjectCustomFieldValue | undefined }) {
  const value = field?.enumOptionName ?? field?.displayValue;
  if (!value) {
    return <EmptyCell />;
  }

  const fieldLabel = portfolioFieldLabel(field);

  return (
    <StatusOptionPill
      label={value}
      color={portfolioEnumColor(
        fieldLabel,
        value,
        field?.enumOptionColor ?? field?.enumOptions?.find((option) => option.name === value)?.color
      )}
    />
  );
}

export function ProjectPortfolioNumberValue({ field }: { field: ProjectCustomFieldValue | undefined }) {
  const value = field?.numberValue;
  if (value == null) {
    return <EmptyCell />;
  }

  return <span className="font-mono text-[12px] text-[--color-text-secondary]">{formatPortfolioNumber(value)}</span>;
}
