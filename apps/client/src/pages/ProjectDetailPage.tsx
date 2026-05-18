import { useMemo, useState, useEffect, type ReactNode } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { ArrowDownUp, Edit3, ExternalLink, Filter, Group, Inbox, Plus, Settings2, X } from "lucide-react";
import { useParams, useSearchParams } from "react-router-dom";
import { Priority, TaskStatus, type DisciplineType, type Section, type Task, type User } from "shared";
import { ProjectWorkloadTimeline } from "../components/project/ProjectWorkloadTimeline";
import { ProjectForm } from "../components/project/ProjectForm";
import { EmptyState } from "../components/shared/EmptyState";
import { LoadingSpinner } from "../components/shared/LoadingSpinner";
import { PriorityBadge } from "../components/shared/PriorityBadge";
import {
  enumColor,
  PriorityOptionPill,
  priorityColors
} from "../components/shared/statusVisuals";
import { TaskCard } from "../components/task/TaskCard";
import { TaskCompletionButton } from "../components/task/TaskCompletionButton";
import { TaskCardSkeleton } from "../components/task/TaskCardSkeleton";
import { TaskDetail } from "../components/task/TaskDetail";
import { Button } from "../components/ui/button";
import { DatePicker } from "../components/ui/date-picker";
import { DecimalInput, parseDecimalInput } from "../components/ui/decimal-input";
import { Input } from "../components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { SearchableSelect } from "../components/ui/searchable-select";
import { useProject, useProjects } from "../hooks/useProjects";
import { useCreateTask, useUpdateTask, useUpdateTaskCompletion, useUpdateTaskStatus } from "../hooks/useTasks";
import { useUsers } from "../hooks/useUsers";
import { cn, formatDateOnly } from "../lib/utils";
import { useUiStore } from "../store/uiStore";

type ProjectTab = "kanban" | "list" | "workload";
type SortKey = "title" | "discipline" | "assignee" | "priority" | "status" | "dueDate";
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
  { status: TaskStatus.BACKLOG, label: "BACKLOG" },
  { status: TaskStatus.TODO, label: "A FAZER" },
  { status: TaskStatus.IN_PROGRESS, label: "EM ANDAMENTO" },
  { status: TaskStatus.IN_REVIEW, label: "EM REVISAO" },
  { status: TaskStatus.DONE, label: "CONCLUIDO" }
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
  if (key === "discipline") {
    return task.discipline.name;
  }

  if (key === "assignee") {
    return task.assignee?.name ?? "";
  }

  if (key === "status") {
    return customStatusValue(task) ?? "";
  }

  return String(task[key] ?? "");
}

export function ProjectDetailPage() {
  const { projectId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: project, isLoading, isFetching } = useProject(projectId);
  const updateTaskStatus = useUpdateTaskStatus(projectId ?? "");
  const updateTask = useUpdateTask(projectId ?? "");
  const updateTaskCompletion = useUpdateTaskCompletion(projectId ?? "");
  const [activeTab, setActiveTab] = useState<ProjectTab>("kanban");
  const [taskScope, setTaskScope] = useState<TaskScope>("general");
  const [statusFilter, setStatusFilter] = useState("all");
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>("open");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("dueDate");
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
    .filter((task) => statusFilter === "all" || customStatusValue(task) === statusFilter)
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

    if (nextStatus === result.source.droppableId) {
      return;
    }

    void updateTaskStatus.mutateAsync({ id: result.draggableId, status: nextStatus });
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!project || !projectId) {
    return <EmptyState title="Projeto nao encontrado" />;
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
          <p className="mt-2 max-w-3xl text-sm text-text-secondary">{project.description ?? "Sem descricao cadastrada."}</p>
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
          <Button variant="secondary" onClick={() => setShowProjectForm((current) => !current)}>
            <Edit3 size={16} />
            Editar projeto
          </Button>
          <Button
            onClick={() => openTaskCreate({ projectId, sectionId: taskFormDiscipline?.id })}
            disabled={!taskFormDiscipline}
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
            completionBusy={updateTaskCompletion.isPending}
            onDragEnd={handleDragEnd}
            onOpenTask={openTaskDetail}
            onCompletionChange={(task) => void updateTaskCompletion.mutateAsync({ id: task.id, completed: !task.completed })}
          />
        ) : null}
        {activeTab === "list" ? (
          <ListView
            disciplines={visibleDisciplines}
            tasks={listTasks}
            users={users}
            isLoading={isTasksLoading}
            completionBusy={updateTaskCompletion.isPending}
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
            onTaskCompletionChange={(task) => void updateTaskCompletion.mutateAsync({ id: task.id, completed: !task.completed })}
            onTaskAssigneeChange={(taskId, assigneeId) =>
              void updateTask.mutateAsync({ id: taskId, payload: { assigneeId } })
            }
            onTaskCustomFieldChange={(taskId, fieldId, value) =>
              void updateTask.mutateAsync({ id: taskId, payload: { customFieldValues: [{ id: fieldId, value }] } })
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
  completionBusy,
  onDragEnd,
  onOpenTask,
  onCompletionChange
}: {
  projectId: string;
  disciplineId: string | null;
  tasks: TaskWithDiscipline[];
  isLoading: boolean;
  completionBusy?: boolean;
  onDragEnd: (result: DropResult) => void;
  onOpenTask: (task: TaskWithDiscipline) => void;
  onCompletionChange: (task: TaskWithDiscipline) => void;
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
                completionBusy={completionBusy}
                onOpenTask={onOpenTask}
                onCompletionChange={onCompletionChange}
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
  completionBusy,
  onOpenTask,
  onCompletionChange
}: {
  projectId: string;
  disciplineId: string | null;
  status: TaskStatus;
  label: string;
  tasks: TaskWithDiscipline[];
  isLoading: boolean;
  completionBusy?: boolean;
  onOpenTask: (task: TaskWithDiscipline) => void;
  onCompletionChange: (task: TaskWithDiscipline) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState("");
  const createTask = useCreateTask(projectId, disciplineId ?? "");

  async function submitTask() {
    const trimmedTitle = title.trim();

    if (!disciplineId || trimmedTitle.length < 2) {
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
                          onToggleCompletion={onCompletionChange}
                          completionBusy={completionBusy}
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
                disabled={!disciplineId || createTask.isPending}
                autoFocus
              />
            ) : (
              <Button
                variant="ghost"
                className="w-full justify-start px-2"
                onClick={() => setIsAdding(true)}
                disabled={!disciplineId}
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

function ListView({
  disciplines,
  tasks,
  users,
  isLoading,
  completionBusy,
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
  onSort,
  onTaskCompletionChange,
  onTaskAssigneeChange,
  onTaskCustomFieldChange,
  onOpenTask
}: {
  disciplines: Section[];
  tasks: TaskWithDiscipline[];
  users: User[];
  isLoading: boolean;
  completionBusy?: boolean;
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
  onTaskCompletionChange: (task: TaskWithDiscipline) => void;
  onTaskAssigneeChange: (taskId: string, assigneeId: string | null) => void;
  onTaskCustomFieldChange: (taskId: string, fieldId: string, value: string | number | null) => void;
  onOpenTask: (task: TaskWithDiscipline) => void;
}) {
  const sortIndicator = (key: SortKey) => (sortKey === key ? (sortDirection === "asc" ? " ?" : " ?") : "");
  const customFieldNames = uniqueCustomFieldNames(tasks);
  const groupedTasks = groupTasksByScope(tasks);
  const customStatusOptions = [
    { value: "all", label: "Todos os status" },
    ...uniqueCustomStatusOptions(tasks).map((status) => ({ value: status, label: status, color: enumColor(status) }))
  ];
  const assigneeOptions = [
    { value: "all", label: "Todos responsaveis" },
    { value: "none", label: "Sem responsavel" },
    ...users.map((user) => ({ value: user.id, label: user.name, description: user.email }))
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
    { value: "open", label: "Nao concluidas" },
    { value: "completed", label: "Concluidas" },
    { value: "all", label: "Todas" }
  ];

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="secondary" className="h-8">
                <Filter size={15} />
                Filtrar
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="grid w-80 gap-3">
              <SearchableSelect
                value={completionFilter}
                options={completionOptions}
                searchPlaceholder="Buscar conclusao..."
                onValueChange={(value) => onCompletionFilterChange(value as CompletionFilter)}
              />
              <SearchableSelect
                value={statusFilter}
                options={customStatusOptions}
                searchPlaceholder="Buscar status Asana..."
                emptyText="Nenhum status customizado encontrado"
                onValueChange={onStatusFilterChange}
              />
              <SearchableSelect
                value={assigneeFilter}
                options={assigneeOptions}
                searchPlaceholder="Buscar responsavel..."
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
              <Button variant="secondary" className="h-8">
                <ArrowDownUp size={15} />
                Ordenar
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="grid w-64 gap-2">
              {(["dueDate", "title", "discipline", "assignee", "priority", "status"] as SortKey[]).map((key) => (
                <Button key={key} variant="ghost" className="h-8 justify-start px-2" onClick={() => onSort(key)}>
                  {sortLabel(key)}
                  {sortIndicator(key)}
                </Button>
              ))}
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="secondary" className="h-8">
                <Group size={15} />
                Agrupar
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 text-sm text-text-secondary">
              Agrupado por Geral, Civil e Eletrica.
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="secondary" className="h-8">
                <Settings2 size={15} />
                Opcoes
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="grid w-64 gap-2">
              <Button variant="ghost" className="h-8 justify-start px-2" onClick={() => onSort("dueDate")}>
                Entrega{sortIndicator("dueDate")}
              </Button>
            </PopoverContent>
          </Popover>
        </div>
        <span className="text-sm font-semibold text-text-secondary">{tasks.length} tarefas</span>
      </div>
      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-3">
          <TaskCardSkeleton />
          <TaskCardSkeleton />
          <TaskCardSkeleton />
        </div>
      ) : null}
      {!isLoading ? (
        <div className="overflow-auto rounded-md border border-border">
          <table className="w-full min-w-[1480px] border-collapse bg-surface-card text-sm">
            <thead className="bg-surface">
              <tr className="text-left text-text-secondary">
                <SortableHeader label="Tarefa" sortKey="title" onSort={onSort} indicator={sortIndicator("title")} className="w-[420px]" />
                <SortableHeader label="Disciplina" sortKey="discipline" onSort={onSort} indicator={sortIndicator("discipline")} />
                <SortableHeader label="Responsavel" sortKey="assignee" onSort={onSort} indicator={sortIndicator("assignee")} />
                <SortableHeader label="Prioridade" sortKey="priority" onSort={onSort} indicator={sortIndicator("priority")} />
                <SortableHeader label="Entrega" sortKey="dueDate" onSort={onSort} indicator={sortIndicator("dueDate")} />
                {customFieldNames.map((name) => (
                  <th key={name} className="min-w-40 p-3 font-semibold">
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groupedTasks.map((group) => (
                <GroupedScopeRows
                  key={group.scope}
                  label={group.label}
                  color={group.color}
                  tasks={group.tasks}
                  users={users}
                  completionBusy={completionBusy}
                  onTaskCompletionChange={onTaskCompletionChange}
                  onTaskAssigneeChange={onTaskAssigneeChange}
                  onTaskCustomFieldChange={onTaskCustomFieldChange}
                  onOpenTask={onOpenTask}
                  customFieldNames={customFieldNames}
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
  color,
  tasks,
  users,
  completionBusy,
  onTaskCompletionChange,
  onTaskAssigneeChange,
  onTaskCustomFieldChange,
  onOpenTask,
  customFieldNames
}: {
  label: string;
  color: string;
  tasks: TaskWithDiscipline[];
  users: User[];
  completionBusy?: boolean;
  onTaskCompletionChange: (task: TaskWithDiscipline) => void;
  onTaskAssigneeChange: (taskId: string, assigneeId: string | null) => void;
  onTaskCustomFieldChange: (taskId: string, fieldId: string, value: string | number | null) => void;
  onOpenTask: (task: TaskWithDiscipline) => void;
  customFieldNames: string[];
}) {
  const assigneeOptions = [
    { value: "none", label: "Sem responsavel" },
    ...users.map((user) => ({ value: user.id, label: user.name, description: user.email }))
  ];
  const columnSpan = 5 + customFieldNames.length;

  return (
    <>
      <tr className="border-t border-border bg-surface">
        <td colSpan={columnSpan} className="p-3">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="font-bold text-text-primary">{label}</span>
            <span className="rounded-md bg-surface-card px-2 py-1 text-xs text-text-secondary">{tasks.length}</span>
          </div>
        </td>
      </tr>
      {tasks.length === 0 ? (
        <tr className="border-t border-border">
          <td colSpan={columnSpan} className="p-4 text-sm text-text-muted">
            Nenhuma tarefa nesta secao.
          </td>
        </tr>
      ) : (
        tasks.map((task) => (
          <tr key={task.id} className={cn("border-t border-border", task.completed ? "opacity-70" : "")}>
            <td className="w-[420px] max-w-[420px] p-3">
              <div className="flex min-w-0 items-center gap-2">
                <TaskCompletionButton
                  completed={task.completed}
                  disabled={completionBusy}
                  onToggle={() => onTaskCompletionChange(task)}
                />
                <button
                  type="button"
                  onClick={() => onOpenTask(task)}
                  title={task.title}
                  className={cn(
                    "min-w-0 max-w-full truncate text-left font-semibold hover:text-brand-orange",
                    task.completed ? "text-text-muted" : "text-text-primary"
                  )}
                >
                  {task.title}
                </button>
              </div>
            </td>
            <td className="max-w-48 p-3 text-text-secondary">
              <span className="block truncate" title={task.discipline.name}>{task.discipline.name}</span>
            </td>
            <td className="p-3">
              <SearchableSelect
                value={task.assigneeId ?? "none"}
                options={assigneeOptions}
                searchPlaceholder="Buscar responsavel..."
                triggerClassName="h-8 min-w-44"
                onValueChange={(value) => onTaskAssigneeChange(task.id, value === "none" ? null : value)}
              />
            </td>
            <td className="p-3">
              <PriorityBadge priority={task.priority} />
            </td>
            <td className="p-3 text-text-secondary">
              {task.dueDate ? formatDateOnly(task.dueDate, "dd/MM/yyyy") : "-"}
            </td>
            {customFieldNames.map((name) => {
              const field = task.customFieldValues?.find((item) => normalizeFieldName(item.customFieldName ?? "Campo") === normalizeFieldName(name));
              return (
                <td key={task.id + "-" + name} className="p-3">
                  {field ? (
                    <InlineField field={field} onSave={(value) => onTaskCustomFieldChange(task.id, field.id, value)} />
                  ) : (
                    <span className="text-text-muted">-</span>
                  )}
                </td>
              );
            })}
          </tr>
        ))
      )}
    </>
  );
}

function SortableHeader({
  label,
  sortKey,
  indicator,
  onSort,
  className
}: {
  label: string;
  sortKey: SortKey;
  indicator: string;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  return (
    <th className={cn("p-3", className)}>
      <button type="button" className="font-semibold hover:text-brand-orange" onClick={() => onSort(sortKey)}>
        {label}
        {indicator}
      </button>
    </th>
  );
}

function sortLabel(key: SortKey): string {
  const labels: Record<SortKey, string> = {
    title: "Tarefa",
    discipline: "Disciplina",
    assignee: "Responsável",
    priority: "Prioridade",
    status: "Status",
    dueDate: "Entrega"
  };

  return labels[key];
}

function uniqueCustomFieldNames(tasks: TaskWithDiscipline[]) {
  const names = new Map<string, string>();

  for (const task of tasks) {
    for (const field of task.customFieldValues ?? []) {
      const name = field.customFieldName ?? "Campo";
      const normalized = normalizeFieldName(name);
      if (!names.has(normalized)) {
        names.set(normalized, name);
      }
    }
  }

  return Array.from(names.values());
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

function isCustomStatusField(name: string) {
  const normalized = normalizeFieldName(name);
  return normalized === "status" || normalized === "status de conclusao" || normalized === "situacao";
}

function normalizeFieldName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function groupTasksByScope(tasks: TaskWithDiscipline[]) {
  const groups: Array<{ scope: TaskScope; label: string; color: string; tasks: TaskWithDiscipline[] }> = [
    { scope: "general", label: "Geral", color: "var(--color-text-muted)", tasks: [] },
    { scope: "civil", label: "Civil", color: "#CBD5E1", tasks: [] },
    { scope: "electrical", label: "Elétrica", color: "#F59E0B", tasks: [] }
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
            color: option.color ?? enumColor(option.name)
          }))
        ]}
        triggerClassName="h-8 min-w-40"
        searchPlaceholder={`Buscar ${field.customFieldName ?? "campo"}...`}
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
