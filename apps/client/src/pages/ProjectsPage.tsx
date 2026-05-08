import { useMemo, useState, type ReactNode } from "react";
import { format } from "date-fns";
import { ExternalLink, FolderKanban, ListFilter, Plus, SlidersHorizontal, X } from "lucide-react";
import { Link } from "react-router-dom";
import { getDefaultDiscipline, ProjectStatus, type Project } from "shared";
import { ProjectForm } from "../components/project/ProjectForm";
import { EmptyState } from "../components/shared/EmptyState";
import { LoadingSpinner } from "../components/shared/LoadingSpinner";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Select } from "../components/ui/select";
import { useProjects } from "../hooks/useProjects";

export function ProjectsPage() {
  const { data: projects = [], isLoading } = useProjects();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [builderFilter, setBuilderFilter] = useState("all");
  const [sortMode, setSortMode] = useState("updatedAt-desc");

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
      .filter((project) => builderFilter === "all" || projectBuilder(project) === builderFilter)
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
  }, [builderFilter, projects, sortMode, statusFilter]);

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
            <div className="relative">
              <Button variant="secondary" className="h-9" onClick={() => setShowFilters((current) => !current)}>
                <ListFilter size={16} />
                Filtrar
              </Button>
              {showFilters ? (
                <div className="absolute right-0 top-11 z-30 grid w-80 gap-3 rounded-md border border-border bg-surface-card p-4 shadow-2xl">
                  <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <option value="all">Todos os status</option>
                    {Object.values(ProjectStatus).map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </Select>
                  <Select value={builderFilter} onChange={(event) => setBuilderFilter(event.target.value)}>
                    <option value="all">Todas as equipes/workspaces</option>
                    {builderSuggestions.map((builder) => (
                      <option key={builder} value={builder}>
                        {builder}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : null}
            </div>
            <div className="relative">
              <Button variant="secondary" className="h-9" onClick={() => setShowOptions((current) => !current)}>
                <SlidersHorizontal size={16} />
                Organizar
              </Button>
              {showOptions ? (
                <div className="absolute right-0 top-11 z-30 grid w-64 gap-3 rounded-md border border-border bg-surface-card p-4 shadow-2xl">
                  <Select value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
                    <option value="updatedAt-desc">Atualizados recentemente</option>
                    <option value="name-asc">Nome A-Z</option>
                    <option value="endDate-asc">Entrega mais próxima</option>
                  </Select>
                </div>
              ) : null}
            </div>
            <Button className="h-9" onClick={() => setShowCreateModal(true)}>
              <Plus size={16} />
              Adicionar projeto
            </Button>
          </div>
        </div>
      </div>

      {showCreateModal ? (
        <ProjectModal title="Adicionar projeto" onClose={() => setShowCreateModal(false)}>
          <ProjectForm
            builderSuggestions={builderSuggestions}
            onCancel={() => setShowCreateModal(false)}
            onCreated={() => setShowCreateModal(false)}
          />
        </ProjectModal>
      ) : null}

      <ProjectsPortfolioTable projects={filteredProjects} />
      {filteredProjects.length === 0 ? <EmptyState title="Nenhum projeto encontrado" /> : null}
    </div>
  );
}

function ProjectsPortfolioTable({ projects }: { projects: Project[] }) {
  return (
    <div className="overflow-auto rounded-md border border-border">
        <table className="w-full min-w-[1280px] border-collapse bg-surface-card text-sm">
        <thead className="bg-surface text-left text-text-secondary">
          <tr>
            <th className="w-[320px] border-r border-border p-3 font-semibold">Nome</th>
            <th className="w-[180px] border-r border-border p-3 font-semibold">Equipe</th>
            <th className="w-[180px] border-r border-border p-3 font-semibold">Responsável</th>
            <th className="w-[150px] border-r border-border p-3 font-semibold">Status</th>
            <th className="w-[260px] border-r border-border p-3 font-semibold">Campos</th>
            <th className="w-[360px] border-r border-border p-3 font-semibold">Seções</th>
            <th className="w-[120px] border-r border-border p-3 font-semibold">Tarefas</th>
            <th className="w-[150px] border-r border-border p-3 font-semibold">Entrega</th>
            <th className="w-[150px] border-r border-border p-3 font-semibold">Atualizado</th>
            <th className="w-[90px] p-3 font-semibold">Asana</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => {
            const taskCount =
              project.disciplines?.reduce((total, discipline) => total + (discipline.tasks?.length ?? 0), 0) ?? 0;
            const visibleDisciplines = project.disciplines?.slice(0, 3) ?? [];
            const hiddenDisciplinesCount = Math.max((project.disciplines?.length ?? 0) - visibleDisciplines.length, 0);

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
                <td className="border-r border-border p-3 text-text-secondary">{projectBuilder(project) ?? "-"}</td>
                <td className="border-r border-border p-3 text-text-secondary">{project.owner?.name ?? "-"}</td>
                <td className="border-r border-border p-3">
                  <Badge tone="orange">{project.status}</Badge>
                </td>
                <td className="border-r border-border p-3">
                  <div className="flex flex-wrap gap-1.5">
                    {project.customFields?.slice(0, 4).map((field) => (
                      <Badge key={field.id} tone={field.isImportant ? "orange" : "muted"}>{field.name}</Badge>
                    ))}
                    {(project.customFields?.length ?? 0) > 4 ? <Badge tone="muted">Mais {(project.customFields?.length ?? 0) - 4}</Badge> : null}
                    {!project.customFields?.length ? <span className="text-text-muted">-</span> : null}
                  </div>
                </td>
                <td className="border-r border-border p-3">
                  <div className="flex flex-wrap gap-2">
                    {visibleDisciplines.map((discipline) => {
                      const catalogItem = getDefaultDiscipline(discipline.type);

                      return (
                        <span
                          key={discipline.id}
                          className="inline-flex h-7 items-center rounded-md px-2 text-xs font-semibold text-brand-black"
                          style={{ backgroundColor: catalogItem.color }}
                        >
                          {discipline.name}
                        </span>
                      );
                    })}
                    {hiddenDisciplinesCount > 0 ? <Badge tone="muted">Mais {hiddenDisciplinesCount}</Badge> : null}
                  </div>
                </td>
                <td className="border-r border-border p-3 text-text-secondary">{taskCount}</td>
                <td className="border-r border-border p-3 text-text-secondary">
                  {project.endDate ? format(new Date(project.endDate), "dd/MM/yyyy") : "-"}
                </td>
                <td className="border-r border-border p-3 text-text-secondary">{format(new Date(project.updatedAt), "dd/MM/yyyy")}</td>
                <td className="p-3">
                  {project.permalinkUrl ? (
                    <a
                      href={project.permalinkUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition hover:bg-surface hover:text-brand-orange"
                      title="Abrir no Asana"
                    >
                      <ExternalLink size={16} />
                    </a>
                  ) : (
                    <span className="text-text-muted">-</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
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
