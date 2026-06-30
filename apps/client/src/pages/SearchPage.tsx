import { ArrowRight, BriefcaseBusiness, FolderKanban, Search, UserRound, X } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Priority,
  ProjectStatus,
  TaskStatus,
  type AdvancedSearchCompletion,
  type AdvancedSearchIndicatorMetric,
  type AdvancedSearchProjectResult,
  type AdvancedSearchResponse,
  type AdvancedSearchTaskResult,
  type AdvancedSearchType,
  type AdvancedSearchUserResult,
  type IndicatorPeriod,
  type IndicatorScope
} from "shared";
import { ProjectStatusChip, priorityLabels, taskStatusLabels } from "../components/shared/Chip";
import { PriorityBadge } from "../components/shared/PriorityBadge";
import { TaskStatusBadge } from "../components/task/TaskStatusBadge";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { DatePicker } from "../components/ui/date-picker";
import { Input } from "../components/ui/input";
import { SearchableMultiSelect } from "../components/ui/searchable-multi-select";
import { SearchableSelect, type SearchableSelectOption } from "../components/ui/searchable-select";
import { Skeleton } from "../components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { useAdvancedSearch, type AdvancedSearchFilters } from "../hooks/useAdvancedSearch";
import { useProjectOptions } from "../hooks/useProjects";
import { useUsers } from "../hooks/useUsers";
import { projectStatusLabels } from "../lib/projectLabels";
import { cn } from "../lib/utils";

const SEARCH_TYPES: Array<{ value: AdvancedSearchType; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "tasks", label: "Tarefas" },
  { value: "projects", label: "Projetos" },
  { value: "users", label: "Pessoas" }
];

const COMPLETION_OPTIONS: SearchableSelectOption[] = [
  { value: "open", label: "Abertas" },
  { value: "completed", label: "Concluídas" },
  { value: "all", label: "Todas" }
];

const LIMIT = 25;

export function SearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseSearchFilters(searchParams), [searchParams]);
  const [draftSearch, setDraftSearch] = useState(filters.q);
  const advancedSearch = useAdvancedSearch(filters);
  const projectOptionsQuery = useProjectOptions();
  const usersQuery = useUsers();
  const data = advancedSearch.data;

  useEffect(() => {
    setDraftSearch(filters.q);
  }, [filters.q]);

  const projectOptions = useMemo<SearchableSelectOption[]>(() => {
    const options = projectOptionsQuery.data ?? [];
    return [
      { value: "", label: "Em qualquer projeto" },
      ...options.map((project) => ({
        value: project.id,
        label: project.name,
        description: project.builder ?? undefined
      }))
    ];
  }, [projectOptionsQuery.data]);

  const userOptions = useMemo<SearchableSelectOption[]>(() => {
    const users = usersQuery.data ?? [];
    return [
      { value: "", label: "Qualquer responsável" },
      ...users.map((user) => ({
        value: user.id,
        label: user.name,
        description: user.email,
        avatarUrl: user.avatarUrl
      }))
    ];
  }, [usersQuery.data]);

  function updateFilters(mutator: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(searchParams);
    clearIndicatorParams(next);
    mutator(next);
    next.delete("page");
    setSearchParams(next, { replace: true });
  }

  function updateArrayFilter(key: string, values: string[]) {
    updateFilters((next) => {
      next.delete(key);
      values.forEach((value) => next.append(key, value));
    });
  }

  function updateScalarFilter(key: string, value: string | null) {
    updateFilters((next) => {
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
    });
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams(searchParams);
    const query = draftSearch.trim();
    clearIndicatorParams(next);

    if (query) {
      next.set("q", query);
    } else {
      next.delete("q");
    }

    next.delete("page");
    setSearchParams(next);
  }

  function setType(type: string) {
    updateFilters((next) => {
      if (type === "all") {
        next.delete("type");
      } else {
        next.set("type", type);
      }
    });
  }

  function setPage(page: number) {
    const next = new URLSearchParams(searchParams);

    if (page <= 1) {
      next.delete("page");
    } else {
      next.set("page", String(page));
    }

    setSearchParams(next, { replace: true });
  }

  const pageCount = totalPages(data, filters.type);
  const hasResults = Boolean(data && (data.tasks.total > 0 || data.projects.total > 0 || data.users.total > 0));
  const indicatorContext = indicatorContextLabel(filters);

  return (
    <div className="flex flex-col gap-5">
      <section className="border-b border-border pb-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
              <Search size={14} />
              Pesquisa avançada
            </div>
            <h1 className="text-2xl font-semibold text-text-primary">
              {filters.q ? `Resultados para "${filters.q}"` : "Buscar no Mika"}
            </h1>
          </div>

          <form className="flex flex-col gap-2 md:flex-row" onSubmit={submitSearch}>
            <label className="relative min-w-0 flex-1">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <Input
                value={draftSearch}
                onChange={(event) => setDraftSearch(event.target.value)}
                className="h-11 pl-9"
                placeholder="Buscar tarefas, projetos ou pessoas"
              />
            </label>
            <Button type="submit" className="h-11 md:w-32">
              Buscar
            </Button>
          </form>

          <Tabs value={filters.type} onValueChange={setType}>
            <TabsList className="w-full overflow-x-auto">
              {SEARCH_TYPES.map((type) => (
                <TabsTrigger key={type.value} value={type.value} className="shrink-0">
                  {type.label}
                  <span className="rounded bg-bg-3 px-1.5 py-0.5 text-[11px] text-text-muted">
                    {countForType(data, type.value)}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </section>

      <section className="grid gap-3 rounded-lg border border-border bg-bg-1 p-3 lg:grid-cols-[minmax(220px,1.15fr)_repeat(4,minmax(160px,1fr))]">
        <SearchableSelect
          value={filters.projectId ?? ""}
          options={projectOptions}
          triggerClassName="h-9"
          searchPlaceholder="Buscar projeto..."
          onValueChange={(value) => updateScalarFilter("projectId", value || null)}
        />
        <SearchableMultiSelect
          values={filters.status}
          options={statusOptions()}
          triggerClassName="h-9"
          searchPlaceholder="Buscar status..."
          noneSelectedLabel="Todos status"
          allSelectedLabel="Todos status"
          partialSelectedLabel={(count) => `${count} status`}
          onValuesChange={(values) => updateArrayFilter("status", values)}
        />
        <SearchableSelect
          value={filters.assigneeId ?? ""}
          options={userOptions}
          triggerClassName="h-9"
          searchPlaceholder="Buscar responsável..."
          onValueChange={(value) => updateScalarFilter("assigneeId", value || null)}
        />
        <SearchableMultiSelect
          values={filters.priority}
          options={priorityOptions()}
          triggerClassName="h-9"
          searchPlaceholder="Buscar prioridade..."
          noneSelectedLabel="Todas prioridades"
          allSelectedLabel="Todas prioridades"
          partialSelectedLabel={(count) => `${count} prioridades`}
          onValuesChange={(values) => updateArrayFilter("priority", values)}
        />
        <SearchableSelect
          value={filters.completion}
          options={COMPLETION_OPTIONS}
          triggerClassName="h-9"
          searchPlaceholder="Buscar conclusão..."
          onValueChange={(value) => updateScalarFilter("completion", value === "open" ? null : value)}
        />
        <DatePicker
          value={filters.dueFrom ?? null}
          onValueChange={(value) => updateScalarFilter("dueFrom", value)}
          placeholder="Entrega de"
          className="h-9 w-full justify-between px-3"
        />
        <DatePicker
          value={filters.dueTo ?? null}
          onValueChange={(value) => updateScalarFilter("dueTo", value)}
          placeholder="Entrega até"
          className="h-9 w-full justify-between px-3"
        />
        <Button
          type="button"
          variant="secondary"
          className="h-9 justify-center lg:col-start-5"
          onClick={() => navigate("/search")}
        >
          <X data-icon="inline-start" />
          Limpar filtros
        </Button>
      </section>

      {indicatorContext ? (
        <div className="flex items-center">
          <Badge tone="blue">{indicatorContext}</Badge>
        </div>
      ) : null}

      {advancedSearch.isLoading ? <SearchSkeleton /> : null}

      {!advancedSearch.isLoading && advancedSearch.isError ? (
        <div className="rounded-lg border border-border bg-bg-1 p-8 text-center text-sm text-text-secondary">
          Não foi possível carregar a pesquisa.
        </div>
      ) : null}

      {!advancedSearch.isLoading && !advancedSearch.isError && !hasResults ? (
        <div className="rounded-lg border border-border bg-bg-1 p-8 text-center">
          <p className="text-sm font-semibold text-text-primary">Nenhum resultado encontrado.</p>
          <p className="mt-1 text-sm text-text-secondary">Ajuste o termo ou remova alguns filtros.</p>
        </div>
      ) : null}

      {!advancedSearch.isLoading && !advancedSearch.isError && data ? (
        <div className="flex flex-col gap-4">
          {shouldShowSection(filters.type, "tasks") ? <TaskResults tasks={data.tasks.items} total={data.tasks.total} /> : null}
          {shouldShowSection(filters.type, "projects") ? <ProjectResults projects={data.projects.items} total={data.projects.total} /> : null}
          {shouldShowSection(filters.type, "users") ? <UserResults users={data.users.items} total={data.users.total} /> : null}
          {pageCount > 1 ? (
            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" disabled={filters.page <= 1} onClick={() => setPage(filters.page - 1)}>
                Anterior
              </Button>
              <span className="text-sm text-text-secondary">
                Página {filters.page} de {pageCount}
              </span>
              <Button variant="secondary" disabled={filters.page >= pageCount} onClick={() => setPage(filters.page + 1)}>
                Próxima
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function TaskResults({ tasks, total }: { tasks: AdvancedSearchTaskResult[]; total: number }) {
  return (
    <ResultSection icon={<BriefcaseBusiness size={16} />} title="Tarefas" total={total}>
      {tasks.map((task) => (
        <Link
          key={task.id}
          to={`/projects/${task.projectId}?task=${encodeURIComponent(task.id)}`}
          className="grid gap-2 border-b border-border-subtle px-3 py-3 transition hover:bg-surface-hover md:grid-cols-[minmax(220px,1fr)_170px_150px_130px_auto]"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text-primary">{task.title}</p>
            <p className="truncate text-xs text-text-muted">
              {task.projectName} / {task.sectionName}
            </p>
          </div>
          <div className="flex items-center">
            <TaskStatusBadge status={task.status} />
          </div>
          <div className="flex items-center">
            <PriorityBadge priority={task.priority} />
          </div>
          <div className="min-w-0 text-sm text-text-secondary">{task.assigneeName ?? "Sem responsável"}</div>
          <div className="flex items-center justify-between gap-2 text-sm text-text-muted">
            <span>{formatDate(task.dueDate)}</span>
            <ArrowRight size={15} />
          </div>
        </Link>
      ))}
    </ResultSection>
  );
}

function ProjectResults({ projects, total }: { projects: AdvancedSearchProjectResult[]; total: number }) {
  return (
    <ResultSection icon={<FolderKanban size={16} />} title="Projetos" total={total}>
      {projects.map((project) => (
        <Link
          key={project.id}
          to={`/projects/${project.id}`}
          className="grid gap-2 border-b border-border-subtle px-3 py-3 transition hover:bg-surface-hover md:grid-cols-[minmax(220px,1fr)_150px_120px_auto]"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text-primary">{project.name}</p>
            <p className="truncate text-xs text-text-muted">{project.client ?? "Sem construtora"}</p>
          </div>
          <div className="flex items-center">
            <ProjectStatusChip status={project.status} />
          </div>
          <div className="flex items-center">
            <Badge tone="muted">{project.platform ?? "Sem plataforma"}</Badge>
          </div>
          <div className="flex items-center justify-between gap-2 text-sm text-text-muted">
            <span>{formatDate(project.dueDate)}</span>
            <ArrowRight size={15} />
          </div>
        </Link>
      ))}
    </ResultSection>
  );
}

function UserResults({ users, total }: { users: AdvancedSearchUserResult[]; total: number }) {
  return (
    <ResultSection icon={<UserRound size={16} />} title="Pessoas" total={total}>
      {users.map((user) => (
        <Link
          key={user.id}
          to={`/users/${user.id}`}
          className="grid gap-2 border-b border-border-subtle px-3 py-3 transition hover:bg-surface-hover md:grid-cols-[minmax(220px,1fr)_140px_auto]"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text-primary">{user.name}</p>
            <p className="truncate text-xs text-text-muted">{user.email}</p>
          </div>
          <div className="flex items-center">
            <Badge tone="blue">{roleLabel(user.role)}</Badge>
          </div>
          <div className="flex items-center justify-end text-text-muted">
            <ArrowRight size={15} />
          </div>
        </Link>
      ))}
    </ResultSection>
  );
}

function ResultSection({ icon, title, total, children }: { icon: ReactNode; title: string; total: number; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-bg-1">
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          {icon}
          {title}
        </div>
        <Badge tone={total > 0 ? "orange" : "muted"}>{total}</Badge>
      </header>
      <div className={cn(total === 0 ? "p-6 text-center text-sm text-text-secondary" : "")}>
        {total === 0 ? "Nenhum resultado nesta categoria." : children}
      </div>
    </section>
  );
}

function SearchSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {[0, 1, 2].map((section) => (
        <div key={section} className="rounded-lg border border-border bg-bg-1 p-3">
          <Skeleton className="h-5 w-32" />
          <div className="mt-4 flex flex-col gap-3">
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} className="h-12 w-full" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function parseSearchFilters(searchParams: URLSearchParams): AdvancedSearchFilters {
  const type = parseType(searchParams.get("type"));
  const page = Math.max(Number(searchParams.get("page") ?? "1") || 1, 1);
  const completion = parseCompletion(searchParams.get("completion"));

  return {
    q: searchParams.get("q") ?? "",
    type,
    page,
    limit: LIMIT,
    projectId: searchParams.get("projectId") ?? undefined,
    status: searchParamArray(searchParams, "status"),
    assigneeId: searchParams.get("assigneeId") ?? undefined,
    priority: searchParamArray(searchParams, "priority"),
    dueFrom: searchParams.get("dueFrom") ?? undefined,
    dueTo: searchParams.get("dueTo") ?? undefined,
    completion,
    source: searchParams.get("source") === "indicators" ? "indicators" : undefined,
    indicatorMetric: parseIndicatorMetric(searchParams.get("indicatorMetric")),
    indicatorPeriod: parseIndicatorPeriod(searchParams.get("indicatorPeriod")),
    indicatorScope: parseIndicatorScope(searchParams.get("indicatorScope"))
  };
}

function searchParamArray(searchParams: URLSearchParams, key: string): string[] {
  return searchParams
    .getAll(key)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseType(value: string | null): AdvancedSearchType {
  return value === "tasks" || value === "projects" || value === "users" ? value : "all";
}

function parseCompletion(value: string | null): AdvancedSearchCompletion {
  return value === "completed" || value === "all" ? value : "open";
}

function parseIndicatorMetric(value: string | null): AdvancedSearchIndicatorMetric | undefined {
  return value === "openTasks" ||
    value === "completedTasks" ||
    value === "overdueTasks" ||
    value === "dueTasks" ||
    value === "allTasks"
    ? value
    : undefined;
}

function parseIndicatorPeriod(value: string | null): IndicatorPeriod | undefined {
  return value === "month" || value === "year" || value === "all" ? value : undefined;
}

function parseIndicatorScope(value: string | null): IndicatorScope | undefined {
  return value === "general" || value === "civil" || value === "electrical" ? value : undefined;
}

function clearIndicatorParams(searchParams: URLSearchParams) {
  searchParams.delete("source");
  searchParams.delete("indicatorMetric");
  searchParams.delete("indicatorPeriod");
  searchParams.delete("indicatorScope");
}

function indicatorContextLabel(filters: AdvancedSearchFilters): string | null {
  if (filters.source !== "indicators" || !filters.indicatorMetric || !filters.indicatorPeriod || !filters.indicatorScope) {
    return null;
  }

  return `Indicador: ${indicatorMetricLabel(filters.indicatorMetric)} · ${indicatorPeriodLabel(filters.indicatorPeriod)} · ${indicatorScopeLabel(filters.indicatorScope)}`;
}

function indicatorMetricLabel(metric: AdvancedSearchIndicatorMetric): string {
  const labels: Record<AdvancedSearchIndicatorMetric, string> = {
    openTasks: "Tarefas abertas",
    completedTasks: "Concluídas",
    overdueTasks: "Atrasadas",
    dueTasks: "Com entrega no período",
    allTasks: "Tarefas"
  };

  return labels[metric] ?? metric;
}

function indicatorPeriodLabel(period: IndicatorPeriod): string {
  const labels: Record<IndicatorPeriod, string> = {
    month: "Mês atual",
    year: "Ano atual",
    all: "Todos os tempos"
  };

  return labels[period];
}

function indicatorScopeLabel(scope: IndicatorScope): string {
  const labels: Record<IndicatorScope, string> = {
    general: "Geral",
    civil: "Civil",
    electrical: "Elétrico"
  };

  return labels[scope];
}

function shouldShowSection(current: AdvancedSearchType, section: Exclude<AdvancedSearchType, "all">): boolean {
  return current === "all" || current === section;
}

function countForType(data: AdvancedSearchResponse | undefined, type: AdvancedSearchType): number {
  if (!data) {
    return 0;
  }

  if (type === "tasks") {
    return data.tasks.total;
  }

  if (type === "projects") {
    return data.projects.total;
  }

  if (type === "users") {
    return data.users.total;
  }

  return data.tasks.total + data.projects.total + data.users.total;
}

function totalPages(data: AdvancedSearchResponse | undefined, type: AdvancedSearchType): number {
  if (!data) {
    return 1;
  }

  const totals = [
    shouldShowSection(type, "tasks") ? Math.ceil(data.tasks.total / data.tasks.limit) : 0,
    shouldShowSection(type, "projects") ? Math.ceil(data.projects.total / data.projects.limit) : 0,
    shouldShowSection(type, "users") ? Math.ceil(data.users.total / data.users.limit) : 0
  ];

  return Math.max(1, ...totals);
}

function statusOptions(): SearchableSelectOption[] {
  const taskOptions = Object.values(TaskStatus).map((status) => ({
    value: status,
    label: `Tarefa: ${taskStatusLabels[status]}`
  }));
  const projectOptions = Object.values(ProjectStatus).map((status) => ({
    value: status,
    label: `Projeto: ${projectStatusLabels[status]}`
  }));

  return [...taskOptions, ...projectOptions];
}

function priorityOptions(): SearchableSelectOption[] {
  return Object.values(Priority).map((priority) => ({
    value: priority,
    label: priorityLabels[priority]
  }));
}

function roleLabel(role: AdvancedSearchUserResult["role"]): string {
  if (role === "ADMIN") {
    return "Admin";
  }

  if (role === "COORDINATOR") {
    return "Coordenador";
  }

  if (role === "INTERN") {
    return "Estagiário";
  }

  return "Projetista";
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Sem data";
  }

  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}
