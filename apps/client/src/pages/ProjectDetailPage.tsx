import { useMemo, useState } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { useQuery } from "@tanstack/react-query";
import { format, isBefore } from "date-fns";
import { useParams } from "react-router-dom";
import { Priority, TaskStatus, type Discipline, type Task, type User } from "shared";
import { DisciplineForm } from "../components/discipline/DisciplineForm";
import { DisciplineTab } from "../components/discipline/DisciplineTab";
import { EmptyState } from "../components/shared/EmptyState";
import { LoadingSpinner } from "../components/shared/LoadingSpinner";
import { Avatar } from "../components/shared/Avatar";
import { PriorityBadge } from "../components/shared/PriorityBadge";
import { TaskCard } from "../components/task/TaskCard";
import { TaskDetail } from "../components/task/TaskDetail";
import { TaskForm } from "../components/task/TaskForm";
import { TaskStatusBadge } from "../components/task/TaskStatusBadge";
import { Button } from "../components/ui/button";
import { Select } from "../components/ui/select";
import { useProject } from "../hooks/useProjects";
import { useUpdateTask, useUpdateTaskStatus } from "../hooks/useTasks";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

type ProjectTab = "kanban" | "list" | "workload";
type SortKey = "title" | "discipline" | "assignee" | "priority" | "status" | "dueDate";
type SortDirection = "asc" | "desc";

type TaskWithDiscipline = Task & {
  discipline: {
    id: string;
    name: string;
    projectId: string;
  };
};

interface UsersResponse {
  users: User[];
}

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
        projectId: discipline.projectId
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
  const { data: project, isLoading } = useProject(projectId);
  const updateTaskStatus = useUpdateTaskStatus(projectId ?? "");
  const updateTask = useUpdateTask(projectId ?? "");
  const [activeTab, setActiveTab] = useState<ProjectTab>("kanban");
  const [selectedDisciplineId, setSelectedDisciplineId] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("dueDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedTask, setSelectedTask] = useState<TaskWithDiscipline | null>(null);

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const response = await api.get<UsersResponse>("/users");
      return response.data.users;
    }
  });

  const disciplines = project?.disciplines ?? [];
  const allTasks = useMemo(() => tasksFromDisciplines(disciplines), [disciplines]);

  const disciplineFilteredTasks = allTasks.filter(
    (task) => selectedDisciplineId === "all" || task.discipline.id === selectedDisciplineId
  );

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

  const selectedDiscipline = disciplines.find((discipline) => discipline.id === selectedDisciplineId);

  return (
    <div className="grid gap-6">
      <section className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold uppercase text-brand-orange">{project.client ?? "Projeto"}</p>
          <h1 className="mt-1 text-3xl font-bold text-text-primary">{project.name}</h1>
          <p className="mt-2 max-w-3xl text-sm text-text-secondary">{project.description ?? "Sem descricao cadastrada."}</p>
        </div>
        <Select value={selectedDisciplineId} onChange={(event) => setSelectedDisciplineId(event.target.value)} className="max-w-xs">
          <option value="all">Todas as disciplinas</option>
          {disciplines.map((discipline) => (
            <option key={discipline.id} value={discipline.id}>
              {discipline.name}
            </option>
          ))}
        </Select>
      </section>

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
        {disciplines.map((discipline) => (
          <DisciplineTab
            key={discipline.id}
            discipline={discipline}
            active={selectedDisciplineId === discipline.id}
            onClick={() => setSelectedDisciplineId(discipline.id)}
          />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          {activeTab === "kanban" ? (
            <KanbanView tasks={disciplineFilteredTasks} onDragEnd={handleDragEnd} onOpenTask={setSelectedTask} />
          ) : null}
          {activeTab === "list" ? (
            <ListView
              tasks={listTasks}
              users={users}
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
              onOpenTask={setSelectedTask}
            />
          ) : null}
          {activeTab === "workload" ? (
            <WorkloadView tasks={disciplineFilteredTasks} users={users} onUserClick={openUserTasks} />
          ) : null}
        </div>
        <div className="grid gap-4 self-start">
          <DisciplineForm projectId={projectId} users={users} />
          {selectedDiscipline ? <TaskForm projectId={projectId} disciplineId={selectedDiscipline.id} users={users} /> : null}
        </div>
      </div>
      <TaskDetail task={selectedTask} onClose={() => setSelectedTask(null)} />
    </div>
  );
}

function KanbanView({
  tasks,
  onDragEnd,
  onOpenTask
}: {
  tasks: TaskWithDiscipline[];
  onDragEnd: (result: DropResult) => void;
  onOpenTask: (task: TaskWithDiscipline) => void;
}) {
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="grid gap-4 xl:grid-cols-5">
        {columns.map((column) => {
          const columnTasks = tasks.filter((task) => task.status === column.status);
          return (
            <Droppable droppableId={column.status} key={column.status}>
              {(provided, snapshot) => (
                <section
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn(
                    "min-h-[420px] rounded-md border border-border bg-surface p-3 transition",
                    snapshot.isDraggingOver ? "border-brand-orange" : ""
                  )}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-text-primary">{column.label}</h2>
                    <span className="rounded-md bg-surface-card px-2 py-1 text-xs text-text-secondary">{columnTasks.length}</span>
                  </div>
                  <div className="grid gap-3">
                    {columnTasks.map((task, index) => (
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
                    {provided.placeholder}
                  </div>
                </section>
              )}
            </Droppable>
          );
        })}
      </div>
    </DragDropContext>
  );
}

function ListView({
  tasks,
  users,
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
  onOpenTask
}: {
  tasks: TaskWithDiscipline[];
  users: User[];
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
  onOpenTask: (task: TaskWithDiscipline) => void;
}) {
  const sortIndicator = (key: SortKey) => (sortKey === key ? (sortDirection === "asc" ? " ↑" : " ↓") : "");

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
      <div className="overflow-auto rounded-md border border-border">
        <table className="w-full min-w-[980px] border-collapse bg-surface-card text-sm">
          <thead className="bg-surface">
            <tr className="text-left text-text-secondary">
              <SortableHeader label="Tarefa" sortKey="title" onSort={onSort} indicator={sortIndicator("title")} />
              <SortableHeader label="Disciplina" sortKey="discipline" onSort={onSort} indicator={sortIndicator("discipline")} />
              <SortableHeader label="Responsavel" sortKey="assignee" onSort={onSort} indicator={sortIndicator("assignee")} />
              <SortableHeader label="Prioridade" sortKey="priority" onSort={onSort} indicator={sortIndicator("priority")} />
              <SortableHeader label="Status" sortKey="status" onSort={onSort} indicator={sortIndicator("status")} />
              <SortableHeader label="Entrega" sortKey="dueDate" onSort={onSort} indicator={sortIndicator("dueDate")} />
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {tasks.length === 0 ? <EmptyState title="Nenhuma tarefa para os filtros selecionados" /> : null}
    </div>
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
