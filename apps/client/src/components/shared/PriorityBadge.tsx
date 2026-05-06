import { Priority } from "shared";
import { Badge } from "../ui/badge";

const labels: Record<Priority, string> = {
  [Priority.LOW]: "Baixa",
  [Priority.MEDIUM]: "Media",
  [Priority.HIGH]: "Alta",
  [Priority.URGENT]: "Urgente"
};

const tones: Record<Priority, "green" | "yellow" | "orange" | "red"> = {
  [Priority.LOW]: "green",
  [Priority.MEDIUM]: "yellow",
  [Priority.HIGH]: "orange",
  [Priority.URGENT]: "red"
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge tone={tones[priority]}>{labels[priority]}</Badge>;
}
