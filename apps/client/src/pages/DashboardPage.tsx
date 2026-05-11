import { useMemo, useState } from "react";
import { format, isBefore, isToday } from "date-fns";
import { CheckCircle2, Circle, FolderKanban, MessageSquare, Target, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { type Task } from "shared";
import { EmptyState } from "../components/shared/EmptyState";
import { LoadingSpinner } from "../components/shared/LoadingSpinner";
import { TaskDetail } from "../components/task/TaskDetail";
import { useAuth } from "../hooks/useAuth";
import { useProjects } from "../hooks/useProjects";
import { cn } from "../lib/utils";

type TaskWithProject = Task & {
  discipline: {
    id: string;
    name: string;
    projectId: string;
    projectName: string;
  };
};

export function DashboardPage() {
  const { user } = useAuth();
  const { data: projects = [], isLoading } = useProjects();
  const [selectedTask, setSelectedTask] = useState<TaskWithProject | null>(null);
  const [homeTaskTab, setHomeTaskTab] = useState<"next" | "overdue" | "done">("overdue");

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

  const overdueTasks = myTasks.filter((task) => task.dueDate && !task.completed && isBefore(new Date(task.dueDate), new Date()) && !isToday(new Date(task.dueDate)));
  const nextTasks = myTasks.filter((task) => !task.completed && !overdueTasks.some((item) => item.id === task.id)).slice(0, 7);
  const completedTasks = myTasks.filter((task) => task.completed);
  const completedCount = completedTasks.length;
  const collaboratorCount = new Set(myTasks.map((task) => task.creatorId).filter(Boolean)).size;
  const homeTasks = homeTaskTab === "overdue" ? overdueTasks.slice(0, 7) : homeTaskTab === "done" ? completedTasks.slice(0, 7) : nextTasks;
  const activeProjects = projects.filter((project) => project.status === "ACTIVE").slice(0, 3);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="mx-auto grid max-w-[1200px] gap-4">
      <section className="rounded-md border border-border bg-[radial-gradient(circle_at_20%_0%,rgba(255,102,0,0.20),transparent_30%),linear-gradient(135deg,#2a2020,#151515_58%,#101010)] p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-bold text-text-primary">{format(new Date(), "EEEE, d 'de' MMMM")}</p>
            <h1 className="mt-2 text-3xl font-semibold text-text-primary">Boa tarde, {firstName(user?.name ?? "usuario")}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <MetricPill label="Meu mes" value="" />
            <MetricPill label="tarefas concluidas" value={String(completedCount)} />
            <MetricPill label="colaboradores" value={String(collaboratorCount)} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <HomeCard title="Minhas tarefas" icon={<UserRound size={16} />}>
          <div className="mb-3 flex gap-5 border-b border-border text-sm font-bold text-text-secondary">
            <HomeTaskTab active={homeTaskTab === "next"} onClick={() => setHomeTaskTab("next")}>Proximas</HomeTaskTab>
            <HomeTaskTab active={homeTaskTab === "overdue"} onClick={() => setHomeTaskTab("overdue")}>Atrasadas ({overdueTasks.length})</HomeTaskTab>
            <HomeTaskTab active={homeTaskTab === "done"} onClick={() => setHomeTaskTab("done")}>Concluidas</HomeTaskTab>
          </div>
          <TaskMiniList tasks={homeTasks} onOpenTask={setSelectedTask} />
          <Link to="/my-tasks" className="mt-3 inline-flex text-sm font-semibold text-brand-orange hover:text-orange-400">
            Abrir minhas tarefas
          </Link>
        </HomeCard>

        <HomeCard title="Comentarios que me mencionam" icon={<MessageSquare size={16} />}>
          <div className="flex min-h-64 flex-col items-center justify-center text-center text-text-secondary">
            <MessageSquare size={48} className="mb-4 text-text-muted" />
            <p className="max-w-sm text-sm">As mencoes feitas a voce nos comentarios serao exibidas aqui.</p>
          </div>
        </HomeCard>

        <HomeCard title="Atualizacoes de status" icon={<FolderKanban size={16} />}>
          <div className="flex min-h-64 flex-col items-center justify-center text-center text-text-secondary">
            <FolderKanban size={48} className="mb-4 text-text-muted" />
            <p className="max-w-md text-sm">As atualizacoes de status ajudam a acompanhar o progresso dos projetos.</p>
          </div>
        </HomeCard>

        <HomeCard title="Projetos ativos" icon={<Target size={16} />}>
          <div className="mb-3 flex gap-5 border-b border-border text-sm font-bold text-text-secondary">
            <span className="border-b-2 border-text-primary pb-2 text-text-primary">Empresa</span>
            <Link to="/projects" className="pb-2 hover:text-text-primary">Ver todos</Link>
          </div>
          {activeProjects.map((project) => {
            const tasks = project.disciplines?.flatMap((discipline) => discipline.tasks ?? []) ?? [];
            const done = tasks.filter((task) => task.completed).length;
            const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

            return <GoalRow key={project.id} title={project.name} href={`/projects/${project.id}`} progress={progress} />;
          })}
          {!activeProjects.length ? <EmptyState title="Nenhum projeto ativo" /> : null}
        </HomeCard>
      </section>
      <TaskDetail task={selectedTask} onClose={() => setSelectedTask(null)} />
    </div>
  );
}

function HomeCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="min-h-[402px] rounded-md border border-border bg-surface-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xl font-bold text-text-primary">
          {title}
          <span className="text-text-secondary">{icon}</span>
        </h2>
      </div>
      {children}
    </section>
  );
}

function HomeTaskTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active ? "border-b-2 border-text-primary pb-2 text-text-primary" : "pb-2 hover:text-text-primary"}
    >
      {children}
    </button>
  );
}

function TaskMiniList({ tasks, onOpenTask }: { tasks: TaskWithProject[]; onOpenTask: (task: TaskWithProject) => void }) {
  if (!tasks.length) {
    return <EmptyState title="Nenhuma tarefa para mostrar" />;
  }

  return (
    <div className="max-h-[290px] overflow-y-auto pr-1">
      {tasks.map((task) => (
        <button
          key={task.id}
          type="button"
          onClick={() => onOpenTask(task)}
          className="grid w-full grid-cols-[18px_minmax(0,1fr)_auto_auto] items-center gap-2 border-b border-border py-2 text-left text-sm hover:bg-surface-hover"
        >
          <span className="text-text-secondary">
            {task.completed ? <CheckCircle2 size={16} className="text-green-400" /> : <Circle size={16} />}
          </span>
          <span className={cn("truncate font-semibold text-text-primary", task.completed ? "text-text-muted line-through" : "")}>{task.title}</span>
          <span className="max-w-32 truncate rounded bg-surface-hover px-2 py-1 text-xs font-semibold text-text-primary">{task.discipline.projectName}</span>
          <span className={cn("text-xs font-semibold", isOverdue(task) ? "text-red-300" : "text-text-secondary")}>{dateLabel(task.dueDate)}</span>
        </button>
      ))}
    </div>
  );
}

function GoalRow({ title, href, progress }: { title: string; href: string; progress: number }) {
  return (
    <Link to={href} className="mb-2 block rounded-md border border-border px-4 py-3 hover:bg-surface-hover">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-bold text-text-primary">{title}</p>
          <p className="mt-1 text-xs text-text-secondary">mkengenharia.eng.br</p>
        </div>
        <div className="w-36">
          <div className="h-1.5 rounded-full bg-surface-hover">
            <div className="h-1.5 rounded-full bg-text-secondary" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-xs text-text-secondary">{progress}%</p>
        </div>
      </div>
    </Link>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex h-8 items-center gap-2 rounded-md bg-brand-black/75 px-3 text-xs font-bold text-text-secondary">
      {value ? <strong className="text-text-primary">{value}</strong> : null}
      {label}
    </span>
  );
}

function firstName(name: string): string {
  return name.split(" ")[0] ?? name;
}

function isOverdue(task: Task): boolean {
  return Boolean(task.dueDate && !task.completed && isBefore(new Date(task.dueDate), new Date()) && !isToday(new Date(task.dueDate)));
}

function dateLabel(date: string | null): string {
  if (!date) {
    return "Sem data";
  }

  const parsed = new Date(date);
  if (isToday(parsed)) {
    return "Hoje";
  }

  return format(parsed, "d MMM");
}
