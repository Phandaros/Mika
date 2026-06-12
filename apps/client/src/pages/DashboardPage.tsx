import { useMemo, useState } from "react";
import { format, isBefore, isThisWeek, isToday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { CheckCircle2, Circle, FolderKanban, Target, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { type Task } from "shared";
import { EmptyState } from "../components/shared/EmptyState";
import { LoadingSpinner } from "../components/shared/LoadingSpinner";
import { TaskContextMenu } from "../components/task/TaskContextMenu";
import { TaskDetail } from "../components/task/TaskDetail";
import { useAuth } from "../hooks/useAuth";
import { useProjects } from "../hooks/useProjects";
import { useRecentActivity } from "../hooks/useRecentActivity";
import { cn, dateOnlyToLocalDate, formatDateOnly } from "../lib/utils";

type TaskWithProject = Task & {
  discipline: {
    id: string;
    name: string;
    projectId: string;
    projectName: string;
  };
};

function sectionsOf(project: { sections?: unknown[]; disciplines?: unknown[] }) {
  return (project.sections ?? project.disciplines ?? []) as Array<{
    id: string;
    name: string;
    tasks?: Task[];
  }>;
}

function greetingLabel(): string {
  const h = new Date().getHours();
  if (h < 12) {
    return "Bom dia";
  }
  if (h < 18) {
    return "Boa tarde";
  }
  return "Boa noite";
}

export function DashboardPage() {
  const { user } = useAuth();
  const { data: projects = [], isLoading } = useProjects();
  const { data: activities = [], isLoading: activityLoading } = useRecentActivity();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskDetailOpenVersion, setTaskDetailOpenVersion] = useState(0);
  const [homeTaskTab, setHomeTaskTab] = useState<"next" | "overdue" | "done">("overdue");

  const myTasks = useMemo(
    () =>
      projects.flatMap((project) =>
        sectionsOf(project).flatMap((section) =>
          (section.tasks ?? [])
            .filter((task) => task.assigneeId === user?.id)
            .map((task) => ({
              ...task,
              discipline: {
                id: section.id,
                name: section.name,
                projectId: project.id,
                projectName: project.name
              }
            }))
        )
      ),
    [projects, user?.id]
  );

  const overdueTasks = myTasks.filter((task) => isOverdue(task));
  const nextTasks = myTasks.filter((task) => !task.completed && !overdueTasks.some((item) => item.id === task.id)).slice(0, 7);
  const completedTasks = myTasks.filter((task) => task.completed);
  const completedThisWeek = completedTasks.filter((task) => {
    if (!task.completedAt) {
      return false;
    }
    try {
      return isThisWeek(parseISO(task.completedAt), { weekStartsOn: 1 });
    } catch {
      return false;
    }
  }).length;
  const assignedOpen = myTasks.filter((t) => !t.completed).length;
  const homeTasks = homeTaskTab === "overdue" ? overdueTasks.slice(0, 7) : homeTaskTab === "done" ? completedTasks.slice(0, 7) : nextTasks;
  const activeProjects = projects.filter((project) => project.status === "ACTIVE").slice(0, 3);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  function openTaskDetail(task: Task) {
    setTaskDetailOpenVersion((version) => version + 1);
    setSelectedTask(task);
  }

  return (
    <div className="mx-auto grid max-w-[1200px] gap-4">
      <section className="rounded-md border border-border bg-[radial-gradient(circle_at_20%_0%,rgba(255,102,0,0.14),transparent_32%),linear-gradient(135deg,#1a1818,#0f0f0f_55%,#0a0a0a)] p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-semibold text-text-secondary">{format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-text-primary">
              {greetingLabel()}, {firstName(user?.name ?? "usuario")}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <MetricPill label="Atribuidas (abertas)" value={String(assignedOpen)} />
            <MetricPill label="Concluídas esta semana" value={String(completedThisWeek)} />
            <MetricPill label="Atrasadas" value={String(overdueTasks.length)} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <HomeCard title="Minhas tarefas" icon={<UserRound size={16} />}>
          <div className="mb-3 flex gap-5 border-b border-border text-sm font-bold text-text-secondary">
            <HomeTaskTab active={homeTaskTab === "next"} onClick={() => setHomeTaskTab("next")}>
              Proximas
            </HomeTaskTab>
            <HomeTaskTab active={homeTaskTab === "overdue"} onClick={() => setHomeTaskTab("overdue")}>
              Atrasadas ({overdueTasks.length})
            </HomeTaskTab>
            <HomeTaskTab active={homeTaskTab === "done"} onClick={() => setHomeTaskTab("done")}>
              Concluídas
            </HomeTaskTab>
          </div>
          <TaskMiniList tasks={homeTasks} onOpenTask={openTaskDetail} />
          <Link to="/my-tasks" className="mt-3 inline-flex text-sm font-semibold text-brand-orange hover:text-orange-400">
            Abrir minhas tarefas
          </Link>
        </HomeCard>

        <HomeCard title="Atividade recente" icon={<FolderKanban size={16} />}>
          {activityLoading ? (
            <p className="text-sm text-text-muted">Carregando...</p>
          ) : activities.length === 0 ? (
            <EmptyState title="Sem atividade recente" />
          ) : (
            <ul className="max-h-[320px] space-y-2 overflow-y-auto pr-1 text-sm">
              {activities.slice(0, 12).map((item) => (
                <li key={item.id} className="rounded-md border border-border bg-surface-hover/40 px-3 py-2">
                  <p className="font-semibold text-text-primary">{item.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-text-secondary">{item.subtitle}</p>
                  <p className="mt-1 text-xs text-text-muted">{format(parseISO(item.at), "dd/MM HH:mm")}</p>
                </li>
              ))}
            </ul>
          )}
        </HomeCard>

        <HomeCard title="Projetos ativos" icon={<Target size={16} />}>
          <div className="mb-3 flex gap-5 border-b border-border text-sm font-bold text-text-secondary">
            <span className="border-b-2 border-text-primary pb-2 text-text-primary">Resumo</span>
            <Link to="/projects" className="pb-2 hover:text-text-primary">
              Ver todos
            </Link>
          </div>
          {activeProjects.map((project) => {
            const tasks = sectionsOf(project).flatMap((section) => section.tasks ?? []);
            const done = tasks.filter((task) => task.completed).length;
            const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

            return <GoalRow key={project.id} title={project.name} subtitle={project.client} href={`/projects/${project.id}`} progress={progress} />;
          })}
          {!activeProjects.length ? <EmptyState title="Nenhum projeto ativo" /> : null}
        </HomeCard>
      </section>
      <TaskDetail
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onOpenTask={openTaskDetail}
        openVersion={taskDetailOpenVersion}
      />
    </div>
  );
}

function HomeCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="min-h-[320px] rounded-md border border-border bg-surface-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-text-primary">
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
        <TaskContextMenu
          key={task.id}
          task={task}
          projectId={task.discipline.projectId}
          onOpen={onOpenTask}
          fallbackLinkPath="/"
        >
          <button
            type="button"
            onClick={() => onOpenTask(task)}
            className="grid w-full grid-cols-[18px_minmax(0,1fr)_auto_auto] items-center gap-2 border-b border-border py-2 text-left text-sm hover:bg-surface-hover"
          >
            <span className="text-text-secondary">
              {task.completed ? <CheckCircle2 size={16} className="text-green-400" /> : <Circle size={16} />}
            </span>
            <span className={cn("truncate font-semibold", task.completed ? "text-text-muted" : "text-text-primary")}>{task.title}</span>
            <span className="max-w-32 truncate rounded bg-surface-hover px-2 py-1 text-xs font-semibold text-text-primary">{task.discipline.projectName}</span>
            <span className={cn("text-xs font-semibold", isOverdue(task) ? "text-red-300" : "text-text-secondary")}>{dateLabel(task.dueDate)}</span>
          </button>
        </TaskContextMenu>
      ))}
    </div>
  );
}

function GoalRow({ title, subtitle, href, progress }: { title: string; subtitle: string | null | undefined; href: string; progress: number }) {
  return (
    <Link to={href} className="mb-2 block rounded-md border border-border px-4 py-3 hover:bg-surface-hover">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-bold text-text-primary">{title}</p>
          {subtitle ? <p className="mt-1 text-xs text-text-secondary">{subtitle}</p> : null}
        </div>
        <div className="w-36">
          <div className="h-1.5 rounded-full bg-surface-hover">
            <div className="h-1.5 rounded-full bg-brand-orange/80" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-xs text-text-secondary">{progress}%</p>
        </div>
      </div>
    </Link>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-surface-hover/60 px-3 text-xs font-semibold text-text-secondary">
      <strong className="text-text-primary">{value}</strong>
      {label}
    </span>
  );
}

function firstName(name: string): string {
  return name.split(" ")[0] ?? name;
}

function isOverdue(task: Task): boolean {
  const dueDate = dateOnlyToLocalDate(task.dueDate);
  return Boolean(dueDate && !task.completed && isBefore(dueDate, new Date()) && !isToday(dueDate));
}

function dateLabel(date: string | null): string {
  if (!date) {
    return "Sem data";
  }

  const parsed = dateOnlyToLocalDate(date);
  if (!parsed) {
    return "Sem data";
  }

  if (isToday(parsed)) {
    return "Hoje";
  }

  return formatDateOnly(date, "d MMM");
}
