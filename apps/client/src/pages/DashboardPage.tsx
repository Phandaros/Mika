import { useMemo, useState, type ReactNode } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { format, isSameDay, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek } from "date-fns";
import { CalendarDays, Inbox, KanbanSquare, List, UserRound } from "lucide-react";
import { TaskStatus, type Task } from "shared";
import { EmptyState } from "../components/shared/EmptyState";
import { LoadingSpinner } from "../components/shared/LoadingSpinner";
import { TaskCard } from "../components/task/TaskCard";
import { TaskDetail } from "../components/task/TaskDetail";
import { Button } from "../components/ui/button";
import { useAuth } from "../hooks/useAuth";
import { useProjects } from "../hooks/useProjects";
import { useUpdateTaskStatus } from "../hooks/useTasks";
import { cn } from "../lib/utils";

type DashboardView = "list" | "kanban" | "calendar";

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
  { status: TaskStatus.IN_REVIEW, label: "Em revisão" },
  { status: TaskStatus.DONE, label: "Concluído" }
];

export function DashboardPage() {
  const { user } = useAuth();
  const { data: projects = [], isLoading } = useProjects();
  const [view, setView] = useState<DashboardView>("list");
  const [selectedTask, setSelectedTask] = useState<TaskWithProject | null>(null);
  const updateTaskStatus = useUpdateTaskStatus(selectedTask?.discipline.projectId ?? "");

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

  if (isLoading) {
    return <LoadingSpinner />;
  }

  function handleDragEnd(result: DropResult) {
    if (!result.destination || result.destination.droppableId === result.source.droppableId) {
      return;
    }

    void updateTaskStatus.mutateAsync({ id: result.draggableId, status: result.destination.droppableId as TaskStatus });
  }

  return (
    <div className="grid gap-6">
      <section className="flex flex-col justify-between gap-4 border-b border-border pb-4 lg:flex-row lg:items-center">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-orange text-brand-white">
            <UserRound size={20} />
          </span>
          <div>
            <p className="text-sm font-semibold uppercase text-brand-orange">Home do usuário</p>
            <h1 className="text-2xl font-bold text-text-primary">Minhas tarefas</h1>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ViewButton active={view === "list"} icon={<List size={16} />} label="Lista" onClick={() => setView("list")} />
          <ViewButton active={view === "kanban"} icon={<KanbanSquare size={16} />} label="Kanban" onClick={() => setView("kanban")} />
          <ViewButton active={view === "calendar"} icon={<CalendarDays size={16} />} label="Calendário" onClick={() => setView("calendar")} />
        </div>
      </section>

      {myTasks.length === 0 ? <EmptyState icon={<Inbox size={28} />} title="Você não possui tarefas atribuídas" /> : null}
      {view === "list" ? <ListView tasks={myTasks} onOpenTask={setSelectedTask} /> : null}
      {view === "kanban" ? <KanbanView tasks={myTasks} onDragEnd={handleDragEnd} onOpenTask={setSelectedTask} /> : null}
      {view === "calendar" ? <CalendarView tasks={myTasks} onOpenTask={setSelectedTask} /> : null}
      <TaskDetail task={selectedTask} onClose={() => setSelectedTask(null)} />
    </div>
  );
}

function ViewButton({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <Button variant={active ? "primary" : "secondary"} className="h-9" onClick={onClick}>
      {icon}
      {label}
    </Button>
  );
}

function ListView({ tasks, onOpenTask }: { tasks: TaskWithProject[]; onOpenTask: (task: TaskWithProject) => void }) {
  return (
    <div className="overflow-auto rounded-md border border-border">
      <table className="w-full min-w-[900px] border-collapse bg-surface-card text-sm">
        <thead className="bg-surface text-left text-text-secondary">
          <tr>
            <th className="p-3">Tarefa</th>
            <th className="p-3">Projeto</th>
            <th className="p-3">Disciplina</th>
            <th className="p-3">Status</th>
            <th className="p-3">Entrega</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id} className="border-t border-border hover:bg-surface-hover">
              <td className="p-3">
                <button type="button" onClick={() => onOpenTask(task)} className="font-semibold text-text-primary hover:text-brand-orange">
                  {task.title}
                </button>
              </td>
              <td className="p-3 text-text-secondary">{task.discipline.projectName}</td>
              <td className="p-3 text-text-secondary">{task.discipline.name}</td>
              <td className="p-3 text-text-secondary">{statusLabel(task.status)}</td>
              <td className="p-3 text-text-secondary">{task.dueDate ? format(new Date(task.dueDate), "dd/MM/yyyy") : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KanbanView({ tasks, onDragEnd, onOpenTask }: { tasks: TaskWithProject[]; onDragEnd: (result: DropResult) => void; onOpenTask: (task: TaskWithProject) => void }) {
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="overflow-x-auto pb-3">
        <div className="flex min-w-max gap-4">
          {columns.map((column) => {
            const columnTasks = tasks.filter((task) => task.status === column.status);
            return (
              <Droppable key={column.status} droppableId={column.status}>
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
                      <h2 className="text-sm font-bold text-text-primary">{column.label}</h2>
                      <span className="rounded-md bg-surface-card px-2 py-1 text-xs text-text-secondary">{columnTasks.length}</span>
                    </div>
                    <div className="grid flex-1 content-start gap-3">
                      {columnTasks.map((task, index) => (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(dragProvided) => (
                            <div ref={dragProvided.innerRef} {...dragProvided.draggableProps} {...dragProvided.dragHandleProps}>
                              <TaskCard task={task} disciplineName={task.discipline.name} onOpen={onOpenTask} />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {columnTasks.length === 0 ? <EmptyState title="Nenhuma tarefa aqui" /> : null}
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

function CalendarView({ tasks, onOpenTask }: { tasks: TaskWithProject[]; onOpenTask: (task: TaskWithProject) => void }) {
  const month = new Date();
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(month)), end: endOfWeek(endOfMonth(month)) });

  return (
    <div className="grid grid-cols-7 overflow-hidden rounded-md border border-border bg-surface-card text-sm">
      {days.map((day) => {
        const dayTasks = tasks.filter((task) => task.dueDate && isSameDay(parseISO(String(task.dueDate).slice(0, 10)), day));
        return (
          <div key={day.toISOString()} className="min-h-32 border-r border-t border-border p-2">
            <p className="text-xs font-semibold text-text-muted">{format(day, "dd/MM")}</p>
            <div className="mt-2 grid gap-1">
              {dayTasks.map((task) => (
                <button key={task.id} type="button" onClick={() => onOpenTask(task)} className="rounded-md bg-brand-orange/15 px-2 py-1 text-left text-xs font-semibold text-text-primary hover:bg-brand-orange/25">
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
  const item = columns.find((column) => column.status === status);
  return item?.label ?? status;
}
