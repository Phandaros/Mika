import { useEffect, useRef, useState } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { Inbox } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { TaskStatus, type Task } from "shared";
import { EmptyState } from "../components/shared/EmptyState";
import { LoadingSpinner } from "../components/shared/LoadingSpinner";
import { KanbanColumn } from "../components/task/KanbanColumn";
import { KanbanTaskCard } from "../components/task/TaskCard";
import { TaskDetail } from "../components/task/TaskDetail";
import { TaskCardSkeleton } from "../components/task/TaskCardSkeleton";
import { useAuth } from "../hooks/useAuth";
import { useSprintBoardColumnTasks, useSprintBoardSummary, useTaskById, useUpdateTaskStatus } from "../hooks/useTasks";
import { canManageTasks } from "../lib/permissions";
import { cn } from "../lib/utils";

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

      <TaskDetail
        task={selectedTask}
        onClose={closeTaskDetail}
        onOpenTask={openTaskDetail}
        openVersion={taskDetailOpenVersion}
      />
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
        <KanbanColumn
          ref={provided.innerRef}
          {...provided.droppableProps}
          data-testid={`sprint-column-${status}`}
          status={status}
          label={label}
          count={totalCount}
          countTestId={`sprint-column-count-${status}`}
          isDraggingOver={snapshot.isDraggingOver}
          isDropBlocked={!acceptsDrop}
        >
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
                        <KanbanTaskCard
                          task={task}
                          onOpen={onOpenTask}
                          fallbackLinkPath={scope === "civil" ? "/sprint/civil" : "/sprint/eletrico"}
                        />
                      </div>
                    )}
                  </Draggable>
                ))}
                {tasks.length === 0 && totalCount === 0 ? <EmptyState icon={<Inbox size={28} />} title="Nenhuma tarefa aqui" /> : null}
                <div ref={loadMoreRef} className="min-h-1" />
                {isFetchingNextPage ? <TaskCardSkeleton /> : null}
                {hasNextPage && totalCount > 0 ? (
                  <p className="pb-1 text-center text-[11px] font-medium text-text-muted">
                    {tasks.length} de {totalCount}
                  </p>
                ) : null}
              </>
          )}
          {provided.placeholder}
        </KanbanColumn>
      )}
    </Droppable>
  );
}
