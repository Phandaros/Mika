import { Fragment, useMemo, useState, type ReactNode } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek
} from "date-fns";
import { ArrowDownUp, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Circle, Filter, KanbanSquare, List, Plus, Search } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { TaskStatus, type Task } from "shared";
import { EmptyState } from "../components/shared/EmptyState";
import { LoadingSpinner } from "../components/shared/LoadingSpinner";
import { Avatar } from "../components/shared/Avatar";
import { TaskCard } from "../components/task/TaskCard";
import { TaskDetail } from "../components/task/TaskDetail";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { useAuth } from "../hooks/useAuth";
import { useProjects } from "../hooks/useProjects";
import { useCreateTask, useUpdateTask, useUpdateTaskCompletion } from "../hooks/useTasks";
import { cn } from "../lib/utils";

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
  { status: TaskStatus.BACKLOG, label: "Backlog" },
  { status: TaskStatus.TODO, label: "A fazer" },
  { status: TaskStatus.IN_PROGRESS, label: "Em andamento" },
  { status: TaskStatus.IN_REVIEW, label: "Em revisao" },
  { status: TaskStatus.DONE, label: "Concluido" }
];

export function MyTasksPage() {
  const { user } = useAuth();
  const { data: projects = [], isLoading } = useProjects();
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState<MyTasksView>("list");
  const [month, setMonth] = useState(() => new Date());
  const [selectedTask, setSelectedTask] = useState<TaskWithProject | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
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
        project.disciplines?.map((discipline) => ({
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

  const myTasks = useMemo(
    () =>
      projects.flatMap((project) =>
        project.disciplines?.flatMap((discipline) =>
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
    const filteredTasks = myTasks
      .filter((task) => statusFilter === "all" || task.status === statusFilter)
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
    if (!result.destination || result.destination.droppableId === result.source.droppableId) {
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
          <ViewTab active={view === "calendar"} icon={<CalendarDays size={15} />} label="Calendario" onClick={() => setView("calendar")} />
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            className="h-8 bg-blue-600 hover:bg-blue-500"
            onClick={() => {
              setSelectedCreateTarget((current) => current || disciplineOptions[0]?.key || "");
              setShowCreate((current) => !current);
            }}
            disabled={!disciplineOptions.length}
          >
            <Plus size={15} />
            Adicionar uma tarefa
          </Button>
          {view === "calendar" ? (
            <>
              <Button variant="ghost" className="h-8 w-8 px-0" onClick={() => setMonth((current) => addMonths(current, -1))} title="Mes anterior">
                <ChevronLeft size={16} />
              </Button>
              <Button variant="secondary" className="h-8" onClick={() => setMonth(new Date())}>
                Hoje
              </Button>
              <Button variant="ghost" className="h-8 w-8 px-0" onClick={() => setMonth((current) => addMonths(current, 1))} title="Proximo mes">
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
            <Select value={completionFilter} onChange={(event) => setCompletionFilter(event.target.value as CompletionFilter)} className="h-8 w-40">
              <option value="open">Nao concluidas</option>
              <option value="completed">Concluidas</option>
              <option value="all">Todas</option>
            </Select>
          </label>
          <label className="inline-flex items-center gap-1.5">
            <Filter size={15} />
            <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-8 w-36">
              <option value="all">Todos status</option>
              {Object.values(TaskStatus).map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </Select>
          </label>
          <label className="inline-flex items-center gap-1.5">
            <ArrowDownUp size={15} />
            <Select value={sortMode} onChange={(event) => setSortMode(event.target.value as typeof sortMode)} className="h-8 w-36">
              <option value="dueDate">Entrega</option>
              <option value="title">Nome</option>
              <option value="project">Projeto</option>
            </Select>
          </label>
          <label className="relative">
            <Search size={15} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2" />
            <Input value={search} onChange={(event) => updateSearch(event.target.value)} className="h-8 w-52 pl-8" placeholder="Buscar" />
          </label>
        </div>
      </div>

      {showCreate ? (
        <div className="grid gap-2 border-b border-border py-3 lg:grid-cols-[minmax(220px,340px)_minmax(260px,1fr)_auto]">
          <Select value={selectedCreateTarget || createTarget?.key || ""} onChange={(event) => setSelectedCreateTarget(event.target.value)}>
            {disciplineOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </Select>
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

      {myTasks.length === 0 ? <EmptyState title="Voce nao possui tarefas atribuidas" /> : null}
      {myTasks.length > 0 && visibleTasks.length === 0 ? <EmptyState title="Nenhuma tarefa corresponde aos filtros" /> : null}
      {view === "list" ? (
        <ListView
          tasks={visibleTasks}
          onOpenTask={setSelectedTask}
          onStatusChange={(task, status) => void updateTask.mutateAsync({ id: task.id, payload: { status } })}
          onCompletionChange={(task) => void updateTaskCompletion.mutateAsync({ id: task.id, completed: !task.completed })}
        />
      ) : null}
      {view === "kanban" ? (
        <KanbanView
          tasks={visibleTasks}
          onDragEnd={handleDragEnd}
          onOpenTask={setSelectedTask}
          onCompletionChange={(task) => void updateTaskCompletion.mutateAsync({ id: task.id, completed: !task.completed })}
        />
      ) : null}
      {view === "calendar" ? <CalendarView month={month} tasks={visibleTasks} onOpenTask={setSelectedTask} /> : null}
      <TaskDetail task={selectedTask} onClose={() => setSelectedTask(null)} />
    </div>
  );
}

function ViewTab({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("flex h-9 items-center gap-1 border-b-2 border-transparent", active ? "border-text-primary text-text-primary" : "hover:text-text-primary")}
    >
      {icon}
      {label}
    </button>
  );
}

function ListView({
  tasks,
  onOpenTask,
  onStatusChange,
  onCompletionChange
}: {
  tasks: TaskWithProject[];
  onOpenTask: (task: TaskWithProject) => void;
  onStatusChange: (task: TaskWithProject, status: TaskStatus) => void;
  onCompletionChange: (task: TaskWithProject) => void;
}) {
  const openTasks = tasks.filter((task) => !task.completed);
  const completedTasks = tasks.filter((task) => task.completed);
  const groups = [
    { key: "open", label: "Nao concluidas", tasks: openTasks },
    { key: "completed", label: "Concluidas", tasks: completedTasks }
  ].filter((group) => group.tasks.length > 0);

  return (
    <div className="overflow-auto">
      <table className="w-full min-w-[980px] border-collapse text-sm">
        <thead className="text-left text-xs font-semibold text-text-secondary">
          <tr className="border-b border-border">
            <th className="w-[36%] p-2 font-semibold">Nome</th>
            <th className="w-[12%] border-l border-border p-2 font-semibold">Projetos</th>
            <th className="w-[12%] border-l border-border p-2 font-semibold">Data de ...</th>
            <th className="w-[12%] border-l border-border p-2 font-semibold">Status</th>
            <th className="border-l border-border p-2 font-semibold">+</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <Fragment key={group.key}>
              <tr className="border-b border-border bg-brand-black">
                <td colSpan={5} className="px-2 py-2 text-xs font-bold uppercase text-text-secondary">
                  {group.label} <span className="text-text-muted">{group.tasks.length}</span>
                </td>
              </tr>
              {group.tasks.map((task) => (
                <tr key={task.id} className={cn("h-7 border-b border-border hover:bg-surface-hover", task.completed ? "opacity-70" : "")}>
                  <td className="p-1.5">
                    <div className="flex max-w-full items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onCompletionChange(task)}
                        className="flex h-5 w-5 items-center justify-center rounded-full text-text-secondary transition hover:text-brand-orange"
                        title={task.completed ? "Reabrir tarefa" : "Concluir tarefa"}
                      >
                        {task.completed ? <CheckCircle2 size={16} className="text-green-400" /> : <Circle size={16} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenTask(task)}
                        className={cn("min-w-0 font-semibold text-text-primary", task.completed ? "text-text-muted line-through" : "")}
                      >
                        <span className="block truncate">{task.title}</span>
                      </button>
                    </div>
                  </td>
                  <td className="border-l border-border p-1.5">
                    <span className="inline-flex max-w-36 items-center rounded bg-surface-hover px-2 py-0.5 text-xs font-bold text-text-primary">
                      <span className="truncate">{task.discipline.projectName}</span>
                    </span>
                  </td>
                  <td className="border-l border-border p-1.5 text-xs font-semibold text-red-300">{task.dueDate ? format(new Date(task.dueDate), "d MMM") : ""}</td>
                  <td className="border-l border-border p-1.5">
                    <Select value={task.status} onChange={(event) => onStatusChange(task, event.target.value as TaskStatus)} className="h-7 w-36 py-0">
                      {Object.values(TaskStatus).map((status) => (
                        <option key={status} value={status}>
                          {statusLabel(status)}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="border-l border-border p-1.5 text-text-muted" />
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KanbanView({
  tasks,
  onDragEnd,
  onOpenTask,
  onCompletionChange
}: {
  tasks: TaskWithProject[];
  onDragEnd: (result: DropResult) => void;
  onOpenTask: (task: TaskWithProject) => void;
  onCompletionChange: (task: TaskWithProject) => void;
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
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(dragProvided) => (
                            <div ref={dragProvided.innerRef} {...dragProvided.draggableProps} {...dragProvided.dragHandleProps}>
                              <TaskCard task={task} disciplineName={task.discipline.name} onOpen={onOpenTask} onToggleCompletion={onCompletionChange} />
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

function CalendarView({ month, tasks, onOpenTask }: { month: Date; tasks: TaskWithProject[]; onOpenTask: (task: TaskWithProject) => void }) {
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(month)), end: endOfWeek(endOfMonth(month)) });

  return (
    <div className="grid grid-cols-7 overflow-hidden border-l border-t border-border text-sm">
      {["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"].map((day) => (
        <div key={day} className="border-b border-r border-border px-3 py-1 text-xs font-bold text-text-secondary">
          {day}
        </div>
      ))}
      {days.map((day) => {
        const dayTasks = tasks.filter((task) => task.dueDate && isSameDay(parseISO(String(task.dueDate).slice(0, 10)), day));
        return (
          <div key={day.toISOString()} className="min-h-32 border-b border-r border-border p-2">
            <p className={cn("mb-2 text-base font-semibold", isSameMonth(day, month) ? "text-text-primary" : "text-text-muted")}>{format(day, "d")}</p>
            <div className="grid gap-1">
              {dayTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onOpenTask(task)}
                  className="truncate rounded px-2 py-1 text-left text-xs font-semibold text-brand-black"
                  style={{ backgroundColor: calendarColor(task.status) }}
                >
                  {task.title}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function statusLabel(status: TaskStatus): string {
  return columns.find((column) => column.status === status)?.label ?? status;
}

function calendarColor(status: TaskStatus): string {
  const colors: Record<TaskStatus, string> = {
    [TaskStatus.BACKLOG]: "#A3A3A3",
    [TaskStatus.TODO]: "#F0A1DF",
    [TaskStatus.IN_PROGRESS]: "#86A567",
    [TaskStatus.IN_REVIEW]: "#FFD166",
    [TaskStatus.DONE]: "#7BDDA3"
  };

  return colors[status];
}
