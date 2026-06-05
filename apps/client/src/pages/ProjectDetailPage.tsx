import { useMemo, useState, useEffect, type ReactNode } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { ArrowDown, ArrowDownUp, ArrowUp, Edit3, ExternalLink, Filter, Group, Inbox, Plus, Settings2, X } from "lucide-react";
import { useParams, useSearchParams } from "react-router-dom";
import { Priority, TaskStatus, type DisciplineType, type ProjectCustomField, type Section, type Task, type User } from "shared";
import { ProjectWorkloadTimeline } from "../components/project/ProjectWorkloadTimeline";
import { ProjectForm } from "../components/project/ProjectForm";
import { EmptyState } from "../components/shared/EmptyState";
import { LoadingSpinner } from "../components/shared/LoadingSpinner";
import { DisciplineChip, PlatformChip, taskStatusLabels } from "../components/shared/Chip";
import {
  enumColor,
  PriorityOptionPill,
  priorityColors
} from "../components/shared/statusVisuals";
import { TaskCard } from "../components/task/TaskCard";
import { TaskCardSkeleton } from "../components/task/TaskCardSkeleton";
import { TaskDetail } from "../components/task/TaskDetail";
import { TaskStatusBadge } from "../components/task/TaskStatusBadge";
import { Button } from "../components/ui/button";
import { DatePicker } from "../components/ui/date-picker";
import { DecimalInput, parseDecimalInput } from "../components/ui/decimal-input";
import { Input } from "../components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { SearchableSelect } from "../components/ui/searchable-select";
import { useProject, useProjects } from "../hooks/useProjects";
import { useCreateTask, useUpdateTask, useUpdateTaskStatus } from "../hooks/useTasks";
import { useUsers } from "../hooks/useUsers";
import { cn, formatDateOnly } from "../lib/utils";
import { useUiStore } from "../store/uiStore";

type ProjectTab = "kanban" | "list" | "workload";
type SortKey = "title" | "stage" | "assignee" | "status";
type SortDirection = "asc" | "desc";
type CompletionFilter = "open" | "completed" | "all";
type TaskScope = "general" | "civil" | "electrical";

type TaskWithDiscipline = Task & {
  discipline: {
    id: string;
    name: string;
    projectId: string;
    type: DisciplineType;
  };
};

const columns: Array<{ status: TaskStatus; label: string }> = [
  { status: TaskStatus.TODO, label: "A FAZER" },
  { status: TaskStatus.ON_SCHEDULE, label: "NO CRONOGRAMA" },
  { status: TaskStatus.OVERDUE, label: "ATRASADO" },
  { status: TaskStatus.IN_PROGRESS, label: "EM ANDAMENTO" },
  { status: TaskStatus.AWAITING_REVIEW, label: "AGUARDANDO REVISAO" },
  { status: TaskStatus.IN_ANALYSIS, label: "EM ANALISE" },
  { status: TaskStatus.AWAITING_DEFINITION, label: "AGUARDANDO DEFINICAO" },
  { status: TaskStatus.FINISHED, label: "FINALIZADO" }
];

function tasksFromDisciplines(sections: Section[]): TaskWithDiscipline[] {
  return sections.flatMap((section) =>
    (section.tasks ?? []).map((task) => ({
      ...task,
      discipline: {
        id: section.id,
        name: section.name,
        projectId: section.projectId,
        type: section.type
      }
    }))
  );
}

function taskSortValue(task: TaskWithDiscipline, key: SortKey): string {
  if (key === "stage") {
    return task.stage ?? "";
  }

  if (key === "assignee") {
    return task.assignee?.name ?? "";
  }

  if (key === "status") {
    return task.status;
  }

  return String(task[key] ?? "");
}

export function ProjectDetailPage() {
  const { projectId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: project, isLoading, isFetching } = useProject(projectId);
  const updateTaskStatus = useUpdateTaskStatus(projectId ?? "");
  const updateTask = useUpdateTask(projectId ?? "");
  const [activeTab, setActiveTab] = useState<ProjectTab>("kanban");
  const [taskScope, setTaskScope] = useState<TaskScope>("general");
  const [statusFilter, setStatusFilter] = useState("all");
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>("open");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedTask, setSelectedTask] = useState<TaskWithDiscipline | null>(null);
  const [taskDetailOpenVersion, setTaskDetailOpenVersion] = useState(0);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const openTaskCreate = useUiStore((state) => state.openTaskCreate);

  const { data: users = [] } = useUsers();
  const { data: projects = [] } = useProjects();

  const disciplines = project?.sections ?? project?.disciplines ?? [];
  const allTasks = useMemo(() => tasksFromDisciplines(disciplines), [disciplines]);

  useEffect(() => {
    const taskId = searchParams.get("task");
    if (!taskId || allTasks.length === 0) {
      return;
    }
    const match = allTasks.find((t) => t.id === taskId);
    if (match) {
      setSelectedTask(match);
    }
  }, [searchParams, allTasks]);

  function closeTaskDetail() {
    setSelectedTask(null);
    const next = new URLSearchParams(searchParams);
    next.delete("task");
    setSearchParams(next, { replace: true });
  }

  function openTaskDetail(task: TaskWithDiscipline) {
    setTaskDetailOpenVersion((version) => version + 1);
    setSelectedTask(task);
    const next = new URLSearchParams(searchParams);
    next.set("task", task.id);
    setSearchParams(next, { replace: true });
  }

  function handleTimelineTaskUpdated(task: TaskWithDiscipline) {
    setSelectedTask((currentTask) =>
      currentTask?.id === task.id
        ? {
            ...currentTask,
            ...task,
            discipline: {
              ...currentTask.discipline,
              ...task.discipline,
              type: task.discipline.type ?? currentTask.discipline.type
            }
          }
        : currentTask
    );
  }

  const scopedDisciplineIds = useMemo(() => {
    if (taskScope === "general") {
      return new Set<string>();
    }

    return new Set(disciplines.filter((discipline) => sectionScope(discipline) === taskScope).map((discipline) => discipline.id));
  }, [disciplines, taskScope]);
  const builderSuggestions = useMemo(
    () =>
      Array.from(
        new Set(projects.map((item) => projectBuilder(item)).filter((builder): builder is string => Boolean(builder)))
      ).sort(),
    [projects]
  );

  const disciplineFilteredTasks = allTasks.filter(
    (task) => scopedDisciplineIds.size === 0 || scopedDisciplineIds.has(task.discipline.id)
  );
  const visibleDisciplines =
    scopedDisciplineIds.size === 0
      ? disciplines
      : disciplines.filter((discipline) => scopedDisciplineIds.has(discipline.id));

  const listTasks = disciplineFilteredTasks
    .filter((task) => {
      if (completionFilter === "all") {
        return true;
      }

      return completionFilter === "completed" ? task.completed : !task.completed;
    })
    .filter((task) => statusFilter === "all" || task.status === statusFilter)
    .filter((task) => assigneeFilter === "all" || (assigneeFilter === "none" ? !task.assigneeId : task.assigneeId === assigneeFilter))
    .filter((task) => priorityFilter === "all" || task.priority === priorityFilter)
    .sort((a, b) => {
      const valueA = taskSortValue(a, sortKey);
      const valueB = taskSortValue(b, sortKey);
      return sortDirection === "asc" ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
    });

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  }

  function handleDragEnd(result: DropResult) {
    if (!result.destination) {
      return;
    }

    const nextStatus = result.destination.droppableId as TaskStatus;

    if (nextStatus === result.source.droppableId || nextStatus === TaskStatus.OVERDUE) {
      return;
    }

    void updateTaskStatus.mutateAsync({ id: result.draggableId, status: nextStatus });
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!project || !projectId) {
    return <EmptyState title="Projeto não encontrado" />;
  }

  const taskFormDiscipline = visibleDisciplines[0] ?? disciplines[0] ?? null;
  const isTasksLoading = isFetching && !isLoading;

  return (
    <div className="grid gap-6">
      <section>
        <div>
          <p className="text-sm font-semibold uppercase text-brand-orange">{projectBuilder(project) ?? "Projeto Asana"}</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold text-text-primary">{project.name}</h1>
            {project.permalinkUrl ? (
              <a
                href={project.permalinkUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold text-text-secondary transition hover:border-brand-orange hover:text-brand-orange"
              >
                <ExternalLink size={16} />
                Asana
              </a>
            ) : null}
          </div>
          <p className="mt-2 max-w-3xl text-sm text-text-secondary">{project.description ?? "Sem descrição cadastrada."}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-text-secondary">
            {project.owner?.name ? <span className="rounded-md border border-border px-2 py-1">Responsável: {project.owner.name}</span> : null}
            {project.defaultView ? <span className="rounded-md border border-border px-2 py-1">View: {project.defaultView}</span> : null}
            {project.asanaGid ? <span className="rounded-md border border-border px-2 py-1">GID: {project.asanaGid}</span> : null}
          </div>
        </div>
      </section>

      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-wrap gap-2">
          <Button variant={activeTab === "kanban" ? "primary" : "secondary"} onClick={() => setActiveTab("kanban")}>
            Kanban
          </Button>
          <Button variant={activeTab === "list" ? "primary" : "secondary"} onClick={() => setActiveTab("list")}>
            Lista
          </Button>
          <Button variant={activeTab === "workload" ? "primary" : "secondary"} onClick={() => setActiveTab("workload")}>
            Carga de Trabalho
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeTab === "list" ? (
            <ListControls
              tasks={listTasks}
              users={users}
              statusFilter={statusFilter}
              completionFilter={completionFilter}
              assigneeFilter={assigneeFilter}
              priorityFilter={priorityFilter}
              sortKey={sortKey}
              sortDirection={sortDirection}
              onStatusFilterChange={setStatusFilter}
              onCompletionFilterChange={setCompletionFilter}
              onAssigneeFilterChange={setAssigneeFilter}
              onPriorityFilterChange={setPriorityFilter}
              onSort={handleSort}
            />
          ) : null}
          <Button variant="secondary" onClick={() => setShowProjectForm((current) => !current)}>
            <Edit3 size={16} />
            Editar projeto
          </Button>
          <Button
            onClick={() => openTaskCreate({ projectId })}
          >
            <Plus size={16} />
            Criar tarefa
          </Button>
        </div>
      </div>

      {showProjectForm ? (
        <ProjectModal title="Editar projeto" onClose={() => setShowProjectForm(false)}>
          <ProjectForm
            project={project}
            builderSuggestions={builderSuggestions}
            onCancel={() => setShowProjectForm(false)}
            onSaved={() => setShowProjectForm(false)}
          />
        </ProjectModal>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <ScopeTab active={taskScope === "general"} label="Geral" onClick={() => setTaskScope("general")} />
        <ScopeTab active={taskScope === "civil"} label="Civil" onClick={() => setTaskScope("civil")} />
        <ScopeTab active={taskScope === "electrical"} label="Elétrica" onClick={() => setTaskScope("electrical")} />
      </div>

      <div className="min-w-0">
        {activeTab === "kanban" ? (
          <KanbanView
            projectId={projectId}
            disciplineId={taskFormDiscipline?.id ?? null}
            tasks={disciplineFilteredTasks}
            isLoading={isTasksLoading}
            onDragEnd={handleDragEnd}
            onOpenTask={openTaskDetail}
          />
        ) : null}
        {activeTab === "list" ? (
          <ListView
            disciplines={visibleDisciplines}
            tasks={listTasks}
            users={users}
            customFieldDefinitions={project.taskCustomFields ?? []}
            isLoading={isTasksLoading}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSort={handleSort}
            onTaskAssigneeChange={(taskId, assigneeId) =>
              void updateTask.mutateAsync({ id: taskId, payload: { assigneeId } })
            }
            onTaskCustomFieldChange={(taskId, fieldId, mikaKey, value) =>
              void updateTask.mutateAsync({ id: taskId, payload: { customFieldValues: [{ id: fieldId, mikaKey, value }] } })
            }
            onOpenTask={openTaskDetail}
          />
        ) : null}
        {activeTab === "workload" ? (
          <ProjectWorkloadTimeline
            mode="project"
            projectId={projectId}
            users={users}
            disciplineIdFilter={scopedDisciplineIds}
            isActive={activeTab === "workload"}
            onOpenTask={openTaskDetail}
            onTaskUpdated={handleTimelineTaskUpdated}
            updateTask={updateTask}
          />
        ) : null}
      </div>
      <TaskDetail task={selectedTask} onClose={closeTaskDetail} openVersion={taskDetailOpenVersion} />
    </div>
  );
}

function KanbanView({
  projectId,
  disciplineId,
  tasks,
  isLoading,
  onDragEnd,
  onOpenTask
}: {
  projectId: string;
  disciplineId: string | null;
  tasks: TaskWithDiscipline[];
  isLoading: boolean;
  onDragEnd: (result: DropResult) => void;
  onOpenTask: (task: TaskWithDiscipline) => void;
}) {
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="overflow-x-auto pb-3">
        <div className="flex min-w-max gap-4">
          {columns.map((column) => {
            const columnTasks = tasks.filter((task) => task.status === column.status);
            return (
              <KanbanColumn
                key={column.status}
                projectId={projectId}
                disciplineId={disciplineId}
                status={column.status}
                label={column.label}
                tasks={columnTasks}
                isLoading={isLoading}
                onOpenTask={onOpenTask}
              />
            );
          })}
        </div>
      </div>
    </DragDropContext>
  );
}

function ScopeTab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <Button variant={active ? "primary" : "secondary"} onClick={onClick}>
      {label}
    </Button>
  );
}

function KanbanColumn({
  projectId,
  disciplineId,
  status,
  label,
  tasks,
  isLoading,
  onOpenTask
}: {
  projectId: string;
  disciplineId: string | null;
  status: TaskStatus;
  label: string;
  tasks: TaskWithDiscipline[];
  isLoading: boolean;
  onOpenTask: (task: TaskWithDiscipline) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState("");
  const createTask = useCreateTask(projectId, disciplineId ?? "");
  const canCreateInColumn = status !== TaskStatus.OVERDUE;

  async function submitTask() {
    const trimmedTitle = title.trim();

    if (!disciplineId || !canCreateInColumn || trimmedTitle.length < 2) {
      return;
    }

    await createTask.mutateAsync({ title: trimmedTitle, status });
    setTitle("");
    setIsAdding(false);
  }

  return (
    <Droppable droppableId={status}>
      {(provided, snapshot) => (
        <section
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={cn(
            "flex min-h-[520px] w-72 flex-none flex-col rounded-md border border-border bg-surface p-3 transition",
            snapshot.isDraggingOver ? "border-brand-orange" : ""
          )}
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-text-primary">{label}</h2>
            <span className="rounded-md bg-surface-card px-2 py-1 text-xs text-text-secondary">{tasks.length}</span>
          </div>
          <div className="grid flex-1 content-start gap-3">
            {isLoading ? (
              <>
                <TaskCardSkeleton />
                <TaskCardSkeleton />
                <TaskCardSkeleton />
              </>
            ) : (
              <>
                {tasks.map((task, index) => (
                  <Draggable draggableId={task.id} index={index} key={task.id}>
                    {(dragProvided, dragSnapshot) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        {...dragProvided.dragHandleProps}
                        className={cn(dragSnapshot.isDragging ? "opacity-80" : "")}
                      >
                        <TaskCard
                          task={task}
                          disciplineName={task.discipline.name}
                          onOpen={onOpenTask}
                        />
                      </div>
                    )}
                  </Draggable>
                ))}
                {tasks.length === 0 ? <EmptyState icon={<Inbox size={28} />} title="Nenhuma tarefa aqui" /> : null}
              </>
            )}
            {provided.placeholder}
          </div>
          <div className="mt-3 border-t border-border pt-3">
            {isAdding ? (
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setTitle("");
                    setIsAdding(false);
                  }

                  if (event.key === "Enter") {
                    event.preventDefault();
                    void submitTask();
                  }
                }}
                placeholder="Titulo da tarefa"
                disabled={!disciplineId || !canCreateInColumn || createTask.isPending}
                autoFocus
              />
            ) : (
              <Button
                variant="ghost"
                className="w-full justify-start px-2"
                onClick={() => setIsAdding(true)}
                disabled={!disciplineId || !canCreateInColumn}
              >
                <Plus size={16} />
                Adicionar tarefa
              </Button>
            )}
          </div>
        </section>
      )}
    </Droppable>
  );
}

function ListControls({
  tasks,
  users,
  statusFilter,
  completionFilter,
  assigneeFilter,
  priorityFilter,
  sortKey,
  sortDirection,
  onStatusFilterChange,
  onCompletionFilterChange,
  onAssigneeFilterChange,
  onPriorityFilterChange,
  onSort
}: {
  tasks: TaskWithDiscipline[];
  users: User[];
  statusFilter: string;
  completionFilter: CompletionFilter;
  assigneeFilter: string;
  priorityFilter: string;
  sortKey: SortKey;
  sortDirection: SortDirection;
  onStatusFilterChange: (value: string) => void;
  onCompletionFilterChange: (value: CompletionFilter) => void;
  onAssigneeFilterChange: (value: string) => void;
  onPriorityFilterChange: (value: string) => void;
  onSort: (key: SortKey) => void;
}) {
  const sortIndicator = (key: SortKey) => (sortKey === key ? <SortIcon direction={sortDirection} /> : null);
  const statusOptions = [
    { value: "all", label: "Todos os status" },
    ...Object.values(TaskStatus).map((status) => ({
      value: status,
      label: taskStatusLabels[status],
      render: <TaskStatusBadge status={status} />
    }))
  ];
  const assigneeOptions = [
    { value: "all", label: "Todos responsáveis" },
    { value: "none", label: "Sem responsável" },
    ...users.map((user) => ({ value: user.id, label: user.name, description: user.email, avatarUrl: user.avatarUrl }))
  ];
  const priorityOptions = [
    { value: "all", label: "Todas prioridades" },
    ...Object.values(Priority).map((priority) => ({
      value: priority,
      label: priority,
      color: priorityColors[priority],
      render: <PriorityOptionPill priority={priority} />
    }))
  ];
  const completionOptions = [
    { value: "open", label: "Não concluídas" },
    { value: "completed", label: "Concluídas" },
    { value: "all", label: "Todas" }
  ];

  return (
    <div className="flex flex-wrap gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="secondary" className="h-10">
            <Filter size={15} />
            Filtrar
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="grid w-80 gap-3">
          <SearchableSelect
            value={completionFilter}
            options={completionOptions}
            searchPlaceholder="Buscar conclusão..."
            onValueChange={(value) => onCompletionFilterChange(value as CompletionFilter)}
          />
          <SearchableSelect
            value={statusFilter}
            options={statusOptions}
            searchPlaceholder="Buscar status..."
            onValueChange={onStatusFilterChange}
          />
          <SearchableSelect
            value={assigneeFilter}
            options={assigneeOptions}
            searchPlaceholder="Buscar responsável..."
            contentClassName="w-[min(420px,calc(100vw-32px))]"
            onValueChange={onAssigneeFilterChange}
          />
          <SearchableSelect
            value={priorityFilter}
            options={priorityOptions}
            searchPlaceholder="Buscar prioridade..."
            onValueChange={onPriorityFilterChange}
          />
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="secondary" className="h-10">
            <ArrowDownUp size={15} />
            Ordenar
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="grid w-72 gap-1">
          {(["title", "stage", "assignee", "status"] as SortKey[]).map((key) => (
            <Button key={key} variant="ghost" className="h-9 justify-between px-2" onClick={() => onSort(key)}>
              <span>Ordenar por {sortLabel(key)}</span>
              {sortIndicator(key)}
            </Button>
          ))}
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="secondary" className="h-10">
            <Group size={15} />
            Agrupar
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 text-sm text-text-secondary">
          Agrupado por Geral, Civil e Elétrica.
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="secondary" className="h-10">
            <Settings2 size={15} />
            Opções
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 text-sm text-text-secondary">
          A lista mostra campos customizados importados do Asana.
        </PopoverContent>
      </Popover>
    </div>
  );
}

function ListView({
  disciplines,
  tasks,
  users,
  isLoading,
  sortKey,
  sortDirection,
  onSort,
  onOpenTask
}: {
  disciplines: Section[];
  tasks: TaskWithDiscipline[];
  users: User[];
  customFieldDefinitions: ProjectCustomField[];
  isLoading: boolean;
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
  onTaskAssigneeChange: (taskId: string, assigneeId: string | null) => void;
  onTaskCustomFieldChange: (taskId: string, fieldId: string, mikaKey: string | undefined, value: string | number | null) => void;
  onOpenTask: (task: TaskWithDiscipline) => void;
}) {
  const groupedTasks = groupTasksByScope(tasks);
  const userById = new Map(users.map((user) => [user.id, user]));

  return (
    <div className="grid gap-4">
      <div className="flex justify-end text-sm font-semibold text-text-secondary">{tasks.length} tarefas</div>
      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-3">
          <TaskCardSkeleton />
          <TaskCardSkeleton />
          <TaskCardSkeleton />
        </div>
      ) : null}
      {!isLoading ? (
        <div className="w-full overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[1100px] table-fixed border-collapse bg-[--bg-2] text-sm" data-testid="project-list-table">
            <colgroup>
              <col className="w-[200px]" />
              <col className="w-[120px]" />
              <col className="w-[140px]" />
              <col className="w-[150px]" />
              <col className="w-[90px]" />
              <col className="w-[100px]" />
              <col className="w-[120px]" />
              <col className="w-[90px]" />
              <col className="w-[90px]" />
              <col className="w-[80px]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-[--bg-1]">
              <tr className="border-b border-[--color-border]">
                <SortableHeader label="Tarefa" sortKey="title" sortDirection={sortDirection} active={sortKey === "title"} onSort={onSort} />
                <StaticHeader label="Seção" />
                <SortableHeader label="Responsável" sortKey="assignee" sortDirection={sortDirection} active={sortKey === "assignee"} onSort={onSort} />
                <SortableHeader label="Status" sortKey="status" sortDirection={sortDirection} active={sortKey === "status"} onSort={onSort} />
                <StaticHeader label="Plataforma" align="center" />
                <StaticHeader label="Disciplina" align="center" />
                <StaticHeader label="Prazo Máximo" />
                <StaticHeader label="Dias Estimados" align="right" />
                <StaticHeader label="Dias Conclusão" align="right" />
                <SortableHeader label="Etapa" sortKey="stage" sortDirection={sortDirection} active={sortKey === "stage"} onSort={onSort} />
              </tr>
            </thead>
            <tbody>
              {groupedTasks.map((group) => (
                <GroupedScopeRows
                  key={group.scope}
                  label={group.label}
                  tasks={group.tasks}
                  userById={userById}
                  onOpenTask={onOpenTask}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {disciplines.length === 0 ? <EmptyState title="Nenhuma disciplina selecionada no projeto" /> : null}
    </div>
  );
}

function GroupedScopeRows({
  label,
  tasks,
  userById,
  onOpenTask
}: {
  label: string;
  tasks: TaskWithDiscipline[];
  userById: Map<string, User>;
  onOpenTask: (task: TaskWithDiscipline) => void;
}) {
  const columnSpan = 10;

  return (
    <>
      <tr className="border-b border-[--color-border-subtle] bg-[--bg-1]">
        <td colSpan={columnSpan} className="px-3 py-2 text-[12px] font-semibold uppercase tracking-widest text-[--color-text-muted]">
          <span>{label}</span>
          <span className="ml-2 rounded bg-[--bg-4] px-1.5 py-0.5 text-[11px] font-medium normal-case tracking-normal text-[--color-text-secondary]">{tasks.length}</span>
        </td>
      </tr>
      {tasks.length === 0 ? (
        <tr className="border-b border-[--color-border-subtle]">
          <td colSpan={columnSpan} className="px-3 py-2 text-[13px] text-[--color-text-muted]">
            Nenhuma tarefa nesta seção.
          </td>
        </tr>
      ) : (
        tasks.map((task) => {
          const assignee = task.assigneeId ? userById.get(task.assigneeId) ?? task.assignee : task.assignee;
          return (
            <tr
              key={task.id}
              className={cn(
                "border-b border-[--color-border-subtle] transition-colors hover:bg-[--bg-3]",
                task.completed ? "opacity-70" : ""
              )}
            >
              <td className="px-3 py-2 text-[13px] text-[--color-text-primary]">
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
              </td>
              <td className="px-3 py-2 text-[13px] text-[--color-text-primary]">
                <TruncatedValue value={task.discipline.name} />
              </td>
              <td className="px-3 py-2 text-[13px] text-[--color-text-primary]">
                {assignee ? (
                  <div className="flex min-w-0 items-center">
                    {assignee.avatarUrl ? <img className="mr-1.5 h-5 w-5 rounded-full object-cover" src={assignee.avatarUrl} alt="" /> : <span className="mr-1.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[--bg-4] text-[10px] text-[--color-text-secondary]">{assignee.name.slice(0, 1)}</span>}
                    <span className="truncate">{assignee.name}</span>
                  </div>
                ) : (
                  <EmptyCell />
                )}
              </td>
              <td className="px-3 py-2 text-[13px] text-[--color-text-primary]"><TaskStatusBadge status={task.status} /></td>
              <td className="px-3 py-2 text-center">{task.platform ? <PlatformChip platform={task.platform} /> : <EmptyCell />}</td>
              <td className="px-3 py-2 text-center">{task.taskDiscipline ? <DisciplineChip discipline={task.taskDiscipline} /> : <EmptyCell />}</td>
              <td className="px-3 py-2 text-[13px] text-[--color-text-primary]"><DateCell value={task.maxDeadline} /></td>
              <td className="px-3 py-2 text-right font-mono text-[12px] text-[--color-text-primary]"><NumberCell value={task.estimatedTime} /></td>
              <td className="px-3 py-2 text-right font-mono text-[12px] text-[--color-text-primary]"><NumberCell value={task.conclusionDays} /></td>
              <td className="px-3 py-2 text-[13px] text-[--color-text-primary]"><TruncatedValue value={task.stage} /></td>
            </tr>
          );
        })
      )}
    </>
  );
}
function ListStageField({
  task,
  definition,
  onSave
}: {
  task: TaskWithDiscipline;
  definition: ProjectCustomField;
  onSave: (field: NonNullable<Task["customFieldValues"]>[number], value: string | number | null) => void;
}) {
  const field = findTaskCustomField(task, definition);

  if (!field) {
    return <span className="block truncate" title={task.discipline.name}>{task.discipline.name || "-"}</span>;
  }

  return <InlineField field={field} onSave={(value) => onSave(field, value)} />;
}

function SortableHeader({
  label,
  sortKey,
  active,
  sortDirection,
  onSort,
  className
}: {
  label: string;
  sortKey: SortKey;
  active: boolean;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  return (
    <th className={cn("px-3 py-2 text-left text-[11px] font-medium uppercase tracking-widest", active ? "text-[--color-text-primary]" : "text-[--color-text-muted]", className)}>
      <button type="button" className="group inline-flex max-w-full items-center gap-1.5 hover:text-[--color-text-primary]" onClick={() => onSort(sortKey)}>
        <span>{label}</span>
        {active ? <SortIcon direction={sortDirection} /> : <ArrowDownUp size={12} className="opacity-0 transition-opacity group-hover:opacity-100" />}
      </button>
    </th>
  );
}

function SortIcon({ direction }: { direction: SortDirection }) {
  return direction === "asc" ? <ArrowUp size={12} className="text-brand-orange" /> : <ArrowDown size={12} className="text-brand-orange" />;
}

function StaticHeader({ label, align = "left" }: { label: string; align?: "left" | "center" | "right" }) {
  return (
    <th
      className={cn(
        "px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-[--color-text-muted]",
        align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left"
      )}
    >
      {label}
    </th>
  );
}

function EmptyCell() {
  return <span className="text-[--color-text-muted]">—</span>;
}

function TruncatedValue({ value }: { value: string | null | undefined }) {
  return value ? (
    <span className="block truncate" title={value}>
      {value}
    </span>
  ) : (
    <EmptyCell />
  );
}

function DateCell({ value }: { value: string | null | undefined }) {
  return value ? <span>{formatDateOnly(value, "dd/MM/yyyy")}</span> : <EmptyCell />;
}

function NumberCell({ value }: { value: number | null | undefined }) {
  if (value == null) {
    return <EmptyCell />;
  }

  return <span>{Number.isInteger(value) ? value : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}</span>;
}

function sortLabel(key: SortKey): string {
  const labels: Record<SortKey, string> = {
    title: "Tarefa",
    stage: "Etapa",
    assignee: "Responsável",
    status: "Status"
  };

  return labels[key];
}

function visibleListCustomFields(tasks: TaskWithDiscipline[], definitions: ProjectCustomField[]) {
  const fields = new Map<string, ProjectCustomField>();

  for (const field of definitions) {
    if (field.mikaListVisible === false) {
      continue;
    }

    fields.set(field.mikaKey ?? field.id, field);
  }

  for (const task of tasks) {
    for (const field of task.customFieldValues ?? []) {
      if (field.mikaListVisible === false) {
        continue;
      }

      const key = field.mikaKey ?? normalizeFieldName(field.customFieldName ?? "Campo");
      if (!fields.has(key)) {
        fields.set(key, {
          id: field.customFieldId ?? field.id,
          asanaGid: field.customFieldGid ?? field.id,
          isImportant: true,
          name: field.mikaLabel ?? field.customFieldName ?? "Campo",
          description: null,
          type: field.type ?? "text",
          mikaKey: field.mikaKey,
          mikaLabel: field.mikaLabel,
          mikaSortOrder: field.mikaSortOrder,
          mikaTaskField: true,
          mikaListVisible: field.mikaListVisible,
          mikaDetailVisible: field.mikaDetailVisible,
          enumOptions: (field.enumOptions ?? []).map((option) => ({
            id: option.id,
            asanaGid: option.id,
            name: option.name,
            color: option.color,
            enabled: true
          }))
        });
      }
    }
  }

  return Array.from(fields.values()).sort((a, b) => (a.mikaSortOrder ?? 9999) - (b.mikaSortOrder ?? 9999));
}

function findTaskCustomField(task: TaskWithDiscipline, definition: ProjectCustomField) {
  return task.customFieldValues?.find((field) =>
    definition.mikaKey
      ? field.mikaKey === definition.mikaKey
      : normalizeFieldName(field.customFieldName ?? "Campo") === normalizeFieldName(definition.name)
  );
}

function uniqueCustomStatusOptions(tasks: TaskWithDiscipline[]) {
  return Array.from(
    new Set(tasks.map((task) => customStatusValue(task)).filter((value): value is string => Boolean(value)))
  ).sort((a, b) => a.localeCompare(b));
}

function customStatusValue(task: TaskWithDiscipline) {
  const field = task.customFieldValues?.find((item) => isCustomStatusField(item.customFieldName ?? ""));
  return field?.displayValue ?? field?.enumOptionName ?? null;
}

function stageValue(task: TaskWithDiscipline) {
  const field = task.customFieldValues?.find((item) => isStageTaskField(item));
  return field?.displayValue ?? field?.enumOptionName ?? null;
}

function isCustomStatusField(name: string) {
  const normalized = normalizeFieldName(name);
  return normalized === "status" || normalized === "status de conclusao" || normalized === "situacao";
}

function isStageCustomField(field: Pick<ProjectCustomField, "mikaKey" | "mikaLabel" | "name">) {
  return fieldIdentityMatches(field.mikaKey, field.mikaLabel, field.name, ["etapa", "stage"]);
}

function isDisciplineCustomField(field: Pick<ProjectCustomField, "mikaKey" | "mikaLabel" | "name">) {
  return fieldIdentityMatches(field.mikaKey, field.mikaLabel, field.name, ["disciplina", "discipline"]);
}

function isStageTaskField(field: NonNullable<Task["customFieldValues"]>[number]) {
  return fieldIdentityMatches(field.mikaKey, field.mikaLabel, field.customFieldName, ["etapa", "stage"]);
}

function fieldIdentityMatches(
  mikaKey: string | null | undefined,
  mikaLabel: string | null | undefined,
  name: string | null | undefined,
  normalizedMatches: string[]
) {
  return [mikaKey, mikaLabel, name].some((value) => Boolean(value && normalizedMatches.includes(normalizeFieldName(value))));
}

function normalizeFieldName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

function groupTasksByScope(tasks: TaskWithDiscipline[]) {
  const groups: Array<{ scope: TaskScope; label: string; color: string; tasks: TaskWithDiscipline[] }> = [
    { scope: "general", label: "Geral", color: "var(--color-text-muted)", tasks: [] },
    { scope: "civil", label: "Civil", color: "var(--disc-hid-text)", tasks: [] },
    { scope: "electrical", label: "Elétrica", color: "var(--disc-ele-text)", tasks: [] }
  ];

  for (const task of tasks) {
    const scope = sectionScope(task.discipline);
    const group = groups.find((item) => item.scope === scope) ?? groups[0];
    group?.tasks.push(task);
  }

  return groups;
}

function InlineField({
  field,
  onSave
}: {
  field: NonNullable<Task["customFieldValues"]>[number];
  onSave: (value: string | number | null) => void;
}) {
  const initialValue = String(field.displayValue ?? field.enumOptionName ?? field.numberValue ?? "");
  const [draft, setDraft] = useState(initialValue);
  const [editing, setEditing] = useState(false);
  const type = (field.type ?? "").toLowerCase();
  const enumOptions = field.enumOptions?.filter((option) => option.name) ?? [];

  useEffect(() => {
    setDraft(initialValue);
  }, [initialValue]);

  if (enumOptions.length > 0) {
    return (
      <SearchableSelect
        value={draft || "none"}
        options={[
          { value: "none", label: "-" },
          ...enumOptions.map((option) => ({
            value: option.name,
            label: option.name,
            color: enumColor(option.name, option.color)
          }))
        ]}
        triggerClassName="h-8 min-w-40"
        searchPlaceholder={`Buscar ${field.mikaLabel ?? field.customFieldName ?? "campo"}...`}
        onValueChange={(value) => {
          const nextValue = value === "none" ? "" : value;
          setDraft(nextValue);
          onSave(nextValue || null);
        }}
      />
    );
  }

  if (type === "number" || type === "integer") {
    return (
      <DecimalInput
        value={draft}
        onValueChange={setDraft}
        onBlur={() => {
          const parsed = parseDecimalInput(draft);
          onSave(parsed === null || Number.isNaN(parsed) ? null : parsed);
        }}
        className="h-8 min-w-32 border-border bg-brand-black/60"
      />
    );
  }

  if (type === "date") {
    return (
      <DatePicker
        value={/^\d{4}-\d{2}-\d{2}$/.test(draft) ? draft : ""}
        onValueChange={(value) => {
          const nextValue = value ?? "";
          setDraft(nextValue);
          onSave(nextValue || null);
        }}
        className="h-8 min-w-36 border-border bg-brand-black/60"
      />
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="min-h-8 min-w-36 rounded-md px-2 text-left text-text-secondary transition hover:bg-surface-hover hover:text-text-primary"
      >
        {draft || "-"}
      </button>
    );
  }

  return (
    <Input
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        setEditing(false);
        onSave(draft.trim() || null);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }

        if (event.key === "Escape") {
          setDraft(initialValue);
          setEditing(false);
        }
      }}
      className="h-8 min-w-36 border-border bg-brand-black/60"
      autoFocus
    />
  );
}

function ProjectModal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-black/80 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <section
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-md border border-border bg-surface p-5 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-text-primary">{title}</h2>
          <Button variant="ghost" className="h-9 w-9 px-0" onClick={onClose} title="Fechar">
            <X size={18} />
          </Button>
        </div>
        {children}
      </section>
    </div>
  );
}

function projectBuilder(project: { builder?: string | null; client?: string | null }): string | null {
  return project.builder ?? project.client ?? null;
}

function sectionScope(section: Pick<Section, "name" | "type">): TaskScope {
  const normalizedName = section.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const electricalTypes = new Set<DisciplineType>([
    "ELECTRICAL" as DisciplineType,
    "SPDA" as DisciplineType,
    "TELECOM" as DisciplineType,
    "AUTOMATION" as DisciplineType
  ]);
  const civilTypes = new Set<DisciplineType>([
    "HYDRAULIC" as DisciplineType,
    "SANITARY" as DisciplineType,
    "FIRE_PROTECTION" as DisciplineType,
    "SPRINKLER" as DisciplineType,
    "GAS" as DisciplineType,
    "HVAC" as DisciplineType
  ]);

  if (
    electricalTypes.has(section.type) ||
    ["ele", "eletrico", "spda", "tel", "telecom", "aut"].some((token) => normalizedName.includes(token))
  ) {
    return "electrical";
  }

  if (
    civilTypes.has(section.type) ||
    ["civil", "hid", "ppci", "preventivo", "sanitario", "arquitetonico", "estudo preliminar"].some((token) =>
      normalizedName.includes(token)
    )
  ) {
    return "civil";
  }

  return "general";
}
