import { useEffect, useRef, useState, type ReactNode } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { CalendarDays, FolderKanban, Inbox, UserRound } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { TaskStatus, type Task } from "shared";
import { Avatar } from "../components/shared/Avatar";
import { CompletionStatusChip, DisciplineChip, taskStatusLabels } from "../components/shared/Chip";
import { EmptyState } from "../components/shared/EmptyState";
import { PriorityBadge } from "../components/shared/PriorityBadge";
import { LoadingSpinner } from "../components/shared/LoadingSpinner";
import { TaskDetail } from "../components/task/TaskDetail";
import { TaskCardSkeleton } from "../components/task/TaskCardSkeleton";
import { TaskStatusBadge } from "../components/task/TaskStatusBadge";
import { useAuth } from "../hooks/useAuth";
import { useSprintBoardColumnTasks, useSprintBoardSummary, useTaskById, useUpdateTaskStatus } from "../hooks/useTasks";
import { canManageTasks } from "../lib/permissions";
import { cn, formatDateOnly } from "../lib/utils";

type SprintBoardScope = "civil" | "electrical";

const boardTitles: Record<SprintBoardScope, string> = {
  civil: "Civil - Sprint Board",
  electrical: "Elétrico - Sprint Board"
};

const boardDescriptions: Record<SprintBoardScope, string> = {
  civil: "Tarefas civis de todos os projetos ativos, organizadas por status.",
  electrical: "Tarefas elétricas de todos os projetos ativos, organizadas por status."
};

const columns: Array<{ status: TaskStatus; label: string }> = [
  { status: TaskStatus.TODO, label: "A FAZER" },
  { status: TaskStatus.ON_SCHEDULE, label: "NO CRONOGRAMA" },
  { status: TaskStatus.OVERDUE, label: "ATRASADO" },
  { status: TaskStatus.IN_PROGRESS, label: "EM ANDAMENTO" },
  { status: TaskStatus.AWAITING_REVIEW, label: "AGUARDANDO REVISÃO" },
  { status: TaskStatus.IN_ANALYSIS, label: "EM ANÁLISE" },
  { status: TaskStatus.AWAITING_DEFINITION, label: "AGUARDANDO DEFINIÇÃO" },
  { status: TaskStatus.FINISHED, label: "FINALIZADO" }
];

export function SprintBoardPage({ scope }: { scope: SprintBoardScope }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const taskIdFromUrl = searchParams.get("task");
  const { data: taskFromApi } = useTaskById(taskIdFromUrl);
  const { data: summary, isLoading: isSummaryLoading } = useSprintBoardSummary(scope);
  const updateTaskStatus = useUpdateTaskStatus("");
  const { user } = useAuth();
  const canManage = canManageTasks(user);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskDetailOpenVersion, setTaskDetailOpenVersion] = useState(0);

  useEffect(() => {
    if (!taskIdFromUrl) {
      setSelectedTask(null);
      return;
    }

    if (taskFromApi?.id === taskIdFromUrl) {
      setSelectedTask(taskFromApi);
    }
  }, [taskIdFromUrl, taskFromApi]);

  function openTaskDetail(task: Task) {
    setTaskDetailOpenVersion((version) => version + 1);
    setSelectedTask(task);
    const next = new URLSearchParams(searchParams);
    next.set("task", task.id);
    setSearchParams(next, { replace: true });
  }

  function closeTaskDetail() {
    setSelectedTask(null);
    const next = new URLSearchParams(searchParams);
    next.delete("task");
    setSearchParams(next, { replace: true });
  }

  function handleDragEnd(result: DropResult) {
    if (!canManage) {
      return;
    }

    if (!result.destination) {
      return;
    }

    const nextStatus = result.destination.droppableId as TaskStatus;
    if (nextStatus === result.source.droppableId || nextStatus === TaskStatus.OVERDUE) {
      return;
    }

    void updateTaskStatus.mutateAsync({ id: result.draggableId, status: nextStatus });
  }

  if (isSummaryLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="grid min-w-0 gap-5">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold uppercase text-brand-orange">Sprint Board</p>
          <h1 className="mt-1 text-2xl font-bold text-text-primary">{boardTitles[scope]}</h1>
          <p className="mt-2 max-w-3xl text-sm text-text-secondary">{boardDescriptions[scope]}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <Metric label="Total" value={summary?.total ?? 0} />
          <Metric label="Ativas" value={summary?.active ?? 0} />
          <Metric label="Concluídas" value={summary?.completed ?? 0} />
        </div>
      </header>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto pb-3">
          <div className="flex min-w-max gap-4">
            {columns.map((column) => (
              <SprintColumn
                key={column.status}
                scope={scope}
                status={column.status}
                label={column.label}
                totalCount={summary?.byStatus[column.status] ?? 0}
                onOpenTask={openTaskDetail}
                canManage={canManage}
              />
            ))}
          </div>
        </div>
      </DragDropContext>

      <TaskDetail task={selectedTask} onClose={closeTaskDetail} openVersion={taskDetailOpenVersion} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-24 rounded-md border border-border bg-surface px-3 py-2">
      <p className="text-[11px] font-semibold uppercase text-text-muted">{label}</p>
      <p className="mt-1 text-lg font-bold text-text-primary">{value}</p>
    </div>
  );
}

function SprintColumn({
  scope,
  status,
  label,
  totalCount,
  onOpenTask,
  canManage
}: {
  scope: SprintBoardScope;
  status: TaskStatus;
  label: string;
  totalCount: number;
  onOpenTask: (task: Task) => void;
  canManage: boolean;
}) {
  const acceptsDrop = status !== TaskStatus.OVERDUE;
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useSprintBoardColumnTasks(scope, status);
  const tasks = data?.pages.flatMap((page) => page.tasks) ?? [];

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasNextPage) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { root: target.parentElement, rootMargin: "240px" }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return (
    <Droppable droppableId={status}>
      {(provided, snapshot) => (
        <section
          ref={provided.innerRef}
          {...provided.droppableProps}
          data-testid={`sprint-column-${status}`}
          className={cn(
            "flex h-[calc(100vh-230px)] min-h-[520px] w-80 flex-none flex-col rounded-md border border-border bg-surface p-3 transition",
            snapshot.isDraggingOver && acceptsDrop ? "border-brand-orange" : "",
            snapshot.isDraggingOver && !acceptsDrop ? "border-[var(--status-late-text)]" : ""
          )}
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-bold text-text-primary">{label}</h2>
              <p className="mt-1 text-xs text-text-muted">{taskStatusLabels[status]}</p>
            </div>
            <span data-testid={`sprint-column-count-${status}`} className="rounded-md bg-surface-card px-2 py-1 text-xs text-text-secondary">
              {totalCount}
            </span>
          </div>
          <div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto pr-1">
            {isLoading ? (
              <>
                <TaskCardSkeleton />
                <TaskCardSkeleton />
                <TaskCardSkeleton />
              </>
            ) : (
              <>
                {tasks.map((task, index) => (
                  <Draggable draggableId={task.id} index={index} key={task.id} isDragDisabled={!canManage}>
                    {(dragProvided, dragSnapshot) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        {...dragProvided.dragHandleProps}
                        data-testid={`sprint-task-card-${task.id}`}
                        data-task-id={task.id}
                        data-task-status={task.status}
                        className={cn(dragSnapshot.isDragging ? "opacity-80" : "")}
                      >
                        <SprintTaskCard task={task} onOpen={onOpenTask} />
                      </div>
                    )}
                  </Draggable>
                ))}
                {tasks.length === 0 && totalCount === 0 ? <EmptyState icon={<Inbox size={28} />} title="Nenhuma tarefa aqui" /> : null}
                <div ref={loadMoreRef} className="min-h-1" />
                {isFetchingNextPage ? <TaskCardSkeleton /> : null}
                {totalCount > 0 ? (
                  <p className="pb-1 text-center text-[11px] font-medium text-text-muted">
                    {tasks.length} de {totalCount}
                  </p>
                ) : null}
              </>
            )}
            {provided.placeholder}
          </div>
        </section>
      )}
    </Droppable>
  );
}

function SprintTaskCard({ task, onOpen }: { task: Task; onOpen: (task: Task) => void }) {
  const projectName = task.discipline?.projectName ?? task.projects?.[0]?.name ?? "Sem projeto";
  const sectionName = task.discipline?.name ?? task.projects?.[0]?.sectionName ?? "";
  const dateLabel = task.maxDeadline ?? task.dueDate;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(task)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(task);
        }
      }}
      className={cn(
        "cursor-pointer rounded-md border border-border bg-surface-card p-3 transition hover:border-brand-orange hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-1 focus-visible:ring-offset-[--bg-2]",
        task.completed ? "opacity-70" : ""
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className={cn("line-clamp-2 min-w-0 text-sm font-semibold leading-5", task.completed ? "text-text-muted" : "text-text-primary")}>
          {task.title}
        </h3>
        {task.assignee ? <Avatar name={task.assignee.name} imageUrl={task.assignee.avatarUrl} className="h-7 w-7" /> : null}
      </div>

      <div className="mt-3 grid gap-2 text-xs text-text-secondary">
        <InfoLine icon={<FolderKanban size={13} />} value={projectName} />
        <InfoLine icon={<UserRound size={13} />} value={task.assignee?.name ?? "Sem responsável"} />
        {dateLabel ? <InfoLine icon={<CalendarDays size={13} />} value={formatDateOnly(dateLabel, "dd/MM/yyyy")} /> : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <PriorityBadge priority={task.priority} />
        {task.taskDiscipline || sectionName ? <DisciplineChip discipline={task.taskDiscipline ?? sectionName} /> : null}
        <TaskStatusBadge status={task.status} />
        <CompletionStatusChip completed={task.completed} />
      </div>
    </article>
  );
}

function InfoLine({ icon, value }: { icon: ReactNode; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-text-muted">{icon}</span>
      <span className="truncate" title={value}>
        {value}
      </span>
    </div>
  );
}
