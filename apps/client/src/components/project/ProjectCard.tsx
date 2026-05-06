import { FolderKanban } from "lucide-react";
import { Link } from "react-router-dom";
import type { Project } from "shared";
import { Badge } from "../ui/badge";

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const taskCount = project.disciplines?.reduce((total, discipline) => total + (discipline.tasks?.length ?? 0), 0) ?? 0;

  return (
    <Link
      to={`/projects/${project.id}`}
      className="block rounded-md border border-border bg-surface-card p-4 transition hover:border-brand-orange hover:bg-surface-hover"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-orange text-brand-white">
            <FolderKanban size={20} />
          </span>
          <div>
            <h3 className="font-semibold text-text-primary">{project.name}</h3>
            <p className="mt-1 text-sm text-text-secondary">{project.client ?? "Sem cliente"}</p>
          </div>
        </div>
        <Badge tone="orange">{project.status}</Badge>
      </div>
      <div className="mt-4 flex items-center gap-4 text-sm text-text-secondary">
        <span>{project.disciplines?.length ?? 0} disciplinas</span>
        <span>{taskCount} tarefas</span>
      </div>
    </Link>
  );
}
