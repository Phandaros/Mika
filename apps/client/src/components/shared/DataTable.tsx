import { forwardRef, type HTMLAttributes, ReactNode, ThHTMLAttributes } from "react";
import { ArrowDown, ArrowDownUp, ArrowUp } from "lucide-react";
import { cn, formatDateOnly } from "../../lib/utils";

type Align = "left" | "center" | "right";
type SortDirection = "asc" | "desc";

interface DataTableProps extends HTMLAttributes<HTMLTableElement> {
  minWidth?: string;
}

interface DataTableHeaderProps extends ThHTMLAttributes<HTMLTableCellElement> {
  align?: Align;
}

interface SortableDataTableHeaderProps extends DataTableHeaderProps {
  active: boolean;
  direction: SortDirection;
  onSort: () => void;
  children: ReactNode;
}

interface DataTableCellProps extends HTMLAttributes<HTMLTableCellElement> {
  align?: Align;
}

export const DataTableContainer = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function DataTableContainer(
  { className, children, ...props },
  ref
) {
  return (
    <div ref={ref} className={cn("w-full overflow-x-auto rounded-md border border-[--color-border]", className)} {...props}>
      {children}
    </div>
  );
});

export function DataTable({ minWidth = "1100px", className, style, children, ...props }: DataTableProps) {
  return (
    <table
      className={cn("w-full table-fixed border-collapse bg-[--bg-2] text-sm", className)}
      style={{ minWidth, ...style }}
      {...props}
    >
      {children}
    </table>
  );
}

export function DataTableHead({ className, children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={cn("sticky top-0 z-10 bg-[--bg-1]", className)} {...props}>
      {children}
    </thead>
  );
}

export function DataTableHeader({ align = "left", className, children, ...props }: DataTableHeaderProps) {
  return (
    <th
      className={cn(
        "px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-[--color-text-muted]",
        alignClass(align),
        className
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function SortableDataTableHeader({
  active,
  direction,
  onSort,
  align = "left",
  className,
  children,
  ...props
}: SortableDataTableHeaderProps) {
  return (
    <DataTableHeader
      align={align}
      className={cn(active ? "text-[--color-text-primary]" : "", className)}
      {...props}
    >
      <button
        type="button"
        className={cn(
          "group inline-flex max-w-full items-center gap-1.5 hover:text-[--color-text-primary]",
          align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start"
        )}
        onClick={onSort}
      >
        <span className="truncate">{children}</span>
        {active ? <SortIcon direction={direction} /> : <ArrowDownUp size={12} className="opacity-0 transition-opacity group-hover:opacity-100" />}
      </button>
    </DataTableHeader>
  );
}

export function DataTableRow({ className, children, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cn("border-b border-[--color-border-subtle] transition-colors hover:bg-[--bg-3]", className)} {...props}>
      {children}
    </tr>
  );
}

export function DataTableGroupRow({ colSpan, label, count }: { colSpan: number; label: string; count: number }) {
  return (
    <tr className="border-b border-[--color-border-subtle] bg-[--bg-1]">
      <td colSpan={colSpan} className="px-3 py-2 text-[12px] font-semibold uppercase tracking-widest text-[--color-text-muted]">
        <span>{label}</span>
        <span className="ml-2 rounded bg-[--bg-4] px-1.5 py-0.5 text-[11px] font-medium normal-case tracking-normal text-[--color-text-secondary]">
          {count}
        </span>
      </td>
    </tr>
  );
}

export function DataTableCell({ align = "left", className, children, ...props }: DataTableCellProps) {
  return (
    <td className={cn("px-3 py-2 text-[13px] text-[--color-text-primary]", alignClass(align), className)} {...props}>
      {children}
    </td>
  );
}

export function EmptyCell() {
  return <span className="text-[--color-text-muted]">—</span>;
}

export function TruncatedCellValue({ value, title }: { value: string | null | undefined; title?: string }) {
  return value ? (
    <span className="block truncate" title={title ?? value}>
      {value}
    </span>
  ) : (
    <EmptyCell />
  );
}

export function DateCell({ value }: { value: string | null | undefined }) {
  return value ? <span>{formatDateOnly(value, "dd/MM/yyyy")}</span> : <EmptyCell />;
}

export function NumberCell({ value }: { value: number | null | undefined }) {
  if (value == null) {
    return <EmptyCell />;
  }

  return <span>{Number.isInteger(value) ? value : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}</span>;
}

function SortIcon({ direction }: { direction: SortDirection }) {
  return direction === "asc" ? <ArrowUp size={12} className="text-brand-orange" /> : <ArrowDown size={12} className="text-brand-orange" />;
}

function alignClass(align: Align): string {
  if (align === "center") {
    return "text-center";
  }

  if (align === "right") {
    return "text-right";
  }

  return "text-left";
}
