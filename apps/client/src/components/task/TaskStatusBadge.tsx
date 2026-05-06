import { TaskStatus } from "shared";
import { Badge } from "../ui/badge";

const labels: Record<TaskStatus, string> = {
  [TaskStatus.BACKLOG]: "Backlog",
  [TaskStatus.TODO]: "A fazer",
  [TaskStatus.IN_PROGRESS]: "Em andamento",
  [TaskStatus.IN_REVIEW]: "Em revisao",
  [TaskStatus.DONE]: "Concluido"
};

const tones: Record<TaskStatus, "muted" | "blue" | "orange" | "purple" | "green"> = {
  [TaskStatus.BACKLOG]: "muted",
  [TaskStatus.TODO]: "blue",
  [TaskStatus.IN_PROGRESS]: "orange",
  [TaskStatus.IN_REVIEW]: "purple",
  [TaskStatus.DONE]: "green"
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge tone={tones[status]}>{labels[status]}</Badge>;
}
