import { useMemo } from "react";
import { addCalendarDaysYmd, buildNonWorkingDays, canRecalculateTaskDates, recalculatedDueDate } from "../lib/businessDays";
import { toDateOnly } from "../lib/utils";
import { resolveTaskProjectId } from "../lib/taskLink";
import { toast } from "sonner";
import { TaskStatus, type CreateTaskRequest, type Task } from "shared";
import { useCompanyHolidays } from "./useCompanyHolidays";
import {
  useCreateTaskInSection,
  useSendTaskToReview,
  useUpdateTask,
  useUpdateTaskCompletion,
  useUpdateTaskStatus
} from "./useTasks";

export function useTaskContextActions(task: Task, projectId = "") {
  const resolvedProjectId = projectId || resolveTaskProjectId(task) || "";
  const createTaskInSection = useCreateTaskInSection();
  const updateTask = useUpdateTask(resolvedProjectId);
  const updateTaskStatus = useUpdateTaskStatus(resolvedProjectId);
  const updateTaskCompletion = useUpdateTaskCompletion(resolvedProjectId);
  const sendTaskToReviewMutation = useSendTaskToReview(resolvedProjectId);

  const startDate = toDateOnly(task.startDate);
  const holidayFrom = startDate ?? new Date().toISOString().slice(0, 10);
  const holidayTo = startDate ? addCalendarDaysYmd(startDate, 120) : addCalendarDaysYmd(holidayFrom, 120);
  const holidaysQuery = useCompanyHolidays(holidayFrom, holidayTo, Boolean(startDate));

  const nonWorkingDays = useMemo(() => {
    if (!startDate) {
      return new Set<string>();
    }

    return buildNonWorkingDays(
      startDate,
      addCalendarDaysYmd(startDate, 120),
      (holidaysQuery.data ?? []).map((holiday) => holiday.date)
    );
  }, [holidaysQuery.data, startDate]);

  const canRecalculate = canRecalculateTaskDates(task);

  async function duplicateTask() {
    const sectionId = task.disciplineId;
    const taskProjectId = resolveTaskProjectId(task);

    if (!sectionId || !taskProjectId) {
      toast.error("Não foi possível duplicar a tarefa");
      return;
    }

    const customFieldValues: CreateTaskRequest["customFieldValues"] = task.customFieldValues
      ?.flatMap((field) =>
        field.mikaKey
          ? [{
              mikaKey: field.mikaKey,
              value: field.numberValue ?? field.enumOptionName ?? field.displayValue ?? null
            }]
          : []
      );

    const payload: CreateTaskRequest = {
      title: `${task.title} (cópia)`,
      description: task.description,
      status: task.status,
      priority: task.priority,
      assigneeId: task.assigneeId,
      startDate: task.startDate,
      dueDate: task.dueDate,
      estimatedDays: task.estimatedDays ?? null,
      platform: task.platform ?? null,
      taskDiscipline: task.taskDiscipline ?? null,
      estimatedTime: task.estimatedTime ?? null,
      maxDeadline: task.maxDeadline ?? null,
      conclusionDays: task.conclusionDays ?? null,
      stage: task.stage ?? null,
      ...(customFieldValues?.length ? { customFieldValues } : {})
    };

    try {
      await createTaskInSection.mutateAsync({
        projectId: taskProjectId,
        sectionId,
        payload
      });
      toast.success("Tarefa duplicada");
    } catch {
      toast.error("Não foi possível duplicar a tarefa");
    }
  }

  async function recalculateDates() {
    if (!startDate || !canRecalculate) {
      return;
    }

    const estimatedDays = task.estimatedDays ?? task.estimatedTime ?? 0;
    const dueDate = recalculatedDueDate(startDate, estimatedDays, nonWorkingDays);

    try {
      await updateTask.mutateAsync({
        id: task.id,
        payload: { startDate, dueDate }
      });
      toast.success("Datas recalculadas");
    } catch {
      toast.error("Não foi possível recalcular as datas");
    }
  }

  async function changeStatus(status: TaskStatus) {
    if (status === task.status) {
      return;
    }

    try {
      await updateTaskStatus.mutateAsync({ id: task.id, status });
    } catch {
      toast.error("Não foi possível alterar o status");
    }
  }

  async function toggleCompletion() {
    try {
      await updateTaskCompletion.mutateAsync({ id: task.id, completed: !task.completed });
      toast.success(task.completed ? "Tarefa reaberta" : "Tarefa concluída");
    } catch {
      toast.error("Não foi possível atualizar a conclusão da tarefa");
    }
  }

  async function sendToReview(reviewerId: string) {
    const isReassignment = Boolean(task.pendingReview);

    try {
      await sendTaskToReviewMutation.mutateAsync({ taskId: task.id, reviewerId });
      toast.success(isReassignment ? "Revisão reatribuída" : "Tarefa enviada para revisão");
    } catch {
      toast.error("Não foi possível enviar para revisão");
    }
  }

  const canSendToReview = task.status !== TaskStatus.FINISHED;

  return {
    duplicateTask,
    recalculateDates,
    changeStatus,
    toggleCompletion,
    sendToReview,
    canRecalculate,
    canSendToReview,
    isDuplicating: createTaskInSection.isPending,
    isUpdating:
      updateTask.isPending ||
      updateTaskStatus.isPending ||
      updateTaskCompletion.isPending ||
      sendTaskToReviewMutation.isPending
  };
}
