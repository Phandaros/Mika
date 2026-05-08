import { useMemo, useState, type ReactNode } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { format, isBefore } from "date-fns";
import { Edit3, ExternalLink, Inbox, Plus, X } from "lucide-react";
import { useParams } from "react-router-dom";
import { getDefaultDiscipline, Priority, TaskStatus, type Discipline, type DisciplineType, type Task, type User } from "shared";
import { DisciplineTab } from "../components/discipline/DisciplineTab";
import { ProjectForm } from "../components/project/ProjectForm";
import { EmptyState } from "../components/shared/EmptyState";
import { LoadingSpinner } from "../components/shared/LoadingSpinner";
import { Avatar } from "../components/shared/Avatar";
import { PriorityBadge } from "../components/shared/PriorityBadge";
import { TaskCard } from "../components/task/TaskCard";
import { TaskCardSkeleton } from "../components/task/TaskCardSkeleton";
import { TaskDetail } from "../components/task/TaskDetail";
import { TaskForm } from "../components/task/TaskForm";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { useProject, useProjects } from "../hooks/useProjects";
import { useCreateTask, useUpdateTask, useUpdateTaskStatus } from "../hooks/useTasks";
import { useUsers } from "../hooks/useUsers";
import { cn } from "../lib/utils";

type ProjectTab = "kanban" | "list" | "workload";
type SortKey = "title" | "discipline" | "assignee" | "priority" | "status" | "dueDate";
type SortDirection = "asc" | "desc";

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

function tasksFromDisciplines(disciplines: Discipline[]): TaskWithDiscipline[] {
  return disciplines.flatMap((discipline) =>
    (discipline.tasks ?? []).map((task) => ({
      ...task,
      discipline: {
        id: discipline.id,
        name: discipline.name,
        projectId: discipline.projectId,
        type: discipline.type
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

  return String(task[key] ?? "");
}

export function ProjectDetailPage() {
  const { projectId } = useParams();
  const { data: project, isLoading, isFetching } = useProject(projectId);
  const updateTaskStatus = useUpdateTaskStatus(projectId ?? "");
  const updateTask = useUpdateTask(projectId ?? "");
  const [activeTab, setActiveTab] = useState<ProjectTab>("kanban");
  const [selectedDisciplineIds, setSelectedDisciplineIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("dueDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedTask, setSelectedTask] = useState<TaskWithDiscipline | null>(null);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);

  const { data: users = [] } = useUsers();
  const { data: projects = [] } = useProjects();

  const disciplines = project?.disciplines ?? [];
  const allTasks = useMemo(() => tasksFromDisciplines(disciplines), [disciplines]);
  const selectedDisciplineSet = useMemo(() => new Set(selectedDisciplineIds), [selectedDisciplineIds]);
  const builderSuggestions = useMemo(
    () =>
      Array.from(
        new Set(projects.map((item) => projectBuilder(item)).filter((builder): builder is string => Boolean(builder)))
      ).sort(),
    [projects]
  );

  const disciplineFilteredTasks = allTasks.filter(
    (task) => selectedDisciplineSet.size === 0 || selectedDisciplineSet.has(task.discipline.id)
  );
  const visibleDisciplines =
    selectedDisciplineSet.size === 0
      ? disciplines
      : disciplines.filter((discipline) => selectedDisciplineSet.has(discipline.id));

  const listTasks = disciplineFilteredTasks
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

    if (nextStatus === result.source.droppableId) {
      return;
    }

    void updateTaskStatus.mutateAsync({ id: result.draggableId, status: nextStatus });
  }

  function openUserTasks(userId: string) {
    setAssigneeFilter(userId);
    setActiveTab("list");
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!project || !projectId) {
    return <EmptyState title="Projeto nao encontrado" />;
  }

  const taskFormDiscipline = visibleDisciplines[0] ?? disciplines[0] ?? null;
  const isTasksLoading = isFetching && !isLoading;

  function toggleDisciplineFilter(disciplineId: string) {
    setSelectedDisciplineIds((current) =>
      current.includes(disciplineId) ? current.filter((id) => id !== disciplineId) : [...current, disciplineId]
    );
  }

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
          <Button onClick={() => setShowTaskForm((current) => !current)} disabled={!taskFormDiscipline}>
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
      {showTaskForm && taskFormDiscipline ? (
        <TaskForm projectId={projectId} disciplineId={taskFormDiscipline.id} users={users} />
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedDisciplineIds.length === 0 ? "primary" : "secondary"}
          onClick={() => setSelectedDisciplineIds([])}
        >
          Tudo
        </Button>
        {disciplines.map((discipline) => (
          <DisciplineTab
            key={discipline.id}
            discipline={discipline}
            active={selectedDisciplineSet.has(discipline.id)}
            onClick={() => toggleDisciplineFilter(discipline.id)}
          />
        ))}
      </div>

      <div className="min-w-0">
        {activeTab === "kanban" ? (
          <KanbanView
            projectId={projectId}
            disciplineId={taskFormDiscipline?.id ?? null}
            tasks={disciplineFilteredTasks}
            isLoading={isTasksLoading}
            onDragEnd={handleDragEnd}
            onOpenTask={setSelectedTask}
          />
        ) : null}
        {activeTab === "list" ? (
          <ListView
            disciplines={visibleDisciplines}
            tasks={listTasks}
            users={users}
            isLoading={isTasksLoading}
            statusFilter={statusFilter}
            assigneeFilter={assigneeFilter}
            priorityFilter={priorityFilter}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onStatusFilterChange={setStatusFilter}
            onAssigneeFilterChange={setAssigneeFilter}
            onPriorityFilterChange={setPriorityFilter}
            onSort={handleSort}
            onTaskStatusChange={(taskId, status) => void updateTask.mutateAsync({ id: taskId, payload: { status } })}
            onTaskAssigneeChange={(taskId, assigneeId) =>
              void updateTask.mutateAsync({ id: taskId, payload: { assigneeId } })
            }
            onTaskCustomFieldChange={(taskId, fieldId, value) =>
              void updateTask.mutateAsync({ id: taskId, payload: { customFieldValues: [{ id: fieldId, value }] } })
            }
            onOpenTask={setSelectedTask}
          />
        ) : null}
        {activeTab === "workload" ? (
          <WorkloadView tasks={disciplineFilteredTasks} users={users} onUserClick={openUserTasks} />
        ) : null}
      </div>
      <TaskDetail task={selectedTask} onClose={() => setSelectedTask(null)} />
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
                        <TaskCard task={task} disciplineName={task.discipline.name} onOpen={onOpenTask} />
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
  statusFilter,
  assigneeFilter,
  priorityFilter,
  sortKey,
  sortDirection,
  onStatusFilterChange,
  onAssigneeFilterChange,
  onPriorityFilterChange,
  onSort,
  onTaskStatusChange,
  onTaskAssigneeChange,
  onTaskCustomFieldChange,
  onOpenTask
}: {
  disciplines: Discipline[];
  tasks: TaskWithDiscipline[];
  users: User[];
  isLoading: boolean;
  statusFilter: string;
  assigneeFilter: string;
  priorityFilter: string;
  sortKey: SortKey;
  sortDirection: SortDirection;
  onStatusFilterChange: (value: string) => void;
  onAssigneeFilterChange: (value: string) => void;
  onPriorityFilterChange: (value: string) => void;
  onSort: (key: SortKey) => void;
  onTaskStatusChange: (taskId: string, status: TaskStatus) => void;
  onTaskAssigneeChange: (taskId: string, assigneeId: string | null) => void;
  onTaskCustomFieldChange: (taskId: string, fieldId: string, value: string | null) => void;
  onOpenTask: (task: TaskWithDiscipline) => void;
}) {
  const sortIndicator = (key: SortKey) => (sortKey === key ? (sortDirection === "asc" ? " ↑" : " ↓") : "");
  const customFieldNames = Array.from(
    new Set(tasks.flatMap((task) => task.customFieldValues?.map((field) => field.customFieldName ?? "Campo") ?? []))
  );

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 rounded-md border border-border bg-surface-card p-4 md:grid-cols-4">
        <Select value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)}>
          <option value="all">Todos os status</option>
          {Object.values(TaskStatus).map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </Select>
        <Select value={assigneeFilter} onChange={(event) => onAssigneeFilterChange(event.target.value)}>
          <option value="all">Todos responsaveis</option>
          <option value="none">Sem responsavel</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </Select>
        <Select value={priorityFilter} onChange={(event) => onPriorityFilterChange(event.target.value)}>
          <option value="all">Todas prioridades</option>
          {Object.values(Priority).map((priority) => (
            <option key={priority} value={priority}>
              {priority}
            </option>
          ))}
        </Select>
        <Button variant="secondary" onClick={() => onSort("dueDate")}>
          Entrega{sortIndicator("dueDate")}
        </Button>
      </div>
      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-3">
          <TaskCardSkeleton />
          <TaskCardSkeleton />
          <TaskCardSkeleton />
        </div>
      ) : null}
      {!isLoading ? <div className="overflow-auto rounded-md border border-border">
        <table className="w-full min-w-[980px] border-collapse bg-surface-card text-sm">
          <thead className="bg-surface">
            <tr className="text-left text-text-secondary">
              <SortableHeader label="Tarefa" sortKey="title" onSort={onSort} indicator={sortIndicator("title")} />
              <SortableHeader label="Disciplina" sortKey="discipline" onSort={onSort} indicator={sortIndicator("discipline")} />
              <SortableHeader label="Responsável" sortKey="assignee" onSort={onSort} indicator={sortIndicator("assignee")} />
              <SortableHeader label="Prioridade" sortKey="priority" onSort={onSort} indicator={sortIndicator("priority")} />
              <SortableHeader label="Status" sortKey="status" onSort={onSort} indicator={sortIndicator("status")} />
              <SortableHeader label="Entrega" sortKey="dueDate" onSort={onSort} indicator={sortIndicator("dueDate")} />
              {customFieldNames.map((name) => (
                <th key={name} className="p-3 font-semibold">{name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {disciplines.map((discipline) => {
              const disciplineTasks = tasks.filter((task) => task.discipline.id === discipline.id);
              const catalogItem = getDefaultDiscipline(discipline.type);

              return (
                <GroupedDisciplineRows
                  key={discipline.id}
                  discipline={discipline}
                  disciplineColor={catalogItem.color}
                  tasks={disciplineTasks}
                  users={users}
                  onTaskStatusChange={onTaskStatusChange}
                  onTaskAssigneeChange={onTaskAssigneeChange}
                  onTaskCustomFieldChange={onTaskCustomFieldChange}
                  onOpenTask={onOpenTask}
                  customFieldNames={customFieldNames}
                />
              );
            })}
          </tbody>
        </table>
      </div> : null}
      {disciplines.length === 0 ? <EmptyState title="Nenhuma disciplina selecionada no projeto" /> : null}
    </div>
  );
}

function GroupedDisciplineRows({
  discipline,
  disciplineColor,
  tasks,
  users,
  onTaskStatusChange,
  onTaskAssigneeChange,
  onTaskCustomFieldChange,
  onOpenTask,
  customFieldNames
}: {
  discipline: Discipline;
  disciplineColor: string;
  tasks: TaskWithDiscipline[];
  users: User[];
  onTaskStatusChange: (taskId: string, status: TaskStatus) => void;
  onTaskAssigneeChange: (taskId: string, assigneeId: string | null) => void;
  onTaskCustomFieldChange: (taskId: string, fieldId: string, value: string | null) => void;
  onOpenTask: (task: TaskWithDiscipline) => void;
  customFieldNames: string[];
}) {
  return (
    <>
      <tr className="border-t border-border bg-surface">
        <td colSpan={6 + customFieldNames.length} className="p-3">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: disciplineColor }} />
            <span className="font-bold text-text-primary">{discipline.name}</span>
            <span className="rounded-md bg-surface-card px-2 py-1 text-xs text-text-secondary">{tasks.length}</span>
          </div>
        </td>
      </tr>
      {tasks.length === 0 ? (
        <tr className="border-t border-border">
          <td colSpan={6 + customFieldNames.length} className="p-4 text-sm text-text-muted">
            Nenhuma tarefa nesta disciplina.
          </td>
        </tr>
      ) : (
        tasks.map((task) => (
          <tr key={task.id} className="border-t border-border">
            <td className="p-3">
              <button type="button" onClick={() => onOpenTask(task)} className="font-semibold text-text-primary hover:text-brand-orange">
                {task.title}
              </button>
            </td>
            <td className="p-3 text-text-secondary">{task.discipline.name}</td>
            <td className="p-3">
              <Select
                value={task.assigneeId ?? ""}
                onChange={(event) => onTaskAssigneeChange(task.id, event.target.value || null)}
              >
                <option value="">Sem responsavel</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </Select>
            </td>
            <td className="p-3">
              <PriorityBadge priority={task.priority} />
            </td>
            <td className="p-3">
              <Select value={task.status} onChange={(event) => onTaskStatusChange(task.id, event.target.value as TaskStatus)}>
                {Object.values(TaskStatus).map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </Select>
            </td>
            <td className="p-3 text-text-secondary">
              {task.dueDate ? format(new Date(task.dueDate), "dd/MM/yyyy") : "-"}
            </td>
            {customFieldNames.map((name) => {
              const field = task.customFieldValues?.find((item) => (item.customFieldName ?? "Campo") === name);
              return (
                <td key={`${task.id}-${name}`} className="p-3">
                  {field ? (
                    <InlineField
                      value={String(field.displayValue ?? field.enumOptionName ?? field.numberValue ?? "")}
                      onSave={(value) => onTaskCustomFieldChange(task.id, field.id, value || null)}
                    />
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
  onSort
}: {
  label: string;
  sortKey: SortKey;
  indicator: string;
  onSort: (key: SortKey) => void;
}) {
  return (
    <th className="p-3">
      <button type="button" className="font-semibold hover:text-brand-orange" onClick={() => onSort(sortKey)}>
        {label}
        {indicator}
      </button>
    </th>
  );
}

function InlineField({ value, onSave }: { value: string; onSave: (value: string) => void }) {
  const [draft, setDraft] = useState(value);

  return (
    <Input
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => onSave(draft)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
      className="h-9 min-w-36 border-border bg-brand-black/60"
    />
  );
}

function WorkloadView({
  tasks,
  users,
  onUserClick
}: {
  tasks: TaskWithDiscipline[];
  users: User[];
  onUserClick: (userId: string) => void;
}) {
  const rows = users.map((user) => {
    const userTasks = tasks.filter((task) => task.assigneeId === user.id);
    const done = userTasks.filter((task) => task.status === TaskStatus.DONE).length;
    const inProgress = userTasks.filter((task) => task.status === TaskStatus.IN_PROGRESS).length;
    const overdue = userTasks.filter(
      (task) => task.dueDate && task.status !== TaskStatus.DONE && isBefore(new Date(task.dueDate), new Date())
    ).length;
    const progress = userTasks.length === 0 ? 0 : Math.round((done / userTasks.length) * 100);

    return { user, total: userTasks.length, inProgress, overdue, progress };
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {rows.map((row) => (
        <button
          key={row.user.id}
          type="button"
          onClick={() => onUserClick(row.user.id)}
          className="rounded-md border border-border bg-surface-card p-4 text-left transition hover:border-brand-orange hover:bg-surface-hover"
        >
          <div className="flex items-center gap-3">
            <Avatar name={row.user.name} imageUrl={row.user.avatarUrl} />
            <div>
              <h3 className="font-semibold text-text-primary">{row.user.name}</h3>
              <p className="text-xs text-text-secondary">{row.user.role}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <Metric label="Total" value={row.total} />
            <Metric label="Em andamento" value={row.inProgress} />
            <Metric label="Atrasadas" value={row.overdue} />
          </div>
          <div className="mt-4 h-2 rounded-full bg-brand-black">
            <div className="h-2 rounded-full bg-brand-orange" style={{ width: `${row.progress}%` }} />
          </div>
        </button>
      ))}
      {rows.length === 0 ? <EmptyState title="Nenhum usuario cadastrado" /> : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-brand-black p-3">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 text-lg font-bold text-text-primary">{value}</p>
    </div>
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
