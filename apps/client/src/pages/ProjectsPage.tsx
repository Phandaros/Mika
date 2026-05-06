import { ProjectCard } from "../components/project/ProjectCard";
import { ProjectForm } from "../components/project/ProjectForm";
import { EmptyState } from "../components/shared/EmptyState";
import { LoadingSpinner } from "../components/shared/LoadingSpinner";
import { useProjects } from "../hooks/useProjects";

export function ProjectsPage() {
  const { data: projects = [], isLoading } = useProjects();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm font-semibold uppercase text-brand-orange">Portfolio</p>
        <h1 className="mt-1 text-3xl font-bold text-text-primary">Projetos</h1>
      </div>
      <ProjectForm />
      <div className="grid gap-4 lg:grid-cols-2">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
      {projects.length === 0 ? <EmptyState title="Nenhum projeto cadastrado" /> : null}
    </div>
  );
}
