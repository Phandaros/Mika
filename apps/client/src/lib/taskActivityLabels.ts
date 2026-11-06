import { Priority, TaskStatus, type TaskActivity } from "shared";
import { taskStatusLabels } from "../components/shared/Chip";

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

export function activitySentence(activity: TaskActivity): string {
  if (activity.type === "CREATED") {
    return `criou esta tarefa${activity.toValue ? `: ${activity.toValue}` : ""}`;
  }

  if (activity.type === "COMPLETED") {
    return "concluiu esta tarefa";
  }

  if (activity.type === "REOPENED") {
    return "reabriu esta tarefa";
  }

  if (activity.type === "REVIEW_REQUESTED") {
    return `enviou a tarefa para Revisão de ${reviewerName(activity)}`;
  }

  if (activity.type === "REVIEW_APPROVED") {
    return "aprovou essa tarefa";
  }

  if (activity.type === "REVIEW_REJECTED") {
    return "reprovou essa tarefa";
  }

  const field = activity.field ? fieldLabels[activity.field] ?? activity.field : "Campo";
  return `alterou ${field} de ${formatActivityValue(activity.field, activity.fromValue)} para ${formatActivityValue(activity.field, activity.toValue)}`;
}

function reviewerName(activity: TaskActivity): string {
  const name = activity.metadata?.reviewerName;

  if (typeof name === "string" && name.trim()) {
    return name;
  }

  return activity.toValue ?? "revisor";
}

export function formatActivityValue(field: string | null, value: string | null): string {
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

export function activityFieldLabel(field: string | null): string {
  return field ? fieldLabels[field] ?? field : "Campo";
}
