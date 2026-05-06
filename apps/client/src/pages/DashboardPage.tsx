import { Link } from "react-router-dom";
import { ProjectStatus } from "shared";
import { useAuth } from "../hooks/useAuth";
import { useProjects } from "../hooks/useProjects";
import { EmptyState } from "../components/shared/EmptyState";
import { LoadingSpinner } from "../components/shared/LoadingSpinner";
import { ProjectCard } from "../components/project/ProjectCard";
import { TaskCard } from "../components/task/TaskCard";

export function DashboardPage() {
  const { user } = useAuth();
  const { data: projects = [], isLoading } = useProjects();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const activeProjects = projects.filter((project) => project.status === ProjectStatus.ACTIVE);
  const myTasks = projects.flatMap((project) =>
    project.disciplines?.flatMap((discipline) =>
      (discipline.tasks ?? [])
        .filter((task) => task.assigneeId === user?.id)
        .map((task) => ({ ...task, discipline: { id: discipline.id, name: discipline.name, projectId: project.id } }))
    ) ?? []
  );

  return (
    <div className="grid gap-8">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-semibold uppercase text-brand-orange">Visao geral</p>
          <h1 className="mt-1 text-3xl font-bold text-text-primary">Dashboard</h1>
        </div>
        <Link
          to="/projects"
          className="inline-flex h-10 items-center justify-center rounded-md bg-brand-orange px-4 text-sm font-semibold text-brand-white transition hover:bg-orange-600"
        >
          Ver projetos
        </Link>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-text-primary">Projetos ativos</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {activeProjects.slice(0, 4).map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
        {activeProjects.length === 0 ? <EmptyState title="Nenhum projeto ativo" /> : null}
      </section>
      <section>
        <h2 className="text-lg font-semibold text-text-primary">Minhas tarefas</h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {myTasks.slice(0, 6).map((task) => (
            <TaskCard key={task.id} task={task} disciplineName={task.discipline.name} />
          ))}
        </div>
        {myTasks.length === 0 ? <EmptyState title="Voce nao possui tarefas atribuidas" /> : null}
      </section>
    </div>
  );
}
