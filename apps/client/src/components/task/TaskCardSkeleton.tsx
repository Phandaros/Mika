import { Skeleton } from "../ui/skeleton";

export function TaskCardSkeleton() {
  return (
    <div className="rounded-md border border-border bg-surface-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="grid flex-1 gap-2">
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <Skeleton className="h-7 w-7 rounded-full" />
      </div>
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-20" />
      </div>
      <Skeleton className="mt-4 h-3 w-24" />
    </div>
  );
}
