import { useAuth } from "../hooks/useAuth";
import { useProjects } from "../hooks/useProjects";
import { EmptyState } from "../components/shared/EmptyState";
import { LoadingSpinner } from "../components/shared/LoadingSpinner";
import { TaskCard } from "../components/task/TaskCard";

export function MyTasksPage() {
  const { user } = useAuth();
  const { data: projects = [], isLoading } = useProjects();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const myTasks = projects.flatMap((project) =>
    project.disciplines?.flatMap((discipline) =>
      (discipline.tasks ?? [])
        .filter((task) => task.assigneeId === user?.id)
        .map((task) => ({ ...task, discipline: { id: discipline.id, name: discipline.name, projectId: project.id } }))
    ) ?? []
  );

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm font-semibold uppercase text-brand-orange">Execução</p>
        <h1 className="mt-1 text-3xl font-bold text-text-primary">Minhas tarefas</h1>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {myTasks.map((task) => (
          <TaskCard key={task.id} task={task} disciplineName={task.discipline.name} />
        ))}
      </div>
      {myTasks.length === 0 ? <EmptyState title="Você não possui tarefas atribuídas" /> : null}
    </div>
  );
}
