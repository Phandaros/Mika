import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FolderKanban, ListFilter, Loader2, Pencil, Plus, SlidersHorizontal, X } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import {
  type PortfolioCustomFieldFilter,
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
import { StatusOptionPill } from "../components/shared/statusVisuals";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { SearchableMultiSelect } from "../components/ui/searchable-multi-select";
import { SearchableSelect, type SearchableSelectOption } from "../components/ui/searchable-select";
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
import { portfolioEnumColor } from "../lib/portfolioEnumColor";
import { resolveMutationErrorMessage } from "../lib/mutationErrors";
import { resolveAsanaColor } from "../lib/utils";

const ALL_PLATFORM_VALUES = ["CAD", "BIM", "none"] as const;
const CUSTOM_FILTER_QUERY_PARAM = "cf";
const PROJECT_SORT_VALUES: PortfolioProjectSort[] = ["updatedAt-desc", "name-asc", "endDate-asc"];

const PORTFOLIO_CUSTOM_FILTER_FIELDS: Array<{
  fieldKey: string;
  label: string;
  type: PortfolioCustomFieldFilter["type"];
  options: Array<{ name: string; color: string | null }>;
}> = [
  {
    fieldKey: "financeiro",
    label: "Financeiro",
    type: "multi_enum",
    options: [
      { name: "1 Parcela - Kick", color: null },
      { name: "2 Parcela - Estudo Preliminar + ART ", color: null },
      { name: "3 Parcela - Anteprojeto", color: null },
      { name: "4 Parcela - Projeto Legal", color: null },
      { name: "5 Parcela - Pré Executivo", color: null },
      { name: "6 Parcela - Projeto Executivo", color: null },
      { name: "7 Parcela - Liberado Obra", color: null }
    ]
  },
  {
    fieldKey: "disciplinas",
    label: "Disciplinas",
    type: "multi_enum",
    options: [
      { name: "Elétrico", color: null },
      { name: "Telecom", color: null },
      { name: "SPDA", color: null },
      { name: "Hidráulico", color: null },
      { name: "Sanitário", color: null },
      { name: "Preventivo", color: null },
      { name: "Arquitetônico", color: null },
      { name: "Automação", color: null },
      { name: "Sprinkler", color: null },
      { name: "Gás", color: null },
      { name: "Climatização", color: null },
      { name: "Compatibilização", color: null },
      { name: "Drenagem", color: null },
      { name: "Exaustão", color: null },
      { name: "Aspiração Central", color: null },
      { name: "Escada Pressurizada", color: "hot-pink" }
    ]
  },
  {
    fieldKey: "ppciGas",
    label: "PPCI / GÁS",
    type: "enum",
    options: [
      { name: "Aprovado", color: "green" },
      { name: "Em análise", color: "yellow" },
      { name: "Indeferido", color: "red" },
      { name: "N/A", color: "cool-gray" },
      { name: "To Do", color: "cool-gray" }
    ]
  },
  {
    fieldKey: "eleAprov",
    label: "ELE APROV.",
    type: "enum",
    options: [
      { name: "Aprovado", color: "green" },
      { name: "Em análise", color: "yellow" },
      { name: "Indeferido", color: "red" },
      { name: "N/A", color: "cool-gray" },
      { name: "To Do", color: "cool-gray" }
    ]
  },
  {
    fieldKey: "hidAprov",
    label: "HID APROV.",
    type: "enum",
    options: [
      { name: "Aprovado", color: "green" },
      { name: "Em análise", color: "yellow" },
      { name: "Indeferido", color: "red" },
      { name: "N/A", color: "cool-gray" },
      { name: "To Do", color: "cool-gray" }
    ]
  },
  {
    fieldKey: "eleExec",
    label: "ELE EXEC.",
    type: "enum",
    options: [
      { name: "Completo", color: "green" },
      { name: "Parcial", color: "yellow" },
      { name: "N/A", color: "cool-gray" },
      { name: "To Do", color: "cool-gray" }
    ]
  },
  {
    fieldKey: "hidExec",
    label: "HID EXEC.",
    type: "enum",
    options: [
      { name: "Completo", color: "green" },
      { name: "Parcial", color: "yellow" },
      { name: "N/A", color: "cool-gray" },
      { name: "To Do", color: "cool-gray" }
    ]
  }
];
const DEFAULT_PORTFOLIO_CUSTOM_FILTER_FIELD = PORTFOLIO_CUSTOM_FILTER_FIELDS.find((field) => field.fieldKey === "disciplinas")!;

export function ProjectsPage() {
  const { user } = useAuth();
  const { data: builderSuggestions = [], isLoading: facetsLoading } = usePortfolioFacets();
  const patchProjectMutation = usePatchProject();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [statusFilter, setStatusFilter] = useState<string[]>(() => searchParamArray(searchParams, "status") ?? defaultProjectStatusSelection());
  const [platformFilter, setPlatformFilter] = useState<string[]>(() => searchParamArray(searchParams, "platform") ?? defaultPlatformSelection());
  const [builderFilter, setBuilderFilter] = useState<string[]>([]);
  const builderFilterInitializedRef = useRef(false);
  const [sortMode, setSortMode] = useState<PortfolioProjectSort>(() => parsePortfolioSort(searchParams.get("sort")));
  const [projectQuery, setProjectQuery] = useState(() => searchParams.get("q") ?? "");
  const [customFieldFilters, setCustomFieldFilters] = useState<PortfolioCustomFieldFilter[]>(() =>
    parseCustomFieldFiltersParam(searchParams.get(CUSTOM_FILTER_QUERY_PARAM))
  );
  const debouncedProjectQuery = useDebouncedValue(projectQuery, 250);
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

    setBuilderFilter(searchParamArray(searchParams, "builder") ?? defaultBuilderSelection(builderSuggestions));
    builderFilterInitializedRef.current = true;
  }, [builderSuggestions, facetsLoading, searchParams]);

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
  const effectiveCustomFieldFilters = useMemo(
    () => customFieldFilters.filter(isCompletePortfolioCustomFilter),
    [customFieldFilters]
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
          : builderFilter,
      query: debouncedProjectQuery.trim() || undefined,
      customFieldFilters: effectiveCustomFieldFilters
    };
  }, [builderFilter, builderSuggestions, debouncedProjectQuery, effectiveCustomFieldFilters, platformFilter, sortMode, statusFilter]);

  useEffect(() => {
    if (!builderFilterInitializedRef.current) {
      return;
    }

    const nextParams = buildPortfolioSearchParams({
      current: searchParams,
      statusFilter,
      platformFilter,
      builderFilter,
      builderOptions: builderOptions.map((option) => option.value),
      sortMode,
      projectQuery,
      customFieldFilters: effectiveCustomFieldFilters
    });

    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [
    builderFilter,
    builderOptions,
    effectiveCustomFieldFilters,
    platformFilter,
    projectQuery,
    searchParams,
    setSearchParams,
    sortMode,
    statusFilter
  ]);

  const portfolioQueryEnabled = builderFilterInitializedRef.current || facetsLoading === false;
  const {
    data: portfolioPages,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isLoading: portfolioLoading
  } = usePortfolioProjectsInfinite(portfolioFilters, portfolioQueryEnabled);

  const projects = useMemo(() => portfolioPages?.pages.flatMap((page) => page.projects) ?? [], [portfolioPages]);
  const totalCount = portfolioPages?.pages[0]?.totalCount ?? 0;
  const showEmptySelection =
    statusFilter.length === 0 ||
    platformFilter.length === 0 ||
    (builderFilterInitializedRef.current && builderFilter.length === 0);
  const normalizedProjectQuery = projectQuery.trim();
  const isProjectQueryPending =
    normalizedProjectQuery !== debouncedProjectQuery.trim() ||
    (isFetching && !isFetchingNextPage);

  const activeFilterCount = countActiveFilterDimensions([
    { selected: statusFilter, all: statusOptions.map((option) => option.value) },
    { selected: platformFilter, all: platformOptions.map((option) => option.value) },
    { selected: builderFilter, all: builderOptions.map((option) => option.value) }
  ]) + effectiveCustomFieldFilters.length;

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
                {totalCount > 0 || normalizedProjectQuery ? (
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
              <PopoverContent align="end" className="w-[min(760px,calc(100vw-32px))] p-0">
                <PortfolioFiltersPanel
                  statusFilter={statusFilter}
                  platformFilter={platformFilter}
                  builderFilter={builderFilter}
                  statusOptions={statusOptions}
                  platformOptions={platformOptions}
                  builderOptions={builderOptions}
                  customFieldFilters={customFieldFilters}
                  onStatusFilterChange={setStatusFilter}
                  onPlatformFilterChange={setPlatformFilter}
                  onBuilderFilterChange={setBuilderFilter}
                  onCustomFieldFiltersChange={setCustomFieldFilters}
                  onClear={() => {
                    setStatusFilter(defaultProjectStatusSelection());
                    setPlatformFilter(defaultPlatformSelection());
                    setBuilderFilter(defaultBuilderSelection(builderSuggestions));
                    setCustomFieldFilters([]);
                  }}
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

      <div className="flex flex-col gap-3 rounded-md border border-[--color-border] bg-[--bg-1] px-3 py-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <label htmlFor="project-list-filter" className="text-[13px] font-medium text-[--color-text-primary]">
              Filtrar projetos
            </label>
            <span className="text-[11px] text-[--color-text-muted]">Somente nesta lista</span>
          </div>
          <div className="flex w-full max-w-xl items-center gap-2">
            <Input
              id="project-list-filter"
              value={projectQuery}
              className="h-9 bg-[--bg-3] text-[13px]"
              placeholder="Nome ou construtora"
              autoComplete="off"
              onChange={(event) => setProjectQuery(event.target.value)}
            />
            {normalizedProjectQuery ? (
              <Button variant="ghost" className="h-9 shrink-0 px-3" onClick={() => setProjectQuery("")}>
                Limpar
              </Button>
            ) : null}
          </div>
        </div>
        <div
          className="flex min-h-5 items-center gap-1.5 text-[11px] text-[--color-text-muted]"
          role="status"
          aria-live="polite"
        >
          {isProjectQueryPending ? (
            <>
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              Atualizando resultados...
            </>
          ) : normalizedProjectQuery ? (
            `${totalCount} ${totalCount === 1 ? "projeto encontrado" : "projetos encontrados"}`
          ) : null}
        </div>
      </div>

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
      {!isProjectQueryPending && visibleProjects.length === 0 ? (
        (normalizedProjectQuery || activeFilterCount > 0) && !showEmptySelection ? (
          <EmptyState
            title="Nenhum projeto corresponde ao filtro"
            action={
              <Button
                variant="secondary"
                className="h-9"
                onClick={() => {
                  setProjectQuery("");
                  setStatusFilter(defaultProjectStatusSelection());
                  setPlatformFilter(defaultPlatformSelection());
                  setBuilderFilter(defaultBuilderSelection(builderSuggestions));
                  setCustomFieldFilters([]);
                }}
              >
                Limpar filtros
              </Button>
            }
          >
            Ajuste a busca, status, plataforma, construtora ou filtros custom.
          </EmptyState>
        ) : (
          <EmptyState title="Nenhum projeto encontrado" />
        )
      ) : null}
    </div>
  );
}

function PortfolioFiltersPanel({
  statusFilter,
  platformFilter,
  builderFilter,
  statusOptions,
  platformOptions,
  builderOptions,
  customFieldFilters,
  onStatusFilterChange,
  onPlatformFilterChange,
  onBuilderFilterChange,
  onCustomFieldFiltersChange,
  onClear
}: {
  statusFilter: string[];
  platformFilter: string[];
  builderFilter: string[];
  statusOptions: SearchableSelectOption[];
  platformOptions: SearchableSelectOption[];
  builderOptions: SearchableSelectOption[];
  customFieldFilters: PortfolioCustomFieldFilter[];
  onStatusFilterChange: (values: string[]) => void;
  onPlatformFilterChange: (values: string[]) => void;
  onBuilderFilterChange: (values: string[]) => void;
  onCustomFieldFiltersChange: (filters: PortfolioCustomFieldFilter[]) => void;
  onClear: () => void;
}) {
  const customFieldOptions = PORTFOLIO_CUSTOM_FILTER_FIELDS.map((field) => ({
    value: field.fieldKey,
    label: field.label
  }));

  function updateCustomFilter(index: number, nextFilter: PortfolioCustomFieldFilter) {
    onCustomFieldFiltersChange(customFieldFilters.map((filter, filterIndex) => (filterIndex === index ? nextFilter : filter)));
  }

  function addCustomFilter() {
    onCustomFieldFiltersChange([
      ...customFieldFilters,
      {
        fieldKey: "disciplinas",
        type: "multi_enum",
        operator: "containsAny",
        values: []
      }
    ]);
  }

  return (
    <div className="flex max-h-[min(620px,calc(100vh-120px))] flex-col overflow-hidden rounded-md bg-[--bg-1]">
      <div className="flex items-center justify-between border-b border-[--color-border] px-5 py-4">
        <h2 className="text-sm font-semibold text-[--color-text-primary]">Filtros</h2>
        <Button type="button" variant="ghost" className="h-8 px-2 text-[12px]" onClick={onClear}>
          Apagar
        </Button>
      </div>
      <div className="flex flex-col gap-5 overflow-y-auto p-5">
        <section className="flex flex-col gap-3">
          <p className="text-[12px] font-semibold text-[--color-text-muted]">Filtros principais</p>
          <div className="grid gap-2 md:grid-cols-3">
            <SearchableMultiSelect
              values={statusFilter}
              options={statusOptions}
              searchPlaceholder="Buscar status..."
              allSelectedLabel="Todos os status"
              noneSelectedLabel="Nenhum status"
              partialSelectedLabel={(count) => `${count} status`}
              showIsolateActions
              onValuesChange={onStatusFilterChange}
            />
            <SearchableMultiSelect
              values={platformFilter}
              options={platformOptions}
              searchPlaceholder="Buscar plataforma..."
              allSelectedLabel="Todas as plataformas"
              noneSelectedLabel="Nenhuma plataforma"
              partialSelectedLabel={(count) => `${count} plataformas`}
              showIsolateActions
              onValuesChange={onPlatformFilterChange}
            />
            <SearchableMultiSelect
              values={builderFilter}
              options={builderOptions}
              searchPlaceholder="Buscar construtora..."
              allSelectedLabel="Todas as construtoras"
              noneSelectedLabel="Nenhuma construtora"
              partialSelectedLabel={(count) => `${count} construtoras`}
              showIsolateActions
              onValuesChange={onBuilderFilterChange}
            />
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <p className="text-[12px] font-semibold text-[--color-text-muted]">Todos os filtros</p>
          {customFieldFilters.length > 0 ? (
            <div className="flex flex-col gap-2">
              {customFieldFilters.map((filter, index) => (
                <PortfolioCustomFilterRow
                  key={`${filter.fieldKey}-${index}`}
                  filter={filter}
                  fieldOptions={customFieldOptions}
                  onChange={(nextFilter) => updateCustomFilter(index, nextFilter)}
                  onRemove={() => onCustomFieldFiltersChange(customFieldFilters.filter((_, filterIndex) => filterIndex !== index))}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-[--color-border] px-3 py-4 text-sm text-[--color-text-muted]">
              Nenhum filtro custom aplicado.
            </div>
          )}
          <Button type="button" variant="ghost" className="h-8 w-fit px-2 text-[13px] text-[--color-text-secondary]" onClick={addCustomFilter}>
            <Plus size={15} />
            Adicionar filtro
          </Button>
        </section>
      </div>
    </div>
  );
}

function PortfolioCustomFilterRow({
  filter,
  fieldOptions,
  onChange,
  onRemove
}: {
  filter: PortfolioCustomFieldFilter;
  fieldOptions: SearchableSelectOption[];
  onChange: (filter: PortfolioCustomFieldFilter) => void;
  onRemove: () => void;
}) {
  const field = portfolioCustomFieldByKey(filter.fieldKey) ?? DEFAULT_PORTFOLIO_CUSTOM_FILTER_FIELD;
  const operatorOptions = portfolioOperatorOptions(field.type);
  const valueOptions = field.options.map((option) => ({
    value: option.name,
    label: option.name,
    color: portfolioEnumColor(field.label, option.name, option.color),
    render: <StatusOptionPill label={option.name} color={portfolioEnumColor(field.label, option.name, option.color)} />
  }));
  const needsValue = !["isBlank", "isNotBlank"].includes(filter.operator);

  return (
    <div className="grid gap-2 rounded-md border border-[--color-border] bg-[--bg-2] p-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)_auto]">
      <SearchableSelect
        value={field.fieldKey}
        options={fieldOptions}
        searchPlaceholder="Buscar campo..."
        onValueChange={(fieldKey) => {
          const nextField = portfolioCustomFieldByKey(fieldKey) ?? DEFAULT_PORTFOLIO_CUSTOM_FILTER_FIELD;
          onChange(defaultPortfolioCustomFilter(nextField));
        }}
      />
      <SearchableSelect
        value={filter.operator}
        options={operatorOptions}
        searchPlaceholder="Buscar regra..."
        onValueChange={(operator) => {
          if (field.type === "multi_enum") {
            onChange({ ...filter, type: "multi_enum", operator: operator as PortfolioCustomFieldFilterForType<"multi_enum">["operator"] });
          } else {
            onChange({ ...filter, type: "enum", operator: operator as PortfolioCustomFieldFilterForType<"enum">["operator"] });
          }
        }}
      />
      {needsValue ? (
        <SearchableMultiSelect
          values={filter.values ?? []}
          options={valueOptions}
          searchPlaceholder="Buscar valor..."
          placeholder="Selecionar valor"
          noneSelectedLabel="Selecionar valor"
          partialSelectedLabel={(count) => `${count} valores`}
          showBulkActions={false}
          renderTrigger={(values) => (
            <FilterValuePreview fieldLabel={field.label} values={values} options={field.options} />
          )}
          onValuesChange={(values) => onChange({ ...filter, values })}
        />
      ) : (
        <div className="flex h-10 items-center rounded-md border border-[--color-border] bg-[--bg-3] px-3 text-sm text-[--color-text-muted]">
          Sem valor
        </div>
      )}
      <Button type="button" variant="ghost" className="h-10 px-3 text-[--color-text-muted] hover:text-brand-orange" onClick={onRemove}>
        <X size={16} />
      </Button>
    </div>
  );
}

type PortfolioCustomFieldFilterForType<T extends PortfolioCustomFieldFilter["type"]> = Extract<
  PortfolioCustomFieldFilter,
  { type: T }
>;

function FilterValuePreview({
  fieldLabel,
  values,
  options
}: {
  fieldLabel: string;
  values: string[];
  options: Array<{ name: string; color: string | null }>;
}) {
  if (values.length === 0) {
    return <span className="text-[--color-text-muted]">Selecionar valor</span>;
  }

  const visibleValues = values.slice(0, 2);
  const hiddenCount = values.length - visibleValues.length;

  return (
    <span className="flex min-w-0 items-center gap-1 overflow-hidden">
      {visibleValues.map((value) => {
        const option = options.find((item) => item.name === value);
        return <StatusOptionPill key={value} label={value} color={portfolioEnumColor(fieldLabel, value, option?.color)} />;
      })}
      {hiddenCount > 0 ? (
        <span className="shrink-0 rounded bg-[--bg-4] px-1.5 py-0.5 text-[11px] font-medium text-[--color-text-secondary]">
          +{hiddenCount}
        </span>
      ) : null}
    </span>
  );
}

function portfolioCustomFieldByKey(fieldKey: string) {
  return PORTFOLIO_CUSTOM_FILTER_FIELDS.find((field) => field.fieldKey === fieldKey);
}

function defaultPortfolioCustomFilter(field: (typeof PORTFOLIO_CUSTOM_FILTER_FIELDS)[number]): PortfolioCustomFieldFilter {
  if (field.type === "multi_enum") {
    return {
      fieldKey: field.fieldKey,
      type: "multi_enum",
      operator: "containsAny",
      values: []
    };
  }

  return {
    fieldKey: field.fieldKey,
    type: "enum",
    operator: "isAnyOf",
    values: []
  };
}

function portfolioOperatorOptions(type: PortfolioCustomFieldFilter["type"]): SearchableSelectOption[] {
  if (type === "multi_enum") {
    return [
      { value: "containsAny", label: "contém um destes" },
      { value: "containsAll", label: "contém todos" },
      { value: "containsNone", label: "não contém nenhum" },
      { value: "isBlank", label: "está em branco" },
      { value: "isNotBlank", label: "não está em branco" }
    ];
  }

  return [
    { value: "isAnyOf", label: "é um destes" },
    { value: "isNoneOf", label: "não é um destes" },
    { value: "isBlank", label: "está em branco" },
    { value: "isNotBlank", label: "não está em branco" }
  ];
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

function searchParamArray(searchParams: URLSearchParams, key: string): string[] | null {
  const values = searchParams.getAll(key).map((value) => value.trim()).filter(Boolean);
  return values.length > 0 ? values : null;
}

function parsePortfolioSort(value: string | null): PortfolioProjectSort {
  return PROJECT_SORT_VALUES.includes(value as PortfolioProjectSort) ? (value as PortfolioProjectSort) : "updatedAt-desc";
}

function parseCustomFieldFiltersParam(value: string | null): PortfolioCustomFieldFilter[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isPortfolioCustomFilter);
  } catch {
    return [];
  }
}

function isPortfolioCustomFilter(value: unknown): value is PortfolioCustomFieldFilter {
  if (!value || typeof value !== "object") {
    return false;
  }

  const filter = value as Partial<PortfolioCustomFieldFilter>;
  const field = typeof filter.fieldKey === "string" ? portfolioCustomFieldByKey(filter.fieldKey) : undefined;
  if (!field || filter.type !== field.type || typeof filter.operator !== "string") {
    return false;
  }

  const operators = portfolioOperatorOptions(field.type).map((option) => option.value);
  if (!operators.includes(filter.operator)) {
    return false;
  }

  return filter.values === undefined || (Array.isArray(filter.values) && filter.values.every((item) => typeof item === "string"));
}

function isCompletePortfolioCustomFilter(filter: PortfolioCustomFieldFilter): boolean {
  const field = portfolioCustomFieldByKey(filter.fieldKey);
  if (!field || field.type !== filter.type) {
    return false;
  }

  if (filter.operator === "isBlank" || filter.operator === "isNotBlank") {
    return true;
  }

  return Boolean(filter.values?.length);
}

function buildPortfolioSearchParams({
  current,
  statusFilter,
  platformFilter,
  builderFilter,
  builderOptions,
  sortMode,
  projectQuery,
  customFieldFilters
}: {
  current: URLSearchParams;
  statusFilter: string[];
  platformFilter: string[];
  builderFilter: string[];
  builderOptions: string[];
  sortMode: PortfolioProjectSort;
  projectQuery: string;
  customFieldFilters: PortfolioCustomFieldFilter[];
}) {
  const nextParams = new URLSearchParams(current);
  const projectQueryTrimmed = projectQuery.trim();

  setArraySearchParam(nextParams, "status", shouldPersistSelection(statusFilter, Object.values(ProjectStatus)) ? statusFilter : []);
  setArraySearchParam(nextParams, "platform", shouldPersistSelection(platformFilter, ALL_PLATFORM_VALUES) ? platformFilter : []);
  setArraySearchParam(nextParams, "builder", shouldPersistSelection(builderFilter, builderOptions) ? builderFilter : []);

  if (sortMode === "updatedAt-desc") {
    nextParams.delete("sort");
  } else {
    nextParams.set("sort", sortMode);
  }

  if (projectQueryTrimmed) {
    nextParams.set("q", projectQueryTrimmed);
  } else {
    nextParams.delete("q");
  }

  if (customFieldFilters.length > 0) {
    nextParams.set(CUSTOM_FILTER_QUERY_PARAM, JSON.stringify(customFieldFilters));
  } else {
    nextParams.delete(CUSTOM_FILTER_QUERY_PARAM);
  }

  return nextParams;
}

function shouldPersistSelection(selected: string[], allValues: readonly string[]): boolean {
  if (selected.length === 0) {
    return true;
  }

  return !isAllSelected(new Set(selected), allValues);
}

function setArraySearchParam(searchParams: URLSearchParams, key: string, values: readonly string[]) {
  searchParams.delete(key);
  values.forEach((value) => searchParams.append(key, value));
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timeoutId);
  }, [delayMs, value]);

  return debouncedValue;
}
