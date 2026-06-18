import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import type { ComponentProps, HTMLAttributes } from "react";
import { cn } from "../../lib/utils";
import { Button } from "./button";

export function Pagination({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <nav
      role="navigation"
      aria-label="Paginação"
      className={cn("flex w-full items-center justify-center", className)}
      {...props}
    />
  );
}

export function PaginationContent({ className, ...props }: HTMLAttributes<HTMLUListElement>) {
  return <ul className={cn("flex items-center gap-1", className)} {...props} />;
}

export function PaginationItem(props: HTMLAttributes<HTMLLIElement>) {
  return <li {...props} />;
}

export function PaginationPrevious(props: ComponentProps<typeof Button>) {
  return (
    <Button variant="ghost" className={cn("h-8 px-2", props.className)} aria-label="Página anterior" {...props}>
      <ChevronLeft aria-hidden="true" />
      <span className="hidden sm:inline">Anterior</span>
    </Button>
  );
}

export function PaginationNext(props: ComponentProps<typeof Button>) {
  return (
    <Button variant="ghost" className={cn("h-8 px-2", props.className)} aria-label="Próxima página" {...props}>
      <span className="hidden sm:inline">Próxima</span>
      <ChevronRight aria-hidden="true" />
    </Button>
  );
}

export function PaginationEllipsis({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn("flex size-8 items-center justify-center text-text-muted", className)} aria-hidden="true" {...props}>
      <MoreHorizontal />
    </span>
  );
}
