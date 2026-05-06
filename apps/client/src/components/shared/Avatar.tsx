import { cn } from "../../lib/utils";

interface AvatarProps {
  name: string;
  imageUrl?: string | null;
  className?: string;
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function Avatar({ name, imageUrl, className }: AvatarProps) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={cn("h-9 w-9 rounded-full border border-border object-cover", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-hover text-xs font-bold text-text-primary",
        className
      )}
      title={name}
    >
      {initials(name)}
    </div>
  );
}
