import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FolderKanban, ListFilter, Pencil, Plus, SlidersHorizontal, X } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ProjectStatus,
  type PortfolioProjectSort,
  type Project,
  type ProjectCustomFieldValue,
  type UpdateProjectRequest
} from "shared";
import { toast } from "sonner";
import { ProjectForm } from "../components/project/ProjectForm";
import {
  EditableBuilderField,
  EditableProjectAreaField,
  EditableProjectEnumField,
  EditableProjectMultiEnumField,
  EditableProjectPlatformField
} from "../components/project/ProjectInlineFields";
import { ProjectEnumChip, ProjectMultiEnumChips, ProjectPortfolioNumberValue } from "../components/project/ProjectPortfolioChips";
import { DataTableContainer, EmptyCell } from "../components/shared/DataTable";
import { ProjectPlatformChip } from "../components/shared/Chip";
import { EmptyState } from "../components/shared/EmptyState";
import { LoadingSpinner } from "../components/shared/LoadingSpinner";
import { Button } from "../components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { SearchableMultiSelect } from "../components/ui/searchable-multi-select";
import { SearchableSelect } from "../components/ui/searchable-select";
import { useAuth } from "../hooks/useAuth";
import { usePatchProject, usePortfolioFacets, usePortfolioProjectsInfinite } from "../hooks/useProjects";
import {
  countActiveFilterDimensions,
  defaultBuilderSelection,
  defaultPlatformSelection,
  defaultProjectStatusSelection,
  isAllSelected
} from "../lib/multiSelectFilter";
import { formatProjectArea, projectStatusLabels } from "../lib/projectLabels";
import { canManageTasks } from "../lib/permissions";
import { buildProjectCustomFieldPatch, isProjectCustomFieldPatchValid, portfolioFieldLabels, projectCustomField } from "../lib/portfolioFields";
import { resolveMutationErrorMessage } from "../lib/mutationErrors";
import { resolveAsanaColor } from "../lib/utils";

const ALL_PLATFORM_VALUES = ["CAD", "BIM", "none"] as const;

export function ProjectsPage() {
  const { user } = useAuth();
  const { data: builderSuggestions = [], isLoading: facetsLoading } = usePortfolioFacets();
  const patchProjectMutation = usePatchProject();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [statusFilter, setStatusFilter] = useState<string[]>(defaultProjectStatusSelection);
  const [platformFilter, setPlatformFilter] = useState<string[]>(defaultPlatformSelection);
  const [builderFilter, setBuilderFilter] = useState<string[]>([]);
  const builderFilterInitializedRef = useRef(false);
  const [sortMode, setSortMode] = useState<PortfolioProjectSort>("updatedAt-desc");
  const canManage = canManageTasks(user);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setShowCreateModal(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (builderFilterInitializedRef.current || facetsLoading) {
      return;
    }

    setBuilderFilter(defaultBuilderSelection(builderSuggestions));
    builderFilterInitializedRef.current = true;
  }, [builderSuggestions, facetsLoading]);

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

  const portfolioFilters = useMemo(() => {
    const allStatuses = Object.values(ProjectStatus);
    const allBuilders = ["none", ...builderSuggestions];

    return {
      sort: sortMode,
      status: isAllSelected(new Set(statusFilter), allStatuses) ? undefined : statusFilter,
      platform: isAllSelected(new Set(platformFilter), ALL_PLATFORM_VALUES) ? undefined : platformFilter,
      builder: !builderFilterInitializedRef.current
        ? undefined
        : isAllSelected(new Set(builderFilter), allBuilders)
          ? undefined
          : builderFilter
    };
  }, [builderFilter, builderSuggestions, platformFilter, sortMode, statusFilter]);

  const portfolioQueryEnabled = builderFilterInitializedRef.current || facetsLoading === false;
  const {
    data: portfolioPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: portfolioLoading
  } = usePortfolioProjectsInfinite(portfolioFilters, portfolioQueryEnabled);

  const projects = useMemo(() => portfolioPages?.pages.flatMap((page) => page.projects) ?? [], [portfolioPages]);
  const totalCount = portfolioPages?.pages[0]?.totalCount ?? 0;
  const showEmptySelection =
    statusFilter.length === 0 ||
    platformFilter.length === 0 ||
    (builderFilterInitializedRef.current && builderFilter.length === 0);

  const activeFilterCount = countActiveFilterDimensions([
    { selected: statusFilter, all: statusOptions.map((option) => option.value) },
    { selected: platformFilter, all: platformOptions.map((option) => option.value) },
    { selected: builderFilter, all: builderOptions.map((option) => option.value) }
  ]);

  const patchProject = useCallback(
    (id: string, payload: UpdateProjectRequest) => {
      patchProjectMutation.mutate(
        { id, payload },
        {
          onError: (error) => {
            console.error("[projects] Falha ao salvar projeto", error);
            toast.error(resolveMutationErrorMessage(error, "Não foi possível salvar o projeto"));
          }
        }
      );
    },
    [patchProjectMutation]
  );

  if (facetsLoading || portfolioLoading) {
    return <LoadingSpinner />;
  }

  const visibleProjects = showEmptySelection ? [] : projects;

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
              <h1 className="text-2xl font-bold text-text-primary">
                Projetos ativos
                {totalCount > 0 ? (
                  <span className="ml-2 text-base font-medium text-[--color-text-muted]">({totalCount})</span>
                ) : null}
              </h1>
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
                  showIsolateActions
                  onValuesChange={setStatusFilter}
                />
                <SearchableMultiSelect
                  values={platformFilter}
                  options={platformOptions}
                  searchPlaceholder="Buscar plataforma..."
                  allSelectedLabel="Todas as plataformas"
                  noneSelectedLabel="Nenhuma plataforma"
                  partialSelectedLabel={(count) => `${count} plataformas`}
                  showIsolateActions
                  onValuesChange={setPlatformFilter}
                />
                <SearchableMultiSelect
                  values={builderFilter}
                  options={builderOptions}
                  searchPlaceholder="Buscar construtora..."
                  allSelectedLabel="Todas as construtoras"
                  noneSelectedLabel="Nenhuma construtora"
                  partialSelectedLabel={(count) => `${count} construtoras`}
                  showIsolateActions
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
                  onValueChange={(value) => setSortMode(value as PortfolioProjectSort)}
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
        projects={visibleProjects}
        canManage={canManage}
        builderSuggestions={builderSuggestions}
        hasNextPage={Boolean(hasNextPage)}
        isFetchingNextPage={isFetchingNextPage}
        onEditProject={setEditingProject}
        onLoadMore={() => {
          void fetchNextPage();
        }}
        onPatchProject={patchProject}
      />
      {visibleProjects.length === 0 ? <EmptyState title="Nenhum projeto encontrado" /> : null}
    </div>
  );
}

function ProjectsPortfolioTable({
  projects,
  canManage,
  builderSuggestions,
  hasNextPage,
  isFetchingNextPage,
  onEditProject,
  onLoadMore,
  onPatchProject
}: {
  projects: Project[];
  canManage: boolean;
  builderSuggestions: string[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onEditProject: (project: Project) => void;
  onLoadMore: () => void;
  onPatchProject: (id: string, payload: UpdateProjectRequest) => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    const target = loadMoreRef.current;
    const root = scrollRef.current;
    if (!target || !root || !hasNextPage) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !isFetchingNextPage) {
          onLoadMore();
        }
      },
      { root, rootMargin: "240px" }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [hasNextPage, isFetchingNextPage, onLoadMore, projects.length]);

  return (
    <DataTableContainer ref={scrollRef} className="max-h-[calc(100vh-220px)] overflow-y-auto">
      <table className="w-full min-w-[1680px] table-fixed border-collapse bg-[--bg-2] text-sm">
        <thead className="sticky top-0 z-10 bg-[--bg-1] text-left">
          <tr className="border-b border-[--color-border]">
            <th className="w-[320px] px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-[--color-text-muted]">Nome</th>
            <th className="w-[180px] px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-[--color-text-muted]">Construtora</th>
            <th className="w-[130px] px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-[--color-text-muted]">Plataforma</th>
            <th className="w-[130px] px-3 py-2 text-right text-[11px] font-medium uppercase tracking-widest text-[--color-text-muted]">Área</th>
            <th className="w-[240px] px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-[--color-text-muted]">Financeiro</th>
            <th className="w-[220px] px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-[--color-text-muted]">Disciplinas</th>
            <th className="w-[130px] px-3 py-2 text-right text-[11px] font-medium uppercase tracking-widest text-[--color-text-muted]">Área proj.</th>
            <th className="w-[110px] px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-[--color-text-muted]">PPCI/GÁS</th>
            <th className="w-[110px] px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-[--color-text-muted]">ELE APROV.</th>
            <th className="w-[110px] px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-[--color-text-muted]">HID APROV.</th>
            <th className="w-[110px] px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-[--color-text-muted]">ELE EXEC.</th>
            <th className="w-[110px] px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-[--color-text-muted]">HID EXEC.</th>
            {canManage ? (
              <th className="w-[90px] px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-[--color-text-muted]">Editar</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => {
            const iconTokens = resolveAsanaColor(project.color ?? "");
            const financeField = projectCustomField(project, portfolioFieldLabels.finance);

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
                    <EditableProjectMultiEnumField
                      field={financeField}
                      compactLabels
                      variant="table"
                      onSave={(value) => saveProjectCustomField(project, financeField, value, onPatchProject)}
                    />
                  ) : (
                    <ProjectMultiEnumChips field={financeField} maxVisible={2} compactLabels />
                  )}
                </td>
                <td className="px-3 py-2">
                  {canManage ? (
                    <EditableProjectMultiEnumField
                      field={projectCustomField(project, portfolioFieldLabels.disciplinas)}
                      variant="table"
                      onSave={(value) =>
                        saveProjectCustomField(
                          project,
                          projectCustomField(project, portfolioFieldLabels.disciplinas),
                          value,
                          onPatchProject
                        )
                      }
                    />
                  ) : (
                    <ProjectMultiEnumChips field={projectCustomField(project, portfolioFieldLabels.disciplinas)} maxVisible={2} />
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <ProjectPortfolioNumberValue field={projectCustomField(project, portfolioFieldLabels.projectedArea)} />
                </td>
                <td className="px-3 py-2">
                  {canManage ? (
                    <EditableProjectEnumField
                      field={projectCustomField(project, portfolioFieldLabels.ppciGas)}
                      variant="table"
                      onSave={(value) =>
                        saveProjectCustomField(project, projectCustomField(project, portfolioFieldLabels.ppciGas), value, onPatchProject)
                      }
                    />
                  ) : (
                    <ProjectEnumChip field={projectCustomField(project, portfolioFieldLabels.ppciGas)} />
                  )}
                </td>
                <td className="px-3 py-2">
                  {canManage ? (
                    <EditableProjectEnumField
                      field={projectCustomField(project, portfolioFieldLabels.eleApproval)}
                      variant="table"
                      onSave={(value) =>
                        saveProjectCustomField(
                          project,
                          projectCustomField(project, portfolioFieldLabels.eleApproval),
                          value,
                          onPatchProject
                        )
                      }
                    />
                  ) : (
                    <ProjectEnumChip field={projectCustomField(project, portfolioFieldLabels.eleApproval)} />
                  )}
                </td>
                <td className="px-3 py-2">
                  {canManage ? (
                    <EditableProjectEnumField
                      field={projectCustomField(project, portfolioFieldLabels.hidApproval)}
                      variant="table"
                      onSave={(value) =>
                        saveProjectCustomField(
                          project,
                          projectCustomField(project, portfolioFieldLabels.hidApproval),
                          value,
                          onPatchProject
                        )
                      }
                    />
                  ) : (
                    <ProjectEnumChip field={projectCustomField(project, portfolioFieldLabels.hidApproval)} />
                  )}
                </td>
                <td className="px-3 py-2">
                  {canManage ? (
                    <EditableProjectEnumField
                      field={projectCustomField(project, portfolioFieldLabels.eleExecution)}
                      variant="table"
                      onSave={(value) =>
                        saveProjectCustomField(
                          project,
                          projectCustomField(project, portfolioFieldLabels.eleExecution),
                          value,
                          onPatchProject
                        )
                      }
                    />
                  ) : (
                    <ProjectEnumChip field={projectCustomField(project, portfolioFieldLabels.eleExecution)} />
                  )}
                </td>
                <td className="px-3 py-2">
                  {canManage ? (
                    <EditableProjectEnumField
                      field={projectCustomField(project, portfolioFieldLabels.hidExecution)}
                      variant="table"
                      onSave={(value) =>
                        saveProjectCustomField(
                          project,
                          projectCustomField(project, portfolioFieldLabels.hidExecution),
                          value,
                          onPatchProject
                        )
                      }
                    />
                  ) : (
                    <ProjectEnumChip field={projectCustomField(project, portfolioFieldLabels.hidExecution)} />
                  )}
                </td>
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
          {hasNextPage ? (
            <tr ref={loadMoreRef}>
              <td colSpan={canManage ? 13 : 12} className="px-3 py-4 text-center text-sm text-[--color-text-muted]">
                {isFetchingNextPage ? "Carregando mais projetos..." : "Role para carregar mais"}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </DataTableContainer>
  );
}

function saveProjectCustomField(
  project: Project,
  field: ProjectCustomFieldValue | undefined,
  value: string | number | string[] | null,
  onPatchProject: (id: string, payload: UpdateProjectRequest) => void
) {
  if (!field) {
    return;
  }

  const patch = buildProjectCustomFieldPatch(project, field, value);
  if (!isProjectCustomFieldPatchValid(patch)) {
    toast.error("Não foi possível identificar o campo do projeto para salvar.");
    return;
  }

  onPatchProject(project.id, {
    customFieldValues: [patch]
  });
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
