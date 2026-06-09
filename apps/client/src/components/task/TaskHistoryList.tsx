import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { CheckCircle2, Clock3, History, RotateCcw, UserRoundPen } from "lucide-react";
import { Priority, TaskStatus, type TaskActivity } from "shared";
import { cn } from "../../lib/utils";
import { EmptyState } from "../shared/EmptyState";
import { taskStatusLabels } from "../shared/Chip";

interface TaskHistoryListProps {
  activities: TaskActivity[];
  isLoading?: boolean;
}

const fieldLabels: Record<string, string> = {
  task: "Tarefa",
  title: "Título",
  description: "Descrição",
  status: "Status",
  priority: "Prioridade",
  assignee: "Responsável",
  startDate: "Início",
  dueDate: "Entrega",
  estimatedDays: "Dias Estimados",
  platform: "Plataforma",
  discipline: "Disciplina",
  estimatedTime: "Dias Estimados",
  maxDeadline: "Prazo Máximo",
  conclusionDays: "Dias Conclusão",
  stage: "Etapa",
  projectMemberships: "Projetos"
};

const priorityLabels: Record<Priority, string> = {
  [Priority.LOW]: "Baixa",
  [Priority.MEDIUM]: "Média",
  [Priority.HIGH]: "Alta",
  [Priority.URGENT]: "Urgente"
};

export function TaskHistoryList({ activities, isLoading }: TaskHistoryListProps) {
  const visibleActivities = activities.filter((activity) => activity.type !== "COMMENTED");

  if (isLoading) {
    return (
      <div className="grid gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-14 rounded-md bg-[--bg-3]" />
        ))}
      </div>
    );
  }

  if (visibleActivities.length === 0) {
    return (
      <EmptyState title="Nenhuma movimentação ainda" icon={<History size={40} />}>
        As próximas alterações feitas nesta tarefa aparecerão aqui.
      </EmptyState>
    );
  }

  return (
    <div className="grid gap-0">
      {visibleActivities.map((activity, index) => (
        <div key={activity.id} className="grid grid-cols-[28px_1fr] gap-3">
          <div className="relative flex justify-center">
            <span className="mt-1 flex h-7 w-7 items-center justify-center rounded-full border border-[--color-border] bg-[--bg-2] text-[--color-text-secondary]">
              <ActivityIcon activity={activity} />
            </span>
            {index < visibleActivities.length - 1 ? <span className="absolute top-9 h-[calc(100%-20px)] w-px bg-[--color-border-subtle]" /> : null}
          </div>
          <div className="min-w-0 border-b border-[--color-border-subtle] pb-4">
            <p className="text-[13px] leading-5 text-[--color-text-secondary]">
              <span className="font-semibold text-[--color-text-primary]">{activity.actor?.name ?? "Sistema"}</span>{" "}
              {activitySentence(activity)}
            </p>
            <time className="mt-1 block text-[12px] tabular-nums text-[--color-text-muted]">
              {format(new Date(activity.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </time>
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivityIcon({ activity }: { activity: TaskActivity }) {
  const className = "h-4 w-4";

  if (activity.type === "COMPLETED") {
    return <CheckCircle2 className={cn(className, "text-[--status-done-text]")} />;
  }

  if (activity.type === "REOPENED") {
    return <RotateCcw className={className} />;
  }

  if (activity.type === "CREATED") {
    return <Clock3 className={className} />;
  }

  return <UserRoundPen className={className} />;
}

function activitySentence(activity: TaskActivity): string {
  if (activity.type === "CREATED") {
    return `criou esta tarefa${activity.toValue ? `: ${activity.toValue}` : ""}`;
  }

  if (activity.type === "COMPLETED") {
    return "concluiu esta tarefa";
  }

  if (activity.type === "REOPENED") {
    return "reabriu esta tarefa";
  }

  const field = activity.field ? fieldLabels[activity.field] ?? activity.field : "Campo";
  return `alterou ${field} de ${formatActivityValue(activity.field, activity.fromValue)} para ${formatActivityValue(activity.field, activity.toValue)}`;
}

function formatActivityValue(field: string | null, value: string | null): string {
  if (!value) {
    return "—";
  }

  if (field === "status" && isTaskStatus(value)) {
    return taskStatusLabels[value];
  }

  if (field === "priority" && isPriority(value)) {
    return priorityLabels[value];
  }

  return value;
}

function isTaskStatus(value: string): value is TaskStatus {
  return Object.values(TaskStatus).includes(value as TaskStatus);
}

function isPriority(value: string): value is Priority {
  return Object.values(Priority).includes(value as Priority);
}
