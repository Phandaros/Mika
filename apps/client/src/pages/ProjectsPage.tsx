import { useEffect, useMemo, useState, type ReactNode } from "react";
import { format } from "date-fns";
import { FolderKanban, ListFilter, Pencil, Plus, SlidersHorizontal, X } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { ProjectStatus, type Project } from "shared";
import { ProjectForm } from "../components/project/ProjectForm";
import { EmptyState } from "../components/shared/EmptyState";
import { LoadingSpinner } from "../components/shared/LoadingSpinner";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { SearchableSelect } from "../components/ui/searchable-select";
import { useProjects } from "../hooks/useProjects";

export function ProjectsPage() {
  const { data: projects = [], isLoading } = useProjects();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [sortMode, setSortMode] = useState("updatedAt-desc");

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setShowCreateModal(true);
    }
  }, [searchParams]);

  const builderSuggestions = useMemo(
    () =>
      Array.from(
        new Set(projects.map((project) => projectBuilder(project)).filter((builder): builder is string => Boolean(builder)))
      ).sort(),
    [projects]
  );

  const filteredProjects = useMemo(() => {
    const nextProjects = projects
      .filter((project) => statusFilter === "all" || project.status === statusFilter)
      .filter((project) => platformFilter === "all" || (platformFilter === "none" ? !project.platform : project.platform === platformFilter))
      .slice();

    nextProjects.sort((a, b) => {
      if (sortMode === "name-asc") {
        return a.name.localeCompare(b.name);
      }

      if (sortMode === "endDate-asc") {
        return String(a.endDate ?? "9999").localeCompare(String(b.endDate ?? "9999"));
      }

      return String(b.updatedAt).localeCompare(String(a.updatedAt));
    });

    return nextProjects;
  }, [platformFilter, projects, sortMode, statusFilter]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="grid gap-6">
      <div className="border-b border-border pb-4">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-orange text-brand-white">
              <FolderKanban size={20} />
            </span>
            <div>
              <p className="text-sm font-semibold uppercase text-brand-orange">Portfolio</p>
              <h1 className="text-2xl font-bold text-text-primary">Projetos Ativos</h1>
            </div>
          </div>
          <div className="relative flex flex-wrap items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="secondary" className="h-9">
                  <ListFilter size={16} />
                  Filtrar
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="grid w-80 gap-3">
                <SearchableSelect
                  value={statusFilter}
                  options={[
                    { value: "all", label: "Todos os status" },
                    ...Object.values(ProjectStatus).map((status) => ({ value: status, label: status }))
                  ]}
                  searchPlaceholder="Buscar status..."
                  onValueChange={setStatusFilter}
                />
                <SearchableSelect
                  value={platformFilter}
                  options={[
                    { value: "all", label: "Todas as plataformas" },
                    { value: "CAD", label: "CAD" },
                    { value: "BIM", label: "BIM" },
                    { value: "none", label: "Sem plataforma" }
                  ]}
                  searchPlaceholder="Buscar plataforma..."
                  onValueChange={setPlatformFilter}
                />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="secondary" className="h-9">
                  <SlidersHorizontal size={16} />
                  Organizar
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="grid w-64 gap-3">
                <SearchableSelect
                  value={sortMode}
                  options={[
                    { value: "updatedAt-desc", label: "Atualizados recentemente" },
                    { value: "name-asc", label: "Nome A-Z" },
                    { value: "endDate-asc", label: "Entrega mais proxima" }
                  ]}
                  searchPlaceholder="Buscar ordenação..."
                  onValueChange={setSortMode}
                />
              </PopoverContent>
            </Popover>
            <Button className="h-9" onClick={() => setShowCreateModal(true)}>
              <Plus size={16} />
              Adicionar projeto
            </Button>
          </div>
        </div>
      </div>

      {showCreateModal ? (
        <ProjectModal title="Adicionar projeto" onClose={() => closeCreateModal(searchParams, setSearchParams, setShowCreateModal)}>
          <ProjectForm
            builderSuggestions={builderSuggestions}
            onCancel={() => closeCreateModal(searchParams, setSearchParams, setShowCreateModal)}
            onCreated={() => closeCreateModal(searchParams, setSearchParams, setShowCreateModal)}
          />
        </ProjectModal>
      ) : null}

      {editingProject ? (
        <ProjectModal title="Editar projeto" onClose={() => setEditingProject(null)}>
          <ProjectForm
            project={normalizeProjectSections(editingProject)}
            builderSuggestions={builderSuggestions}
            onCancel={() => setEditingProject(null)}
            onSaved={() => setEditingProject(null)}
          />
        </ProjectModal>
      ) : null}

      <ProjectsPortfolioTable projects={filteredProjects} onEditProject={setEditingProject} />
      {filteredProjects.length === 0 ? <EmptyState title="Nenhum projeto encontrado" /> : null}
    </div>
  );
}

function ProjectsPortfolioTable({ projects, onEditProject }: { projects: Project[]; onEditProject: (project: Project) => void }) {
  return (
    <div className="overflow-auto rounded-md border border-border">
      <table className="w-full min-w-[900px] border-collapse bg-surface-card text-sm">
        <thead className="bg-surface text-left text-text-secondary">
          <tr>
            <th className="w-[360px] border-r border-border p-3 font-semibold">Nome</th>
            <th className="w-[130px] border-r border-border p-3 font-semibold">Plataforma</th>
            <th className="w-[130px] border-r border-border p-3 font-semibold">Área</th>
            <th className="w-[150px] border-r border-border p-3 font-semibold">Status</th>
            <th className="w-[120px] border-r border-border p-3 font-semibold">Tarefas</th>
            <th className="w-[150px] border-r border-border p-3 font-semibold">Entrega</th>
            <th className="w-[150px] border-r border-border p-3 font-semibold">Atualizado</th>
            <th className="w-[90px] p-3 font-semibold">Editar</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => {
            const taskCount =
              (project.sections ?? project.disciplines)?.reduce((total, discipline) => total + (discipline.tasks?.length ?? 0), 0) ?? 0;
            return (
              <tr key={project.id} className="border-t border-border hover:bg-surface-hover">
                <td className="border-r border-border p-3">
                  <Link to={`/projects/${project.id}`} className="flex items-center gap-3 font-semibold text-text-primary">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-hover text-text-secondary">
                      <FolderKanban size={16} />
                    </span>
                    {project.name}
                  </Link>
                </td>
                <td className="border-r border-border p-3 text-text-secondary">
                  {project.platform ? <Badge tone="muted">{project.platform}</Badge> : "-"}
                </td>
                <td className="border-r border-border p-3 text-text-secondary">{formatArea(project.areaM2)}</td>
                <td className="border-r border-border p-3">
                  <Badge tone="orange">{project.status}</Badge>
                </td>
                <td className="border-r border-border p-3 text-text-secondary">{taskCount}</td>
                <td className="border-r border-border p-3 text-text-secondary">
                  {project.endDate ? format(new Date(project.endDate), "dd/MM/yyyy") : "-"}
                </td>
                <td className="border-r border-border p-3 text-text-secondary">{format(new Date(project.updatedAt), "dd/MM/yyyy")}</td>
                <td className="p-3">
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 w-8 px-0 text-text-secondary hover:text-brand-orange"
                    onClick={() => onEditProject(project)}
                    title="Editar projeto"
                  >
                    <Pencil size={16} />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function normalizeProjectSections(project: Project): Project {
  return {
    ...project,
    disciplines: project.disciplines ?? project.sections ?? []
  };
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

function projectBuilder(project: Project): string | null {
  return project.builder ?? project.client ?? null;
}

function formatArea(areaM2: number | null): string {
  if (areaM2 === null) {
    return "-";
  }

  return `${areaM2.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} m²`;
}

function closeCreateModal(
  searchParams: URLSearchParams,
  setSearchParams: (params: URLSearchParams, options?: { replace?: boolean }) => void,
  setShowCreateModal: (value: boolean) => void
) {
  const nextParams = new URLSearchParams(searchParams);
  nextParams.delete("new");
  setSearchParams(nextParams, { replace: true });
  setShowCreateModal(false);
}
