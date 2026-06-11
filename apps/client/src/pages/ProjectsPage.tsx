import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { format } from "date-fns";
import { FolderKanban, ListFilter, Pencil, Plus, SlidersHorizontal, X } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { ProjectStatus, type Project, type UpdateProjectRequest } from "shared";
import { toast } from "sonner";
import { ProjectForm } from "../components/project/ProjectForm";
import {
  EditableBuilderField,
  EditableProjectAreaField,
  EditableProjectEndDateField,
  EditableProjectPlatformField,
  EditableProjectStatusField
} from "../components/project/ProjectInlineFields";
import { DataTableContainer, EmptyCell } from "../components/shared/DataTable";
import { ProjectPlatformChip, ProjectStatusChip } from "../components/shared/Chip";
import { EmptyState } from "../components/shared/EmptyState";
import { LoadingSpinner } from "../components/shared/LoadingSpinner";
import { Button } from "../components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { SearchableMultiSelect } from "../components/ui/searchable-multi-select";
import { SearchableSelect } from "../components/ui/searchable-select";
import { useAuth } from "../hooks/useAuth";
import { usePatchProject, useProjects } from "../hooks/useProjects";
import {
  countActiveFilterDimensions,
  defaultBuilderSelection,
  defaultPlatformSelection,
  defaultProjectStatusSelection,
  matchesMultiSelect
} from "../lib/multiSelectFilter";
import { formatProjectArea, projectStatusLabels } from "../lib/projectLabels";
import { canManageTasks } from "../lib/permissions";
import { resolveAsanaColor } from "../lib/utils";

export function ProjectsPage() {
  const { user } = useAuth();
  const { data: projects = [], isLoading } = useProjects();
  const patchProjectMutation = usePatchProject();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [statusFilter, setStatusFilter] = useState<string[]>(defaultProjectStatusSelection);
  const [platformFilter, setPlatformFilter] = useState<string[]>(defaultPlatformSelection);
  const [builderFilter, setBuilderFilter] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState("updatedAt-desc");
  const canManage = canManageTasks(user);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setShowCreateModal(true);
    }
  }, [searchParams]);

  const builderSuggestions = useMemo(
    () =>
      Array.from(new Set(projects.map((project) => project.builder?.trim()).filter((builder): builder is string => Boolean(builder)))).sort(
        (a, b) => a.localeCompare(b, "pt-BR")
      ),
    [projects]
  );

  const statusOptions = useMemo(
    () => Object.values(ProjectStatus).map((status) => ({ value: status, label: projectStatusLabels[status] })),
    []
  );
  const platformOptions = useMemo(
    () => [
      { value: "CAD", label: "CAD" },
      { value: "BIM", label: "BIM" },
      { value: "none", label: "Sem plataforma" }
    ],
    []
  );
  const builderOptions = useMemo(
    () => [
      { value: "none", label: "Sem construtora" },
      ...builderSuggestions.map((builder) => ({ value: builder, label: builder }))
    ],
    [builderSuggestions]
  );

  useEffect(() => {
    if (builderFilter.length === 0 && builderSuggestions.length >= 0) {
      setBuilderFilter(defaultBuilderSelection(builderSuggestions));
    }
  }, [builderFilter.length, builderSuggestions]);

  const activeFilterCount = countActiveFilterDimensions([
    { selected: statusFilter, all: statusOptions.map((option) => option.value) },
    { selected: platformFilter, all: platformOptions.map((option) => option.value) },
    { selected: builderFilter, all: builderOptions.map((option) => option.value) }
  ]);

  const filteredProjects = useMemo(() => {
    const statusSet = new Set(statusFilter);
    const platformSet = new Set(platformFilter);
    const builderSet = new Set(builderFilter);

    const nextProjects = projects
      .filter((project) => matchesMultiSelect(project.status, statusSet))
      .filter((project) => matchesMultiSelect(project.platform ?? "none", platformSet))
      .filter((project) => matchesMultiSelect(project.builder?.trim() || "none", builderSet))
      .slice();

    nextProjects.sort((a, b) => {
      if (sortMode === "name-asc") {
        return a.name.localeCompare(b.name, "pt-BR");
      }

      if (sortMode === "endDate-asc") {
        return String(a.endDate ?? "9999").localeCompare(String(b.endDate ?? "9999"));
      }

      return String(b.updatedAt).localeCompare(String(a.updatedAt));
    });

    return nextProjects;
  }, [builderFilter, platformFilter, projects, sortMode, statusFilter]);

  const patchProject = useCallback(
    (id: string, payload: UpdateProjectRequest) => {
      patchProjectMutation.mutate(
        { id, payload },
        {
          onError: () => {
            toast.error("Não foi possível salvar o projeto");
          }
        }
      );
    },
    [patchProjectMutation]
  );

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
              <p className="text-sm font-semibold uppercase text-brand-orange">Portfólio</p>
              <h1 className="text-2xl font-bold text-text-primary">Projetos ativos</h1>
            </div>
          </div>
          <div className="relative flex flex-wrap items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="secondary" className="h-9">
                  <ListFilter size={16} />
                  Filtrar{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ""}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="grid w-80 gap-3">
                <SearchableMultiSelect
                  values={statusFilter}
                  options={statusOptions}
                  searchPlaceholder="Buscar status..."
                  allSelectedLabel="Todos os status"
                  noneSelectedLabel="Nenhum status"
                  partialSelectedLabel={(count) => `${count} status`}
                  onValuesChange={setStatusFilter}
                />
                <SearchableMultiSelect
                  values={platformFilter}
                  options={platformOptions}
                  searchPlaceholder="Buscar plataforma..."
                  allSelectedLabel="Todas as plataformas"
                  noneSelectedLabel="Nenhuma plataforma"
                  partialSelectedLabel={(count) => `${count} plataformas`}
                  onValuesChange={setPlatformFilter}
                />
                <SearchableMultiSelect
                  values={builderFilter}
                  options={builderOptions}
                  searchPlaceholder="Buscar construtora..."
                  allSelectedLabel="Todas as construtoras"
                  noneSelectedLabel="Nenhuma construtora"
                  partialSelectedLabel={(count) => `${count} construtoras`}
                  onValuesChange={setBuilderFilter}
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
                    { value: "endDate-asc", label: "Entrega mais próxima" }
                  ]}
                  searchPlaceholder="Buscar ordenação..."
                  onValueChange={setSortMode}
                />
              </PopoverContent>
            </Popover>
            {canManage ? (
              <Button className="h-9" onClick={() => setShowCreateModal(true)}>
                <Plus size={16} />
                Adicionar projeto
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {showCreateModal && canManage ? (
        <ProjectModal title="Adicionar projeto" onClose={() => closeCreateModal(searchParams, setSearchParams, setShowCreateModal)}>
          <ProjectForm
            builderSuggestions={builderSuggestions}
            onCancel={() => closeCreateModal(searchParams, setSearchParams, setShowCreateModal)}
            onCreated={() => closeCreateModal(searchParams, setSearchParams, setShowCreateModal)}
          />
        </ProjectModal>
      ) : null}

      {editingProject && canManage ? (
        <ProjectModal title="Editar projeto" onClose={() => setEditingProject(null)}>
          <ProjectForm
            project={normalizeProjectSections(editingProject)}
            builderSuggestions={builderSuggestions}
            onCancel={() => setEditingProject(null)}
            onSaved={() => setEditingProject(null)}
          />
        </ProjectModal>
      ) : null}

      <ProjectsPortfolioTable
        projects={filteredProjects}
        canManage={canManage}
        builderSuggestions={builderSuggestions}
        onEditProject={setEditingProject}
        onPatchProject={patchProject}
      />
      {filteredProjects.length === 0 ? <EmptyState title="Nenhum projeto encontrado" /> : null}
    </div>
  );
}

function ProjectsPortfolioTable({
  projects,
  canManage,
  builderSuggestions,
  onEditProject,
  onPatchProject
}: {
  projects: Project[];
  canManage: boolean;
  builderSuggestions: string[];
  onEditProject: (project: Project) => void;
  onPatchProject: (id: string, payload: UpdateProjectRequest) => void;
}) {
  return (
    <DataTableContainer>
      <table className="w-full min-w-[1040px] table-fixed border-collapse bg-[--bg-2] text-sm">
        <thead className="sticky top-0 z-10 bg-[--bg-1] text-left">
          <tr className="border-b border-[--color-border]">
            <th className="w-[320px] px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-[--color-text-muted]">Nome</th>
            <th className="w-[180px] px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-[--color-text-muted]">Construtora</th>
            <th className="w-[130px] px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-[--color-text-muted]">Plataforma</th>
            <th className="w-[130px] px-3 py-2 text-right text-[11px] font-medium uppercase tracking-widest text-[--color-text-muted]">Área</th>
            <th className="w-[150px] px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-[--color-text-muted]">Status</th>
            <th className="w-[120px] px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-[--color-text-muted]">Tarefas</th>
            <th className="w-[150px] px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-[--color-text-muted]">Entrega</th>
            <th className="w-[150px] px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-[--color-text-muted]">Atualizado</th>
            {canManage ? (
              <th className="w-[90px] px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-[--color-text-muted]">Editar</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => {
            const taskCount =
              (project.sections ?? project.disciplines)?.reduce((total, discipline) => total + (discipline.tasks?.length ?? 0), 0) ?? 0;
            const iconTokens = resolveAsanaColor(project.color ?? "");

            return (
              <tr key={project.id} className="border-b border-[--color-border-subtle] transition-colors hover:bg-[--bg-3]">
                <td className="px-3 py-2">
                  <Link to={`/projects/${project.id}`} className="flex items-center gap-3 font-semibold text-text-primary">
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                      style={{ backgroundColor: iconTokens.bg, color: iconTokens.text }}
                    >
                      <FolderKanban size={16} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 truncate">{project.name}</span>
                  </Link>
                </td>
                <td className="px-3 py-2 text-[13px] text-[--color-text-primary]">
                  {canManage ? (
                    <EditableBuilderField
                      value={project.builder}
                      suggestions={builderSuggestions}
                      variant="table"
                      onSave={(builder) => {
                        const normalized = builder?.trim() || null;
                        onPatchProject(project.id, { builder: normalized, client: normalized });
                      }}
                    />
                  ) : project.builder ? (
                    <span className="block truncate" title={project.builder}>
                      {project.builder}
                    </span>
                  ) : (
                    <EmptyCell />
                  )}
                </td>
                <td className="px-3 py-2 text-[13px] text-[--color-text-primary]">
                  {canManage ? (
                    <EditableProjectPlatformField
                      value={project.platform}
                      variant="table"
                      onSave={(platform) => onPatchProject(project.id, { platform })}
                    />
                  ) : project.platform ? (
                    <ProjectPlatformChip platform={project.platform} />
                  ) : (
                    <EmptyCell />
                  )}
                </td>
                <td className="px-3 py-2 text-right text-[13px] text-[--color-text-primary]">
                  {canManage ? (
                    <EditableProjectAreaField
                      value={project.areaM2}
                      variant="table"
                      onSave={(areaM2) => onPatchProject(project.id, { areaM2 })}
                    />
                  ) : (
                    <span className="font-mono text-[12px] text-[--color-text-secondary]">{formatProjectArea(project.areaM2)}</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {canManage ? (
                    <EditableProjectStatusField
                      value={project.status}
                      variant="table"
                      onSave={(status) => onPatchProject(project.id, { status })}
                    />
                  ) : (
                    <ProjectStatusChip status={project.status} />
                  )}
                </td>
                <td className="px-3 py-2 text-[13px] text-[--color-text-secondary]">{taskCount}</td>
                <td className="px-3 py-2 text-[13px] text-[--color-text-primary]">
                  {canManage ? (
                    <EditableProjectEndDateField
                      value={project.endDate}
                      variant="table"
                      onSave={(endDate) => onPatchProject(project.id, { endDate })}
                    />
                  ) : project.endDate ? (
                    format(new Date(project.endDate), "dd/MM/yyyy")
                  ) : (
                    <EmptyCell />
                  )}
                </td>
                <td className="px-3 py-2 text-[13px] text-[--color-text-secondary]">{format(new Date(project.updatedAt), "dd/MM/yyyy")}</td>
                {canManage ? (
                  <td className="px-3 py-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 w-8 px-0 text-text-secondary hover:text-brand-orange"
                      onClick={() => onEditProject(project)}
                      title="Editar projeto"
                      aria-label="Editar projeto"
                    >
                      <Pencil size={16} />
                    </Button>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </DataTableContainer>
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
          <Button variant="ghost" className="h-9 w-9 px-0" onClick={onClose} title="Fechar" aria-label="Fechar">
            <X size={18} />
          </Button>
        </div>
        {children}
      </section>
    </div>
  );
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
