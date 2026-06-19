import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { ArrowDownUp, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Filter, Inbox, KanbanSquare, List, Plus, Search } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { Role, TaskStatus, type Task, type UpdateTaskRequest, type User } from "shared";
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
import { ViewTab } from "../components/shared/ViewTab";
import { Avatar } from "../components/shared/Avatar";
import { CompletionStatusChip, DisciplineChip, PlatformChip } from "../components/shared/Chip";
import { StatusOptionPill, taskStatusColors } from "../components/shared/statusVisuals";
import { KanbanColumn } from "../components/task/KanbanColumn";
import { KanbanTaskCard } from "../components/task/TaskCard";
import { TaskContextMenu } from "../components/task/TaskContextMenu";
import { TaskDetail } from "../components/task/TaskDetail";
import { MyTasksCalendarView, type MyTasksCalendarViewHandle } from "../components/task/MyTasksCalendarView";
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
import { useMyTasks } from "../hooks/useMyTasks";
import { useProjectOptions } from "../hooks/useProjects";
import { useCreateTask, useTaskById, useUpdateTask, useUpdateTaskCompletion } from "../hooks/useTasks";
import { api } from "../lib/api";
import { defaultTaskStatusSelection, isAllSelected, matchesMultiSelect } from "../lib/multiSelectFilter";
import { canCompleteTasks, canManageTasks } from "../lib/permissions";
import { cn, formatDateOnly } from "../lib/utils";

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
  { status: TaskStatus.TODO, label: "A FAZER" },
  { status: TaskStatus.ON_SCHEDULE, label: "NO CRONOGRAMA" },
  { status: TaskStatus.OVERDUE, label: "ATRASADO" },
  { status: TaskStatus.IN_PROGRESS, label: "EM ANDAMENTO" },
  { status: TaskStatus.AWAITING_REVIEW, label: "AGUARDANDO REVISÃO" },
  { status: TaskStatus.IN_ANALYSIS, label: "EM ANÁLISE" },
  { status: TaskStatus.AWAITING_DEFINITION, label: "AGUARDANDO DEFINIÇÃO" },
  { status: TaskStatus.FINISHED, label: "FINALIZADO" }
];

export function MyTasksPage() {
  const { user } = useAuth();
  const canManage = canManageTasks(user);
  const canComplete = canCompleteTasks(user);
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("search") ?? "";
  const taskIdFromUrl = searchParams.get("task");
  const requestedUserId = searchParams.get("userId");
  const isCoordinatorOrAdmin = user?.role === Role.ADMIN || user?.role === Role.COORDINATOR;
  const subjectUserId = isCoordinatorOrAdmin && requestedUserId ? requestedUserId : undefined;
  const { data: subjectUser } = useQuery({
    queryKey: ["users", subjectUserId],
    enabled: Boolean(subjectUserId),
    queryFn: async () => {
      const response = await api.get<{ user: User }>(`/users/${subjectUserId}`);
      return response.data.user;
    }
  });
  const [statusFilter, setStatusFilter] = useState<string[]>(defaultTaskStatusSelection);
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>("open");
  const defaultStatuses = useMemo(() => defaultTaskStatusSelection(), []);
  const statusQuery = useMemo(() => {
    if (isAllSelected(new Set(statusFilter), defaultStatuses)) {
      return undefined;
    }

    return statusFilter as TaskStatus[];
  }, [defaultStatuses, statusFilter]);
  const {
    data: rawTasks = [],
    isLoading,
    isError,
    refetch
  } = useMyTasks({
    completion: completionFilter,
    status: statusQuery,
    search: search.trim() || undefined,
    userId: subjectUserId
  });
  const { data: projectOptions = [] } = useProjectOptions();
  const { data: linkedTask } = useTaskById(taskIdFromUrl);
  const [view, setView] = useState<MyTasksView>("list");
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const calendarRef = useRef<MyTasksCalendarViewHandle>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskDetailOpenVersion, setTaskDetailOpenVersion] = useState(0);
  const [showUndatedOnly, setShowUndatedOnly] = useState(false);
  const [sortMode, setSortMode] = useState<"dueDate" | "title" | "project">("dueDate");
  const [showCreate, setShowCreate] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [selectedCreateTarget, setSelectedCreateTarget] = useState("");
  const updateTask = useUpdateTask("");
  const updateTaskCompletion = useUpdateTaskCompletion("");
  const disciplineOptions = useMemo(
    () =>
      projectOptions.flatMap((project) =>
        (project.sections ?? project.disciplines)?.map((discipline) => ({
          key: `${project.id}:${discipline.id}`,
          projectId: project.id,
          disciplineId: discipline.id,
          label: `${project.name} / ${discipline.name}`
        })) ?? []
      ),
    [projectOptions]
  );
  const createTarget = disciplineOptions.find((option) => option.key === selectedCreateTarget) ?? disciplineOptions[0];
  const createTask = useCreateTask(createTarget?.projectId ?? "", createTarget?.disciplineId ?? "");
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

  const myTasks = useMemo(() => rawTasks.map(toTaskWithProject), [rawTasks]);

  const visibleTasks = useMemo(() => {
    const statusSet = new Set(statusFilter);
    const filteredTasks = myTasks
      .filter((task) => matchesMultiSelect(task.status, statusSet))
      .filter((task) => !showUndatedOnly || !task.dueDate);

    return [...filteredTasks].sort((a, b) => {
      if (sortMode === "title") {
        return a.title.localeCompare(b.title);
      }

      if (sortMode === "project") {
        return a.discipline.projectName.localeCompare(b.discipline.projectName);
      }

      return String(a.dueDate ?? "9999").localeCompare(String(b.dueDate ?? "9999"));
    });
  }, [myTasks, showUndatedOnly, sortMode, statusFilter]);

  useEffect(() => {
    if (!linkedTask) {
      return;
    }

    setTaskDetailOpenVersion((version) => version + 1);
    setSelectedTask(linkedTask);
  }, [linkedTask?.id]);

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
      {isError ? (
        <section className="mb-4 rounded-md border border-[--color-border] bg-[--bg-2] p-4">
          <h2 className="text-sm font-semibold text-[--color-text-primary]">Não foi possível carregar suas tarefas</h2>
          <p className="mt-1 text-[13px] text-[--color-text-secondary]">Verifique a conexão e tente novamente.</p>
          <Button variant="secondary" className="mt-3 h-8" onClick={() => void refetch()}>
            Tentar novamente
          </Button>
        </section>
      ) : null}
      <section className="border-b border-border pb-0">
        <div className="mb-3 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div className="flex items-center gap-3">
            {subjectUser ? (
              <Avatar name={subjectUser.name} imageUrl={subjectUser.avatarUrl} className="h-8 w-8" />
            ) : user ? (
              <Avatar name={user.name} imageUrl={user.avatarUrl} className="h-8 w-8" />
            ) : null}
            <div>
              <h1 className="text-2xl font-bold text-text-primary">
                {subjectUser ? `Tarefas de ${subjectUser.name}` : "Minhas tarefas"}
              </h1>
              {subjectUser ? (
                <Link to={`/users/${subjectUser.id}`} className="text-[13px] font-medium text-brand-orange hover:text-orange-600">
                  Voltar ao perfil
                </Link>
              ) : null}
            </div>
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
              <Button
                variant="ghost"
                className="h-8 w-8 px-0"
                onClick={() => calendarRef.current?.scrollByMonths(-1)}
                title="Mês anterior"
              >
                <ChevronLeft size={16} />
              </Button>
              <Button variant="secondary" className="h-8" onClick={() => calendarRef.current?.scrollToToday()}>
                Hoje
              </Button>
              <Button
                variant="ghost"
                className="h-8 w-8 px-0"
                onClick={() => calendarRef.current?.scrollByMonths(1)}
                title="Próximo mês"
              >
                <ChevronRight size={16} />
              </Button>
              <span className="ml-2 text-sm capitalize text-text-primary">
                {format(visibleMonth, "MMMM yyyy", { locale: ptBR })}
              </span>
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

      {isLoading ? <MyTasksContentSkeleton view={view} /> : null}
      {!isLoading && !isError && view !== "kanban" && myTasks.length === 0 ? (
        <EmptyState title="Você não possui tarefas atribuídas" />
      ) : null}
      {!isLoading && !isError && view !== "kanban" && myTasks.length > 0 && visibleTasks.length === 0 ? (
        <EmptyState title="Nenhuma tarefa corresponde aos filtros" />
      ) : null}
      {!isLoading && !isError && view === "list" ? (
        <ListView
          tasks={visibleTasks}
          canManage={canManage}
          canComplete={canComplete}
          onOpenTask={openTaskDetail}
          onPatchTask={patchTask}
          onPatchCompletion={patchTaskCompletion}
        />
      ) : null}
      {!isLoading && !isError && view === "kanban" ? (
        <KanbanView
          tasks={visibleTasks}
          onDragEnd={handleDragEnd}
          onOpenTask={openTaskDetail}
          canManage={canManage}
        />
      ) : null}
      {!isLoading && !isError && view === "calendar" ? (
        <MyTasksCalendarView
          ref={calendarRef}
          tasks={visibleTasks}
          onOpenTask={openTaskDetail}
          onVisibleMonthChange={setVisibleMonth}
        />
      ) : null}
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

function toTaskWithProject(task: Task): TaskWithProject {
  return {
    ...task,
    discipline: {
      id: task.discipline?.id ?? task.disciplineId ?? "",
      name: task.discipline?.name ?? "",
      projectId: task.discipline?.projectId ?? task.projects?.[0]?.id ?? "",
      projectName: task.discipline?.projectName ?? task.projects?.[0]?.name ?? ""
    }
  };
}

function MyTasksContentSkeleton({ view }: { view: MyTasksView }) {
  if (view === "kanban") {
    return (
      <div className="overflow-x-auto py-4">
        <div className="flex min-w-max gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-[560px] w-72 animate-pulse rounded-md border border-border bg-surface" />
          ))}
        </div>
      </div>
    );
  }

  if (view === "calendar") {
    return <div className="my-4 h-[calc(100dvh-280px)] animate-pulse rounded-md border border-border bg-surface" />;
  }

  return (
    <div className="my-4 grid gap-2">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="h-10 animate-pulse rounded-md border border-border bg-surface" />
      ))}
    </div>
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
        <div className="flex min-w-max gap-4">
          {columns.map((column) => {
            const columnTasks = tasks.filter((task) => task.status === column.status);
            return (
              <Droppable key={column.status} droppableId={column.status}>
                {(provided, snapshot) => (
                  <KanbanColumn
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    status={column.status}
                    label={column.label}
                    count={columnTasks.length}
                    isDraggingOver={snapshot.isDraggingOver}
                    isDropBlocked={column.status === TaskStatus.OVERDUE}
                  >
                    {columnTasks.map((task, index) => (
                      <Draggable key={task.id} draggableId={task.id} index={index} isDragDisabled={!canManage}>
                        {(dragProvided, dragSnapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            {...dragProvided.dragHandleProps}
                            className={cn(dragSnapshot.isDragging && "opacity-80")}
                          >
                            <KanbanTaskCard task={task} onOpen={onOpenTask} fallbackLinkPath="/my-tasks" />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {columnTasks.length === 0 ? <EmptyState icon={<Inbox size={28} />} title="Nenhuma tarefa aqui" /> : null}
                    {provided.placeholder}
                  </KanbanColumn>
                )}
              </Droppable>
            );
          })}
        </div>
      </div>
    </DragDropContext>
  );
}

function statusLabel(status: TaskStatus): string {
  return columns.find((column) => column.status === status)?.label ?? status;
}
