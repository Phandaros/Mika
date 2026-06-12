import { Fragment, useMemo, useState } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameMonth,
  max,
  min,
  startOfMonth,
  startOfWeek
} from "date-fns";
import { ArrowDownUp, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Filter, KanbanSquare, List, Plus, Search } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { TaskStatus, type Task, type UpdateTaskRequest } from "shared";
import {
  DataTable,
  DataTableCell,
  DataTableContainer,
  DataTableGroupRow,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
  EmptyCell,
  TruncatedCellValue
} from "../components/shared/DataTable";
import { EmptyState } from "../components/shared/EmptyState";
import { LoadingSpinner } from "../components/shared/LoadingSpinner";
import { ViewTab } from "../components/shared/ViewTab";
import { Avatar } from "../components/shared/Avatar";
import { CompletionStatusChip, DisciplineChip, PlatformChip, taskStatusTokens } from "../components/shared/Chip";
import { StatusOptionPill, taskStatusColors } from "../components/shared/statusVisuals";
import { TaskCard } from "../components/task/TaskCard";
import { TaskContextMenu } from "../components/task/TaskContextMenu";
import { TaskDetail } from "../components/task/TaskDetail";
import {
  EditableCompletionField,
  EditableDecimalField,
  EditableDisciplineField,
  EditableMaxDeadlineField,
  EditablePlatformField,
  EditableStageField,
  EditableStatusField
} from "../components/task/TaskInlineFields";
import { TaskStatusBadge } from "../components/task/TaskStatusBadge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { SearchableMultiSelect } from "../components/ui/searchable-multi-select";
import { SearchableSelect } from "../components/ui/searchable-select";
import { useAuth } from "../hooks/useAuth";
import { useProjects } from "../hooks/useProjects";
import { useCreateTask, useUpdateTask, useUpdateTaskCompletion } from "../hooks/useTasks";
import { defaultTaskStatusSelection, matchesMultiSelect } from "../lib/multiSelectFilter";
import { canCompleteTasks, canManageTasks } from "../lib/permissions";
import { cn, dateOnlyToLocalDate, formatDateOnly } from "../lib/utils";

type MyTasksView = "list" | "kanban" | "calendar";
type CompletionFilter = "open" | "completed" | "all";

type TaskWithProject = Task & {
  discipline: {
    id: string;
    name: string;
    projectId: string;
    projectName: string;
  };
};

const columns: Array<{ status: TaskStatus; label: string }> = [
  { status: TaskStatus.TODO, label: "A fazer" },
  { status: TaskStatus.ON_SCHEDULE, label: "No Cronograma" },
  { status: TaskStatus.OVERDUE, label: "Atrasado" },
  { status: TaskStatus.IN_PROGRESS, label: "Em andamento" },
  { status: TaskStatus.AWAITING_REVIEW, label: "Aguardando Revisão" },
  { status: TaskStatus.IN_ANALYSIS, label: "Em Análise" },
  { status: TaskStatus.AWAITING_DEFINITION, label: "Aguardando Definição" },
  { status: TaskStatus.FINISHED, label: "Finalizado" }
];

export function MyTasksPage() {
  const { user } = useAuth();
  const canManage = canManageTasks(user);
  const canComplete = canCompleteTasks(user);
  const { data: projects = [], isLoading } = useProjects();
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState<MyTasksView>("list");
  const [month, setMonth] = useState(() => new Date());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskDetailOpenVersion, setTaskDetailOpenVersion] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string[]>(defaultTaskStatusSelection);
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>("open");
  const [showUndatedOnly, setShowUndatedOnly] = useState(false);
  const [sortMode, setSortMode] = useState<"dueDate" | "title" | "project">("dueDate");
  const [showCreate, setShowCreate] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [selectedCreateTarget, setSelectedCreateTarget] = useState("");
  const updateTask = useUpdateTask("");
  const updateTaskCompletion = useUpdateTaskCompletion("");
  const disciplineOptions = useMemo(
    () =>
      projects.flatMap((project) =>
        (project.sections ?? project.disciplines)?.map((discipline) => ({
          key: `${project.id}:${discipline.id}`,
          projectId: project.id,
          disciplineId: discipline.id,
          label: `${project.name} / ${discipline.name}`
        })) ?? []
      ),
    [projects]
  );
  const createTarget = disciplineOptions.find((option) => option.key === selectedCreateTarget) ?? disciplineOptions[0];
  const createTask = useCreateTask(createTarget?.projectId ?? "", createTarget?.disciplineId ?? "");
  const search = searchParams.get("search") ?? "";
  const statusOptions = Object.values(TaskStatus).map((status) => ({
    value: status,
    label: statusLabel(status),
    color: taskStatusColors[status],
    render: <StatusOptionPill label={statusLabel(status)} color={taskStatusColors[status]} />
  }));
  const completionOptions = [
    { value: "open", label: "Não concluídas" },
    { value: "completed", label: "Concluídas" },
    { value: "all", label: "Todas" }
  ];
  const sortOptions = [
    { value: "dueDate", label: "Entrega" },
    { value: "title", label: "Nome" },
    { value: "project", label: "Projeto" }
  ];

  const myTasks = useMemo(
    () =>
      projects.flatMap((project) =>
        (project.sections ?? project.disciplines)?.flatMap((discipline) =>
          (discipline.tasks ?? [])
            .filter((task) => task.assigneeId === user?.id)
            .map((task) => ({
              ...task,
              discipline: {
                id: discipline.id,
                name: discipline.name,
                projectId: project.id,
                projectName: project.name
              }
            }))
        ) ?? []
      ),
    [projects, user?.id]
  );

  const visibleTasks = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const statusSet = new Set(statusFilter);
    const filteredTasks = myTasks
      .filter((task) => matchesMultiSelect(task.status, statusSet))
      .filter((task) => {
        if (completionFilter === "all") {
          return true;
        }

        return completionFilter === "completed" ? task.completed : !task.completed;
      })
      .filter((task) => !showUndatedOnly || !task.dueDate)
      .filter((task) => {
        if (!normalizedSearch) {
          return true;
        }

        return [task.title, task.discipline.name, task.discipline.projectName, task.description ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      });

    return [...filteredTasks].sort((a, b) => {
      if (sortMode === "title") {
        return a.title.localeCompare(b.title);
      }

      if (sortMode === "project") {
        return a.discipline.projectName.localeCompare(b.discipline.projectName);
      }

      return String(a.dueDate ?? "9999").localeCompare(String(b.dueDate ?? "9999"));
    });
  }, [completionFilter, myTasks, search, showUndatedOnly, sortMode, statusFilter]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  function handleDragEnd(result: DropResult) {
    if (!canManage) {
      return;
    }

    if (!result.destination || result.destination.droppableId === result.source.droppableId) {
      return;
    }

    if (result.destination.droppableId === TaskStatus.OVERDUE) {
      return;
    }

    void updateTask.mutateAsync({ id: result.draggableId, payload: { status: result.destination.droppableId as TaskStatus } });
  }

  async function handleCreateTask() {
    const title = draftTitle.trim();

    if (!createTarget || !title) {
      return;
    }

    await createTask.mutateAsync({ title, assigneeId: user?.id ?? null, status: TaskStatus.TODO });
    setDraftTitle("");
    setShowCreate(false);
  }

  function updateSearch(value: string) {
    const nextParams = new URLSearchParams(searchParams);

    if (value.trim()) {
      nextParams.set("search", value);
    } else {
      nextParams.delete("search");
    }

    setSearchParams(nextParams, { replace: true });
  }

  function openTaskDetail(task: Task) {
    setTaskDetailOpenVersion((version) => version + 1);
    setSelectedTask(task);
  }

  function patchTask(task: TaskWithProject, payload: UpdateTaskRequest) {
    void updateTask.mutateAsync({ id: task.id, payload });
  }

  function patchTaskCompletion(task: TaskWithProject, completed: boolean) {
    void updateTaskCompletion.mutateAsync({ id: task.id, completed });
  }

  return (
    <div className="grid gap-0">
      <section className="border-b border-border pb-0">
        <div className="mb-3 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div className="flex items-center gap-3">
            {user ? <Avatar name={user.name} imageUrl={user.avatarUrl} className="h-8 w-8" /> : null}
            <h1 className="text-2xl font-bold text-text-primary">Minhas tarefas</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-md border border-border px-3 py-1 text-sm font-semibold text-text-secondary">
              {visibleTasks.length} de {myTasks.length} tarefas
            </span>
          </div>
        </div>
        <div className="flex items-center gap-5 text-sm font-bold text-text-secondary">
          <ViewTab active={view === "list"} icon={<List size={15} />} label="Lista" onClick={() => setView("list")} />
          <ViewTab active={view === "kanban"} icon={<KanbanSquare size={15} />} label="Quadro" onClick={() => setView("kanban")} />
          <ViewTab active={view === "calendar"} icon={<CalendarDays size={15} />} label="Calendário" onClick={() => setView("calendar")} />
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3">
        <div className="flex flex-wrap items-center gap-2">
          {canManage ? (
            <Button
              className="h-8 bg-brand-orange hover:bg-orange-600"
              onClick={() => {
                setSelectedCreateTarget((current) => current || disciplineOptions[0]?.key || "");
                setShowCreate((current) => !current);
              }}
              disabled={!disciplineOptions.length}
            >
              <Plus size={15} />
              Adicionar uma tarefa
            </Button>
          ) : null}
          {view === "calendar" ? (
            <>
              <Button variant="ghost" className="h-8 w-8 px-0" onClick={() => setMonth((current) => addMonths(current, -1))} title="Mês anterior">
                <ChevronLeft size={16} />
              </Button>
              <Button variant="secondary" className="h-8" onClick={() => setMonth(new Date())}>
                Hoje
              </Button>
              <Button variant="ghost" className="h-8 w-8 px-0" onClick={() => setMonth((current) => addMonths(current, 1))} title="Próximo mês">
                <ChevronRight size={16} />
              </Button>
              <span className="ml-2 text-sm text-text-primary">{format(month, "MMMM yyyy")}</span>
            </>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-text-secondary">
          <button
            type="button"
            onClick={() => setShowUndatedOnly((current) => !current)}
            className={cn("hover:text-text-primary", showUndatedOnly ? "text-brand-orange" : "")}
          >
            Sem data ({myTasks.filter((task) => !task.dueDate).length})
          </button>
          <label className="inline-flex items-center gap-1.5">
            <CheckCircle2 size={15} />
            <SearchableSelect
              value={completionFilter}
              options={completionOptions}
              triggerClassName="h-8 w-40"
              searchPlaceholder="Buscar conclusão..."
              onValueChange={(value) => setCompletionFilter(value as CompletionFilter)}
            />
          </label>
          <label className="inline-flex items-center gap-1.5">
            <Filter size={15} />
            <SearchableMultiSelect
              values={statusFilter}
              options={statusOptions}
              triggerClassName="h-8 w-40"
              searchPlaceholder="Buscar status..."
              allSelectedLabel="Todos status"
              noneSelectedLabel="Nenhum status"
              partialSelectedLabel={(count) => `${count} status`}
              onValuesChange={setStatusFilter}
            />
          </label>
          <label className="inline-flex items-center gap-1.5">
            <ArrowDownUp size={15} />
            <SearchableSelect
              value={sortMode}
              options={sortOptions}
              triggerClassName="h-8 w-36"
              searchPlaceholder="Buscar ordenação..."
              onValueChange={(value) => setSortMode(value as typeof sortMode)}
            />
          </label>
          <label className="relative">
            <Search size={15} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2" />
            <Input value={search} onChange={(event) => updateSearch(event.target.value)} className="h-8 w-52 pl-8" placeholder="Buscar" />
          </label>
        </div>
      </div>

      {showCreate && canManage ? (
        <div className="grid gap-2 border-b border-border py-3 lg:grid-cols-[minmax(220px,340px)_minmax(260px,1fr)_auto]">
          {disciplineOptions.length > 0 ? (
            <SearchableSelect
              value={selectedCreateTarget || createTarget?.key || disciplineOptions[0]!.key}
              options={disciplineOptions.map((option) => ({ value: option.key, label: option.label }))}
              searchPlaceholder="Buscar projeto ou seção..."
              onValueChange={setSelectedCreateTarget}
            />
          ) : null}
          <Input
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleCreateTask();
              }

              if (event.key === "Escape") {
                setDraftTitle("");
                setShowCreate(false);
              }
            }}
            placeholder="Nome da tarefa"
            autoFocus
          />
          <Button onClick={() => void handleCreateTask()} disabled={!draftTitle.trim() || createTask.isPending}>
            Criar
          </Button>
        </div>
      ) : null}

      {myTasks.length === 0 ? <EmptyState title="Você não possui tarefas atribuídas" /> : null}
      {myTasks.length > 0 && visibleTasks.length === 0 ? <EmptyState title="Nenhuma tarefa corresponde aos filtros" /> : null}
      {view === "list" ? (
        <ListView
          tasks={visibleTasks}
          canManage={canManage}
          canComplete={canComplete}
          onOpenTask={openTaskDetail}
          onPatchTask={patchTask}
          onPatchCompletion={patchTaskCompletion}
        />
      ) : null}
      {view === "kanban" ? (
        <KanbanView
          tasks={visibleTasks}
          onDragEnd={handleDragEnd}
          onOpenTask={openTaskDetail}
          canManage={canManage}
        />
      ) : null}
      {view === "calendar" ? <CalendarView month={month} tasks={visibleTasks} onOpenTask={openTaskDetail} /> : null}
      <TaskDetail
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onOpenTask={openTaskDetail}
        openVersion={taskDetailOpenVersion}
      />
    </div>
  );
}

function ListView({
  tasks,
  canManage,
  canComplete,
  onOpenTask,
  onPatchTask,
  onPatchCompletion
}: {
  tasks: TaskWithProject[];
  canManage: boolean;
  canComplete: boolean;
  onOpenTask: (task: TaskWithProject) => void;
  onPatchTask: (task: TaskWithProject, payload: UpdateTaskRequest) => void;
  onPatchCompletion: (task: TaskWithProject, completed: boolean) => void;
}) {
  const openTasks = tasks.filter((task) => !task.completed);
  const completedTasks = tasks.filter((task) => task.completed);
  const groups = [
    { key: "open", label: "Não concluídas", tasks: openTasks },
    { key: "completed", label: "Concluídas", tasks: completedTasks }
  ].filter((group) => group.tasks.length > 0);
  const columnCount = 11;

  return (
    <DataTableContainer>
      <DataTable minWidth="1360px">
        <colgroup>
          <col className="w-[160px]" />
          <col className="w-[260px]" />
          <col className="w-[120px]" />
          <col className="w-[150px]" />
          <col className="w-[90px]" />
          <col className="w-[100px]" />
          <col className="w-[120px]" />
          <col className="w-[120px]" />
          <col className="w-[90px]" />
          <col className="w-[90px]" />
          <col className="w-[80px]" />
        </colgroup>
        <DataTableHead>
          <tr className="border-b border-[--color-border]">
            <DataTableHeader>Projeto</DataTableHeader>
            <DataTableHeader>Tarefa</DataTableHeader>
            <DataTableHeader>Seção</DataTableHeader>
            <DataTableHeader>Status</DataTableHeader>
            <DataTableHeader align="center">Plataforma</DataTableHeader>
            <DataTableHeader align="center">Disciplina</DataTableHeader>
            <DataTableHeader align="center">Status Conclusão</DataTableHeader>
            <DataTableHeader>Prazo Máximo</DataTableHeader>
            <DataTableHeader align="right">Dias Estimados</DataTableHeader>
            <DataTableHeader align="right">Dias Conclusão</DataTableHeader>
            <DataTableHeader>Etapa</DataTableHeader>
          </tr>
        </DataTableHead>
        <tbody>
          {groups.map((group) => (
            <Fragment key={group.key}>
              <DataTableGroupRow colSpan={columnCount} label={group.label} count={group.tasks.length} />
              {group.tasks.map((task, index) => (
                <TaskContextMenu
                  key={`${group.key}:${task.id}:${task.discipline.projectId}:${task.discipline.id}:${index}`}
                  task={task}
                  projectId={task.discipline.projectId}
                  onOpen={onOpenTask}
                  fallbackLinkPath="/my-tasks"
                >
                  <DataTableRow className={cn(task.completed ? "opacity-70" : "")}>
                    <DataTableCell>
                      <Link
                        to={`/projects/${task.discipline.projectId}`}
                        title={task.discipline.projectName}
                        className="block min-w-0 truncate text-[13px] text-[--color-text-primary] transition-colors hover:text-brand-orange"
                      >
                        {task.discipline.projectName || <EmptyCell />}
                      </Link>
                    </DataTableCell>
                    <DataTableCell>
                      <div className="flex min-w-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenTask(task)}
                          title={task.title}
                          className={cn(
                            "min-w-0 truncate text-left font-medium hover:text-brand-orange",
                            task.completed ? "text-text-muted" : "text-text-primary"
                          )}
                        >
                          {task.title || <EmptyCell />}
                        </button>
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <TruncatedCellValue value={task.discipline.name} />
                    </DataTableCell>
                    <DataTableCell>
                      {canManage ? (
                        <EditableStatusField
                          task={task}
                          variant="table"
                          onSave={(status) => onPatchTask(task, { status })}
                        />
                      ) : (
                        <TaskStatusBadge status={task.status} />
                      )}
                    </DataTableCell>
                    <DataTableCell align="center">
                      {canManage ? (
                        <EditablePlatformField
                          value={task.platform}
                          variant="table"
                          onSave={(platform) => onPatchTask(task, { platform })}
                        />
                      ) : task.platform ? (
                        <PlatformChip platform={task.platform} />
                      ) : (
                        <EmptyCell />
                      )}
                    </DataTableCell>
                    <DataTableCell align="center">
                      {canManage ? (
                        <EditableDisciplineField
                          value={task.taskDiscipline}
                          variant="table"
                          onSave={(taskDiscipline) => onPatchTask(task, { taskDiscipline })}
                        />
                      ) : task.taskDiscipline ? (
                        <DisciplineChip discipline={task.taskDiscipline} />
                      ) : (
                        <EmptyCell />
                      )}
                    </DataTableCell>
                    <DataTableCell align="center">
                      {canManage || canComplete ? (
                        <EditableCompletionField
                          completed={task.completed}
                          variant="table"
                          onSave={(completed) => onPatchCompletion(task, completed)}
                        />
                      ) : (
                        <CompletionStatusChip completed={task.completed} />
                      )}
                    </DataTableCell>
                    <DataTableCell>
                      {canManage ? (
                        <EditableMaxDeadlineField
                          value={task.maxDeadline}
                          variant="table"
                          onSave={(maxDeadline) => onPatchTask(task, { maxDeadline })}
                        />
                      ) : task.maxDeadline ? (
                        <span>{formatDateOnly(task.maxDeadline, "dd/MM/yyyy")}</span>
                      ) : (
                        <EmptyCell />
                      )}
                    </DataTableCell>
                    <DataTableCell align="right" className="font-mono text-[12px]">
                      {canManage ? (
                        <EditableDecimalField
                          value={task.estimatedTime}
                          variant="table"
                          onSave={(estimatedTime) => onPatchTask(task, { estimatedTime, estimatedDays: estimatedTime })}
                        />
                      ) : task.estimatedTime == null ? (
                        <EmptyCell />
                      ) : (
                        <span>{formatDecimalDisplay(task.estimatedTime)}</span>
                      )}
                    </DataTableCell>
                    <DataTableCell align="right" className="font-mono text-[12px]">
                      {canManage ? (
                        <EditableDecimalField
                          value={task.conclusionDays}
                          variant="table"
                          onSave={(conclusionDays) => onPatchTask(task, { conclusionDays })}
                        />
                      ) : task.conclusionDays == null ? (
                        <EmptyCell />
                      ) : (
                        <span>{formatDecimalDisplay(task.conclusionDays)}</span>
                      )}
                    </DataTableCell>
                    <DataTableCell>
                      {canManage ? (
                        <EditableStageField
                          value={task.stage}
                          stageField={null}
                          variant="table"
                          onSave={(stage) => onPatchTask(task, { stage })}
                        />
                      ) : (
                        <TruncatedCellValue value={task.stage} />
                      )}
                    </DataTableCell>
                  </DataTableRow>
                </TaskContextMenu>
              ))}
            </Fragment>
          ))}
        </tbody>
      </DataTable>
    </DataTableContainer>
  );
}

function formatDecimalDisplay(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function KanbanView({
  tasks,
  onDragEnd,
  onOpenTask,
  canManage
}: {
  tasks: TaskWithProject[];
  onDragEnd: (result: DropResult) => void;
  onOpenTask: (task: TaskWithProject) => void;
  canManage: boolean;
}) {
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="overflow-x-auto py-4">
        <div className="flex min-w-max gap-3">
          {columns.map((column) => {
            const columnTasks = tasks.filter((task) => task.status === column.status);
            return (
              <Droppable key={column.status} droppableId={column.status}>
                {(provided, snapshot) => (
                  <section
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      "flex min-h-[560px] w-72 flex-none flex-col rounded-md border border-border bg-surface p-2 transition",
                      snapshot.isDraggingOver ? "border-brand-orange" : ""
                    )}
                  >
                    <div className="mb-2 flex h-8 items-center justify-between px-2">
                      <h2 className="text-sm font-bold text-text-primary">{column.label}</h2>
                      <span className="rounded bg-surface-card px-2 py-0.5 text-xs text-text-secondary">{columnTasks.length}</span>
                    </div>
                    <div className="grid flex-1 content-start gap-2">
                      {columnTasks.map((task, index) => (
                        <Draggable key={task.id} draggableId={task.id} index={index} isDragDisabled={!canManage}>
                          {(dragProvided) => (
                            <div ref={dragProvided.innerRef} {...dragProvided.draggableProps} {...dragProvided.dragHandleProps}>
                              <TaskCard
                                task={task}
                                disciplineName={task.discipline.name}
                                onOpen={onOpenTask}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  </section>
                )}
              </Droppable>
            );
          })}
        </div>
      </div>
    </DragDropContext>
  );
}

const calendarWeekOptions = { weekStartsOn: 1 as const };

function CalendarView({ month, tasks, onOpenTask }: { month: Date; tasks: TaskWithProject[]; onOpenTask: (task: TaskWithProject) => void }) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), calendarWeekOptions),
    end: endOfWeek(endOfMonth(month), calendarWeekOptions)
  });
  const weeks = chunkDays(days);
  const rangedTasks = tasks.flatMap((task) => {
    const range = taskDateRange(task);
    return range ? [{ task, ...range }] : [];
  });

  return (
    <div className="overflow-hidden rounded-md border border-[--color-border] bg-[--bg-2] text-sm">
      <div className="grid grid-cols-7 border-b border-[--color-border] bg-[--bg-1]">
        {["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"].map((day) => (
          <div key={day} className="border-r border-[--color-border-subtle] px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-[--color-text-muted] last:border-r-0">
            {day}
          </div>
        ))}
      </div>
      <div>
        {weeks.map((week) => {
          const weekStart = week[0]!;
          const weekEnd = week[week.length - 1]!;
          const visibleBars = rangedTasks
            .filter((item) => rangesOverlap(item.start, item.end, weekStart, weekEnd))
            .sort((a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime())
            .slice(0, 4);
          const hiddenCount = Math.max(0, rangedTasks.filter((item) => rangesOverlap(item.start, item.end, weekStart, weekEnd)).length - visibleBars.length);

          return (
            <div key={weekStart.toISOString()} className="relative min-h-[148px] border-b border-[--color-border-subtle] last:border-b-0">
              <div className="grid h-full min-h-[148px] grid-cols-7">
                {week.map((day) => (
                  <div key={day.toISOString()} className="border-r border-[--color-border-subtle] px-2 py-2 last:border-r-0">
                    <span className={cn("text-[13px] font-semibold", isSameMonth(day, month) ? "text-[--color-text-primary]" : "text-[--color-text-muted]")}>
                      {format(day, "d")}
                    </span>
                  </div>
                ))}
              </div>
              <div className="pointer-events-none absolute inset-x-0 top-9 grid grid-cols-7 gap-y-1 px-2">
                {visibleBars.map((item, index) => {
                  const clippedStart = max([item.start, weekStart]);
                  const clippedEnd = min([item.end, weekEnd]);
                  const startsBeforeWeek = isBefore(item.start, weekStart);
                  const endsAfterWeek = isAfter(item.end, weekEnd);
                  const columnStart = weekColumn(clippedStart);
                  const columnEnd = weekColumn(clippedEnd) + 1;
                  const tokens = taskStatusTokens[item.task.status];

                  return (
                    <TaskContextMenu
                      key={`${item.task.id}:${item.task.discipline.projectId}:${item.task.discipline.id}:${index}`}
                      task={item.task}
                      projectId={item.task.discipline.projectId}
                      onOpen={onOpenTask}
                      fallbackLinkPath="/my-tasks"
                    >
                      <button
                        type="button"
                        onClick={() => onOpenTask(item.task)}
                        className={cn(
                          "pointer-events-auto min-w-0 truncate px-2 py-1 text-left text-[11px] font-medium transition-colors hover:brightness-125",
                          startsBeforeWeek ? "rounded-l-none" : "rounded-l",
                          endsAfterWeek ? "rounded-r-none" : "rounded-r"
                        )}
                        style={{
                          gridColumn: `${columnStart} / ${columnEnd}`,
                          gridRow: index + 1,
                          backgroundColor: `var(${tokens.bg})`,
                          color: `var(${tokens.text})`
                        }}
                        title={`${item.task.title} · ${item.task.discipline.projectName} / ${item.task.discipline.name}`}
                      >
                        <span className="truncate">{item.task.title}</span>
                      </button>
                    </TaskContextMenu>
                  );
                })}
                {hiddenCount > 0 ? (
                  <span
                    className="rounded bg-[--bg-4] px-2 py-1 text-[11px] font-medium text-[--color-text-secondary]"
                    style={{ gridColumn: "1 / 8", gridRow: visibleBars.length + 1 }}
                  >
                    +{hiddenCount} tarefas no período
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function statusLabel(status: TaskStatus): string {
  return columns.find((column) => column.status === status)?.label ?? status;
}

function chunkDays(days: Date[]): Date[][] {
  const weeks: Date[][] = [];
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }
  return weeks;
}

function taskDateRange(task: TaskWithProject): { start: Date; end: Date } | null {
  const startDate = dateOnlyToLocalDate(task.startDate);
  const dueDate = dateOnlyToLocalDate(task.dueDate);
  const start = startDate ?? dueDate;
  const end = dueDate ?? startDate;

  if (!start || !end) {
    return null;
  }

  return isAfter(start, end) ? { start: end, end: start } : { start, end };
}

function rangesOverlap(start: Date, end: Date, rangeStart: Date, rangeEnd: Date): boolean {
  return !isBefore(end, rangeStart) && !isAfter(start, rangeEnd);
}

function weekColumn(day: Date): number {
  return day.getDay() === 0 ? 7 : day.getDay();
}
