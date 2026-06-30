import { useCallback, useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis
} from "recharts";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  FolderKanban,
  PieChart as PieChartIcon,
  Users
} from "lucide-react";
import type {
  AdvancedSearchIndicatorMetric,
  IndicatorPeriod,
  IndicatorPortfolioYear,
  IndicatorPortfolioSection,
  IndicatorScope,
  IndicatorStatusPoint,
  IndicatorTasksSection,
  IndicatorTeamSection,
  IndicatorUserPoint,
  IndicatorValuePoint
} from "shared";
import { TaskStatus } from "shared";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "../components/ui/chart";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/shared/EmptyState";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { useIndicators } from "../hooks/useIndicators";
import { cn } from "../lib/utils";
import { projectIndicatorLink, taskIndicatorLink, workloadIndicatorLink } from "../lib/indicatorLinks";

type IndicatorTab = "tasks" | "portfolio" | "team";

const periodOptions: Array<{ value: IndicatorPeriod; label: string }> = [
  { value: "month", label: "Mês atual" },
  { value: "year", label: "Ano atual" },
  { value: "all", label: "Todos os tempos" }
];

const scopeOptions: Array<{ value: IndicatorScope; label: string }> = [
  { value: "general", label: "Geral" },
  { value: "civil", label: "Civil" },
  { value: "electrical", label: "Elétrico" }
];

const userChartConfig = {
  openTasks: { label: "Abertas", color: "var(--status-inprogress-text)" },
  completedTasks: { label: "Concluídas", color: "var(--status-done-text)" },
  overdueTasks: { label: "Atrasadas", color: "var(--status-late-text)" }
} satisfies ChartConfig;

const scopeChartConfig = {
  openTasks: { label: "Abertas", color: "var(--status-inprogress-text)" },
  completedTasks: { label: "Concluídas", color: "var(--status-done-text)" },
  overdueTasks: { label: "Atrasadas", color: "var(--status-late-text)" },
  estimatedDays: { label: "Dias estimados", color: "var(--color-brand-orange)" }
} satisfies ChartConfig;

const valueChartConfig = {
  value: { label: "Total", color: "var(--color-brand-orange)" }
} satisfies ChartConfig;

const numberFormatter = new Intl.NumberFormat("pt-BR");
const areaFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const INDICATORS_SCROLL_PREFIX = "mk:indicators:scroll:";

export function IndicatorsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const period = parseIndicatorPeriod(searchParams.get("period"));
  const scope = parseIndicatorScope(searchParams.get("scope"));
  const portfolioYear = parsePortfolioYear(searchParams.get("portfolioYear"));
  const tab = parseIndicatorTab(searchParams.get("tab"));
  const { data, isLoading, isError, refetch } = useIndicators({ period, scope, portfolioYear });

  const scopedLabel = scopeOptions.find((option) => option.value === scope)?.label ?? "Geral";
  const portfolioYearOptions = useMemo(
    () => [
      { value: "all", label: "Geral" },
      ...((data?.availablePortfolioYears ?? (portfolioYear === "all" ? [] : [portfolioYear])).map((year) => ({ value: year, label: year })))
    ],
    [data?.availablePortfolioYears, portfolioYear]
  );
  const scrollKey = `${INDICATORS_SCROLL_PREFIX}${location.pathname}${location.search}`;
  const rememberScroll = useCallback(() => {
    window.sessionStorage.setItem(scrollKey, String(currentIndicatorsScrollTop()));
  }, [scrollKey]);
  const navigateFromIndicator = useCallback((to: string) => {
    rememberScroll();
    navigate(to);
  }, [navigate, rememberScroll]);
  const updateParams = useCallback((mutator: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams);
    mutator(next);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (isLoading || !data) {
      return;
    }

    const storedScroll = window.sessionStorage.getItem(scrollKey);
    if (!storedScroll) {
      return;
    }

    window.requestAnimationFrame(() => {
      scrollIndicatorsViewportTo(Number(storedScroll) || 0);
    });
  }, [data, isLoading, scrollKey]);

  if (isError) {
    return (
      <div className="grid gap-4">
        <PageHeader
          tab={tab}
          period={period}
          scope={scope}
          portfolioYear={portfolioYear}
          portfolioYearOptions={portfolioYearOptions}
          onPeriodChange={(value) => updateParams((next) => next.set("period", value))}
          onScopeChange={(value) => updateParams((next) => next.set("scope", value))}
          onPortfolioYearChange={(value) => updateParams((next) => next.set("portfolioYear", value))}
        />
        <section className="rounded-md border border-[--color-border] bg-[--bg-2] p-6">
          <h1 className="text-[20px] font-semibold text-[--color-text-primary]">Não foi possível carregar os indicadores</h1>
          <p className="mt-2 text-[13px] text-[--color-text-secondary]">Tente atualizar os dados em alguns instantes.</p>
          <Button className="mt-4 h-9 px-3 text-[13px]" variant="secondary" onClick={() => void refetch()}>
            Atualizar
          </Button>
        </section>
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-4">
      <PageHeader
        tab={tab}
        period={period}
        scope={scope}
        portfolioYear={portfolioYear}
          portfolioYearOptions={portfolioYearOptions}
        onPeriodChange={(value) => updateParams((next) => next.set("period", value))}
        onScopeChange={(value) => updateParams((next) => next.set("scope", value))}
        onPortfolioYearChange={(value) => updateParams((next) => next.set("portfolioYear", value))}
      />

      <Tabs value={tab} onValueChange={(value) => updateParams((next) => next.set("tab", value))} className="grid gap-4">
        <TabsList className="w-full justify-start overflow-x-auto bg-transparent">
          <TabsTrigger value="tasks">Tarefas</TabsTrigger>
          <TabsTrigger value="portfolio">Projetos e Entregas</TabsTrigger>
          <TabsTrigger value="team">Equipe</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="grid gap-4">
          {isLoading || !data ? (
            <IndicatorsSkeleton />
          ) : (
            <TasksTab period={period} scope={scope} scopedLabel={scopedLabel} data={data.tasks} onNavigate={navigateFromIndicator} rememberScroll={rememberScroll} />
          )}
        </TabsContent>

        <TabsContent value="portfolio" className="grid gap-4">
          {isLoading || !data ? (
            <IndicatorsSkeleton />
          ) : (
            <PortfolioTab data={data.portfolio} onNavigate={navigateFromIndicator} rememberScroll={rememberScroll} />
          )}
        </TabsContent>

        <TabsContent value="team" className="grid gap-4">
          {isLoading || !data ? (
            <IndicatorsSkeleton />
          ) : (
            <TeamTab data={data.team} period={period} scope={scope} onNavigate={navigateFromIndicator} rememberScroll={rememberScroll} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PageHeader({
  tab,
  period,
  scope,
  portfolioYear,
  portfolioYearOptions,
  onPeriodChange,
  onScopeChange,
  onPortfolioYearChange
}: {
  tab: IndicatorTab;
  period: IndicatorPeriod;
  scope: IndicatorScope;
  portfolioYear: IndicatorPortfolioYear;
  portfolioYearOptions: Array<{ value: string; label: string }>;
  onPeriodChange: (period: IndicatorPeriod) => void;
  onScopeChange: (scope: IndicatorScope) => void;
  onPortfolioYearChange: (year: IndicatorPortfolioYear) => void;
}) {
  return (
    <header className="flex flex-col gap-4 rounded-md border border-[--color-border] bg-[--bg-2] px-5 py-4 xl:flex-row xl:items-end xl:justify-between">
      <div className="min-w-0">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-[--color-brand-orange]">Coordenação</p>
        <h1 className="mt-1 truncate text-[20px] font-semibold text-[--color-text-primary]">Indicadores</h1>
        <p className="mt-1 max-w-3xl text-[13px] text-[--color-text-secondary]">
          Métricas agregadas de tarefas, prazos, entregas e área projetada.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {tab === "portfolio" ? (
          <FilterSelect
            label="Ano da carteira"
            value={portfolioYear}
            options={portfolioYearOptions}
            onChange={(value) => onPortfolioYearChange(value as IndicatorPortfolioYear)}
          />
        ) : (
          <>
            <FilterSelect
              label="Período das tarefas"
              value={period}
              options={periodOptions}
              onChange={(value) => onPeriodChange(value as IndicatorPeriod)}
            />
            <FilterSelect
              label="Escopo das tarefas"
              value={scope}
              options={scopeOptions}
              onChange={(value) => onScopeChange(value as IndicatorScope)}
            />
          </>
        )}
      </div>
    </header>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid min-w-44 gap-1.5">
      <span className="text-[12px] font-medium text-[--color-text-secondary]">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 bg-[--bg-3] text-[13px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </label>
  );
}

function TasksTab({
  period,
  scope,
  scopedLabel,
  data,
  onNavigate,
  rememberScroll
}: {
  period: IndicatorPeriod;
  scope: IndicatorScope;
  scopedLabel: string;
  data: IndicatorTasksSection;
  onNavigate: (to: string) => void;
  rememberScroll: () => void;
}) {
  const statusData = useMemo(
    () => data.statusDistribution.map((point) => ({ ...point, fill: statusColor(point.status) })),
    [data.statusDistribution]
  );

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Tarefas abertas"
          value={data.kpis.openTasks}
          icon={<Clock3 size={16} />}
          to={taskIndicatorLink({ period, scope, completion: "open", metric: "openTasks" })}
          onNavigate={rememberScroll}
        />
        <MetricCard
          label="Concluídas"
          value={data.kpis.completedTasks}
          icon={<CheckCircle2 size={16} />}
          to={taskIndicatorLink({ period, scope, status: TaskStatus.FINISHED, completion: "completed", metric: "completedTasks" })}
          onNavigate={rememberScroll}
        />
        <MetricCard
          label="Atrasadas"
          value={data.kpis.overdueTasks}
          icon={<AlertTriangle size={16} />}
          tone="danger"
          to={taskIndicatorLink({ period, scope, status: TaskStatus.OVERDUE, metric: "overdueTasks" })}
          onNavigate={rememberScroll}
        />
        <MetricCard
          label="No prazo"
          value={`${data.kpis.onTimeRate}%`}
          icon={<BarChart3 size={16} />}
          helper={`${numberFormatter.format(data.kpis.dueTasks)} com entrega no período`}
          to={taskIndicatorLink({ period, scope, completion: "all", metric: "dueTasks" })}
          onNavigate={rememberScroll}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.8fr)]">
        <ChartPanel title={`Tarefas por responsável · ${scopedLabel}`} icon={<BarChart3 size={16} />}>
          {data.byUser.length === 0 ? (
            <EmptyState title="Sem tarefas para o período" />
          ) : (
            <ChartContainer config={userChartConfig} className="h-[320px] w-full aspect-auto [&_.recharts-bar-rectangle]:cursor-pointer">
              <BarChart data={userBarData(data.byUser)} margin={{ left: 0, right: 12, top: 12, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="initials" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={34} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="openTasks" stackId="tasks" fill="var(--status-inprogress-text)" radius={[0, 0, 4, 4]} isAnimationActive={false} onClick={(entry) => openUserTaskMetric(entry.payload, period, scope, "openTasks", onNavigate)} />
                <Bar dataKey="completedTasks" stackId="tasks" fill="var(--status-done-text)" isAnimationActive={false} onClick={(entry) => openUserTaskMetric(entry.payload, period, scope, "completedTasks", onNavigate)} />
                <Bar dataKey="overdueTasks" stackId="tasks" fill="var(--status-late-text)" radius={[4, 4, 0, 0]} isAnimationActive={false} onClick={(entry) => openUserTaskMetric(entry.payload, period, scope, "overdueTasks", onNavigate)} />
              </BarChart>
            </ChartContainer>
          )}
        </ChartPanel>

        <ChartPanel title="Distribuição por status" icon={<PieChartIcon size={16} />}>
          {statusData.length === 0 ? (
            <EmptyState title="Sem status para mostrar" />
          ) : (
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_170px] xl:grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_170px]">
              <div className="cursor-pointer" onClick={(event) => openPieSegmentFromClick(event, statusData, (point) => openTaskStatus(point, period, scope, onNavigate))}>
                <ChartContainer config={valueChartConfig} className="h-[260px] w-full aspect-auto [&_.recharts-pie-sector]:cursor-pointer">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent nameKey="label" hideLabel />} />
                    <Pie data={statusData} dataKey="value" nameKey="label" innerRadius={58} outerRadius={92} paddingAngle={2} isAnimationActive={false}>
                      {statusData.map((entry) => (
                        <Cell key={entry.status} fill={entry.fill} data-indicator-key={entry.status} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
              </div>
              <LegendList
                items={statusData.map((item) => ({ key: item.status, label: item.label, value: item.value, color: item.fill }))}
                linkFor={(item) => taskIndicatorLink({ period, scope, status: item.key as TaskStatus, completion: "all", metric: metricForTaskStatus(item.key as TaskStatus) })}
                onNavigate={rememberScroll}
              />
            </div>
          )}
        </ChartPanel>
      </div>

      <ChartPanel title="Responsáveis com atraso" icon={<AlertTriangle size={16} />}>
        {data.overdueByUser.length === 0 ? (
          <EmptyState title="Nenhum atraso no recorte atual" />
        ) : (
          <UserRanking rows={data.overdueByUser} period={period} scope={scope} mode="overdue" rememberScroll={rememberScroll} />
        )}
      </ChartPanel>
    </>
  );
}

function PortfolioTab({
  data,
  onNavigate,
  rememberScroll
}: {
  data: IndicatorPortfolioSection;
  onNavigate: (to: string) => void;
  rememberScroll: () => void;
}) {
  const platformData = data.byPlatform.map((point) => ({ ...point, fill: platformColor(point.key) }));
  const disciplineData = data.byDiscipline.slice(0, 12).map((point, index) => ({ ...point, fill: disciplineColor(index) }));
  const areaData = data.projectedAreaByDiscipline.slice(0, 10).map((point, index) => ({ ...point, fill: disciplineColor(index) }));

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Projetos" value={data.kpis.totalProjects} icon={<FolderKanban size={16} />} to="/projects" onNavigate={rememberScroll} />
        <MetricCard label="CAD" value={data.kpis.cadProjects} icon={<PieChartIcon size={16} />} to={projectIndicatorLink({ period: "all", platform: "CAD" })} onNavigate={rememberScroll} />
        <MetricCard label="BIM" value={data.kpis.bimProjects} icon={<PieChartIcon size={16} />} to={projectIndicatorLink({ period: "all", platform: "BIM" })} onNavigate={rememberScroll} />
        <MetricCard label="Área total" value={areaFormatter.format(data.kpis.areaM2)} helper="m² cadastrados" icon={<BarChart3 size={16} />} to="/projects" onNavigate={rememberScroll} />
        <MetricCard label="Área projetada" value={areaFormatter.format(data.kpis.projectedAreaM2)} helper="m² × disciplinas" icon={<BarChart3 size={16} />} to="/projects" onNavigate={rememberScroll} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(320px,0.75fr)_minmax(0,1.25fr)]">
        <ChartPanel title="Relação BIM / CAD" icon={<PieChartIcon size={16} />}>
          {platformData.length === 0 ? (
            <EmptyState title="Sem plataforma cadastrada" />
          ) : (
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_170px] xl:grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_170px]">
              <div className="cursor-pointer" onClick={(event) => openPieSegmentFromClick(event, platformData, (point) => openPlatform(point, onNavigate))}>
                <ChartContainer config={valueChartConfig} className="h-[260px] w-full aspect-auto [&_.recharts-pie-sector]:cursor-pointer">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent nameKey="label" hideLabel />} />
                    <Pie data={platformData} dataKey="value" nameKey="label" innerRadius={58} outerRadius={92} paddingAngle={2} isAnimationActive={false}>
                      {platformData.map((entry) => (
                        <Cell key={entry.key} fill={entry.fill} data-indicator-key={entry.key} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
              </div>
              <LegendList
                items={platformData.map((item) => ({ key: item.key, label: item.label, value: item.value, color: item.fill }))}
                linkFor={(item) => projectIndicatorLink({ period: "all", platform: item.key as "CAD" | "BIM" | "none" })}
                onNavigate={rememberScroll}
              />
            </div>
          )}
        </ChartPanel>

        <ChartPanel title="Projetos por disciplina" icon={<BarChart3 size={16} />}>
          {disciplineData.length === 0 ? (
            <EmptyState title="Sem disciplinas cadastradas" />
          ) : (
            <ChartContainer config={valueChartConfig} className="h-[300px] w-full aspect-auto [&_.recharts-bar-rectangle]:cursor-pointer">
              <BarChart data={disciplineData} margin={{ left: 0, right: 12, top: 12, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} angle={-35} textAnchor="end" height={84} />
                <YAxis tickLine={false} axisLine={false} width={34} />
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false} onClick={(entry) => openDiscipline(entry.payload, onNavigate)}>
                  {disciplineData.map((entry) => (
                    <Cell key={entry.key} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          )}
        </ChartPanel>
      </div>

      <ChartPanel title="Área projetada por disciplina" icon={<BarChart3 size={16} />}>
        {areaData.length === 0 ? (
          <EmptyState title="Sem área projetada para mostrar" />
        ) : (
          <ChartContainer config={valueChartConfig} className="h-[300px] w-full aspect-auto [&_.recharts-bar-rectangle]:cursor-pointer">
            <BarChart data={areaData} margin={{ left: 0, right: 16, top: 12, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} angle={-30} textAnchor="end" height={78} />
              <YAxis tickLine={false} axisLine={false} width={72} tickFormatter={(value) => areaFormatter.format(Number(value))} />
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false} onClick={(entry) => openDiscipline(entry.payload, onNavigate)}>
                {areaData.map((entry) => (
                  <Cell key={entry.key} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </ChartPanel>

      <div className="grid gap-4 xl:grid-cols-2">
        {data.statusGroups.map((group) => (
          <ChartPanel key={group.fieldKey} title={group.label} icon={<PieChartIcon size={16} />}>
            {group.values.length === 0 ? (
              <EmptyState title="Sem dados para este campo" />
            ) : (
              <CompactDistribution
                values={group.values}
                linkFor={(value) => projectIndicatorLink({ period: "all", portfolioField: { fieldKey: group.fieldKey, type: "enum", value: value.label } })}
                onNavigate={rememberScroll}
              />
            )}
          </ChartPanel>
        ))}
      </div>
    </>
  );
}

function TeamTab({
  data,
  period,
  scope,
  onNavigate,
  rememberScroll
}: {
  data: IndicatorTeamSection;
  period: IndicatorPeriod;
  scope: IndicatorScope;
  onNavigate: (to: string) => void;
  rememberScroll: () => void;
}) {
  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <ChartPanel title="Comparação por equipe operacional" icon={<Users size={16} />}>
          <ChartContainer config={scopeChartConfig} className="h-[320px] w-full aspect-auto [&_.recharts-bar-rectangle]:cursor-pointer">
            <BarChart data={data.byScope} margin={{ left: 0, right: 12, top: 12, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} width={34} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="openTasks" fill="var(--status-inprogress-text)" radius={[4, 4, 0, 0]} isAnimationActive={false} onClick={(entry) => openWorkloadScope(entry.payload, onNavigate)} />
              <Bar dataKey="completedTasks" fill="var(--status-done-text)" radius={[4, 4, 0, 0]} isAnimationActive={false} onClick={(entry) => openWorkloadScope(entry.payload, onNavigate)} />
              <Bar dataKey="overdueTasks" fill="var(--status-late-text)" radius={[4, 4, 0, 0]} isAnimationActive={false} onClick={(entry) => openWorkloadScope(entry.payload, onNavigate)} />
            </BarChart>
          </ChartContainer>
        </ChartPanel>

        <ChartPanel title="Atalhos por escopo" icon={<FolderKanban size={16} />}>
          <div className="grid gap-2">
            {data.byScope.map((item) => (
              <Link key={item.scope} to={workloadIndicatorLink(item.scope)} onClick={rememberScroll} className="rounded-md border border-[--color-border-subtle] bg-[--bg-1] p-3 transition-colors hover:bg-[--bg-3]">
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <span className="font-semibold text-[--color-text-primary]">{item.label}</span>
                  <span className="text-[12px] text-[--color-brand-orange]">Abrir workload</span>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2 text-[11px]">
                  <SmallMetric label="Abertas" value={item.openTasks} />
                  <SmallMetric label="Concl." value={item.completedTasks} />
                  <SmallMetric label="Atras." value={item.overdueTasks} danger />
                  <SmallMetric label="Dias" value={item.estimatedDays} />
                </div>
              </Link>
            ))}
          </div>
        </ChartPanel>
      </div>

      <ChartPanel title="Ranking da equipe" icon={<Users size={16} />}>
        {data.byUser.length === 0 ? (
          <EmptyState title="Sem tarefas para ranquear" />
        ) : (
          <UserRanking rows={data.byUser} period={period} scope={scope} mode="team" rememberScroll={rememberScroll} />
        )}
      </ChartPanel>
    </>
  );
}

function ChartPanel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-md border border-[--color-border] bg-[--bg-2] p-4">
      <div className="mb-4 flex min-w-0 items-center gap-2">
        <span className="shrink-0 text-[--color-text-secondary]" aria-hidden="true">
          {icon}
        </span>
        <h2 className="truncate text-[16px] font-semibold text-[--color-text-primary]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function MetricCard({
  label,
  value,
  icon,
  to,
  helper,
  onNavigate,
  tone = "default"
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  to: string;
  helper?: string;
  onNavigate?: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <Link to={to} onClick={onNavigate} className="cursor-pointer rounded-md border border-[--color-border] bg-[--bg-2] p-4 transition-colors hover:bg-[--bg-3]">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px] font-medium text-[--color-text-secondary]">{label}</span>
        <span className={cn("text-[--color-text-secondary]", tone === "danger" && "text-[--status-late-text]")} aria-hidden="true">
          {icon}
        </span>
      </div>
      <p className={cn("mt-3 break-words text-[24px] font-semibold leading-tight text-[--color-text-primary]", tone === "danger" && "text-[--status-late-text]")}>
        {typeof value === "number" ? numberFormatter.format(value) : value}
      </p>
      <p className="mt-2 truncate text-[12px] text-[--color-text-muted]">{helper ?? "Ver registros"}</p>
    </Link>
  );
}

function UserRanking({
  rows,
  period,
  scope,
  mode,
  rememberScroll
}: {
  rows: IndicatorUserPoint[];
  period: IndicatorPeriod;
  scope: IndicatorScope;
  mode: "overdue" | "team";
  rememberScroll: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-[--color-border-subtle]">
      <div className="grid grid-cols-[minmax(180px,1fr)_90px_90px_90px_90px] gap-3 border-b border-[--color-border] bg-[--bg-1] px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-[--color-text-muted] max-lg:hidden">
        <span>Responsável</span>
        <span>Abertas</span>
        <span>Concluídas</span>
        <span>Atrasadas</span>
        <span>Dias est.</span>
      </div>
      <div className="grid">
        {rows.map((row) => (
          <Link
            key={row.userId ?? "unassigned"}
            to={taskIndicatorLink({
              period,
              scope,
              assigneeId: row.userId,
              status: mode === "overdue" ? TaskStatus.OVERDUE : undefined,
              metric: mode === "overdue" ? "overdueTasks" : "allTasks"
            })}
            onClick={rememberScroll}
            className="grid grid-cols-[minmax(180px,1fr)_90px_90px_90px_90px] items-center gap-3 border-b border-[--color-border-subtle] px-3 py-2 text-[13px] transition-colors last:border-b-0 hover:bg-[--bg-3] max-lg:grid-cols-2 max-lg:gap-2"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[--bg-4] text-[11px] font-semibold text-[--color-text-primary]">
                {row.initials}
              </span>
              <span className="truncate font-medium text-[--color-text-primary]">{row.userName}</span>
            </span>
            <RankingNumber label="Abertas" value={row.openTasks} />
            <RankingNumber label="Concluídas" value={row.completedTasks} />
            <RankingNumber label="Atrasadas" value={row.overdueTasks} danger />
            <RankingNumber label="Dias est." value={row.estimatedDays} />
          </Link>
        ))}
      </div>
    </div>
  );
}

function RankingNumber({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <span className="flex min-w-0 items-center justify-between gap-2 max-lg:rounded-md max-lg:bg-[--bg-1] max-lg:px-2 max-lg:py-1">
      <span className="hidden text-[11px] text-[--color-text-muted] max-lg:inline">{label}</span>
      <strong className={cn("font-mono text-[12px] font-medium text-[--color-text-primary]", danger && value > 0 && "text-[--status-late-text]")}>
        {numberFormatter.format(value)}
      </strong>
    </span>
  );
}

function LegendList({
  items,
  linkFor,
  onNavigate
}: {
  items: Array<{ key: string; label: string; value: number; color: string }>;
  linkFor?: (item: { key: string; label: string; value: number; color: string }) => string;
  onNavigate?: () => void;
}) {
  return (
    <div className="grid content-center gap-2">
      {items.map((item) => {
        const content = (
          <>
            <span className="flex min-w-0 items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} />
              <span className="truncate text-[--color-text-secondary]">{item.label}</span>
            </span>
            <strong className="font-mono font-medium text-[--color-text-primary]">{numberFormatter.format(item.value)}</strong>
          </>
        );
        const link = linkFor?.(item);

        return link ? (
          <Link key={item.key} to={link} onClick={onNavigate} className="flex min-w-0 cursor-pointer items-center justify-between gap-3 rounded px-1 py-0.5 text-[12px] transition-colors hover:bg-[--bg-3]">
            {content}
          </Link>
        ) : (
          <div key={item.key} className="flex min-w-0 items-center justify-between gap-3 text-[12px]">
            {content}
          </div>
        );
      })}
    </div>
  );
}

function CompactDistribution({
  values,
  linkFor,
  onNavigate
}: {
  values: IndicatorValuePoint[];
  linkFor: (value: IndicatorValuePoint) => string;
  onNavigate?: () => void;
}) {
  const max = Math.max(...values.map((value) => value.value), 1);

  return (
    <div className="grid gap-2">
      {values.map((value, index) => (
        <Link key={value.key} to={linkFor(value)} onClick={onNavigate} className="grid cursor-pointer gap-1 rounded-md px-2 py-1.5 transition-colors hover:bg-[--bg-3]">
          <div className="flex min-w-0 items-center justify-between gap-3 text-[12px]">
            <span className="truncate font-medium text-[--color-text-primary]">{value.label}</span>
            <span className="font-mono text-[--color-text-secondary]">{numberFormatter.format(value.value)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[--bg-4]">
            <div className="h-full rounded-full" style={{ width: `${(value.value / max) * 100}%`, backgroundColor: disciplineColor(index) }} />
          </div>
        </Link>
      ))}
    </div>
  );
}

function SmallMetric({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <span className="min-w-0 rounded-md bg-[--bg-2] px-2 py-1">
      <span className="block truncate text-[--color-text-muted]">{label}</span>
      <strong className={cn("mt-0.5 block font-mono text-[--color-text-primary]", danger && value > 0 && "text-[--status-late-text]")}>
        {numberFormatter.format(value)}
      </strong>
    </span>
  );
}

function IndicatorsSkeleton() {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    </>
  );
}

function userBarData(rows: IndicatorUserPoint[]) {
  return rows.map((row) => ({
    ...row,
    initials: row.initials,
    label: row.userName
  }));
}

function parseIndicatorTab(value: string | null): IndicatorTab {
  return value === "portfolio" || value === "team" || value === "tasks" ? value : "tasks";
}

function parseIndicatorPeriod(value: string | null): IndicatorPeriod {
  return value === "year" || value === "all" || value === "month" ? value : "month";
}

function parseIndicatorScope(value: string | null): IndicatorScope {
  return value === "civil" || value === "electrical" || value === "general" ? value : "general";
}

function parsePortfolioYear(value: string | null): IndicatorPortfolioYear {
  return value === "all" || (value !== null && /^\d{4}$/.test(value)) ? (value as IndicatorPortfolioYear) : "all";
}

function openUserTaskMetric(
  payload: unknown,
  period: IndicatorPeriod,
  scope: IndicatorScope,
  metric: AdvancedSearchIndicatorMetric,
  onNavigate: (to: string) => void
) {
  if (!isRecord(payload)) {
    return;
  }

  const userId = typeof payload.userId === "string" ? payload.userId : null;
  onNavigate(taskIndicatorLink({
    period,
    scope,
    assigneeId: userId,
    status: metric === "overdueTasks" ? TaskStatus.OVERDUE : metric === "completedTasks" ? TaskStatus.FINISHED : undefined,
    completion: metric === "completedTasks" ? "completed" : metric === "openTasks" ? "open" : "all",
    metric
  }));
}

function openTaskStatus(
  payload: unknown,
  period: IndicatorPeriod,
  scope: IndicatorScope,
  onNavigate: (to: string) => void
) {
  const point = rechartsPayload(payload);
  if (!isRecord(point) || !Object.values(TaskStatus).includes(point.status as TaskStatus)) {
    return;
  }

  const status = point.status as TaskStatus;
  onNavigate(taskIndicatorLink({
    period,
    scope,
    status,
    completion: "all",
    metric: metricForTaskStatus(status)
  }));
}

function metricForTaskStatus(status: TaskStatus): AdvancedSearchIndicatorMetric {
  if (status === TaskStatus.OVERDUE) {
    return "overdueTasks";
  }

  if (status === TaskStatus.FINISHED) {
    return "completedTasks";
  }

  return "allTasks";
}

function openPlatform(payload: unknown, onNavigate: (to: string) => void) {
  const point = rechartsPayload(payload);
  if (!isRecord(point) || (point.key !== "CAD" && point.key !== "BIM" && point.key !== "none")) {
    return;
  }

  onNavigate(projectIndicatorLink({ period: "all", platform: point.key }));
}

function openDiscipline(payload: unknown, onNavigate: (to: string) => void) {
  const point = rechartsPayload(payload);
  if (!isRecord(point) || typeof point.label !== "string") {
    return;
  }

  onNavigate(projectIndicatorLink({ period: "all", discipline: point.label }));
}

function openWorkloadScope(payload: unknown, onNavigate: (to: string) => void) {
  const point = rechartsPayload(payload);
  if (!isRecord(point) || (point.scope !== "general" && point.scope !== "civil" && point.scope !== "electrical")) {
    return;
  }

  onNavigate(workloadIndicatorLink(point.scope));
}

function openPieSegmentFromClick<TPoint extends { value: number }>(
  event: React.MouseEvent<HTMLElement>,
  points: TPoint[],
  onPoint: (point: TPoint) => void
) {
  if (points.length === 0) {
    return;
  }

  const targetKey = event.target instanceof Element ? event.target.closest("[data-indicator-key]")?.getAttribute("data-indicator-key") : null;
  if (targetKey) {
    const targetPoint = points.find((point) => pointIdentity(point) === targetKey);
    if (targetPoint) {
      onPoint(targetPoint);
      return;
    }
  }

  if (event.target === event.currentTarget || event.target instanceof SVGSVGElement) {
    onPoint(points[0]!);
    return;
  }

  const rect = event.currentTarget.getBoundingClientRect();
  const x = event.clientX - rect.left - rect.width / 2;
  const y = event.clientY - rect.top - rect.height / 2;
  const angle = (Math.atan2(y, x) * 180) / Math.PI;
  const normalizedAngle = (angle + 360) % 360;
  const total = points.reduce((sum, point) => sum + point.value, 0);
  if (total <= 0) {
    return;
  }

  let cursor = 0;
  for (const point of points) {
    cursor += (point.value / total) * 360;
    if (normalizedAngle <= cursor) {
      onPoint(point);
      return;
    }
  }

  onPoint(points[points.length - 1]!);
}

function pointIdentity(point: unknown): string | null {
  if (!isRecord(point)) {
    return null;
  }

  if (typeof point.key === "string") {
    return point.key;
  }

  if (typeof point.status === "string") {
    return point.status;
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

function rechartsPayload(value: unknown): unknown {
  if (isRecord(value) && isRecord(value.payload)) {
    return value.payload;
  }

  return value;
}

function indicatorsScrollContainer(): HTMLElement | null {
  return document.querySelector("main");
}

function currentIndicatorsScrollTop(): number {
  return indicatorsScrollContainer()?.scrollTop ?? window.scrollY;
}

function scrollIndicatorsViewportTo(top: number) {
  const container = indicatorsScrollContainer();
  if (container) {
    container.scrollTo({ top });
    return;
  }

  window.scrollTo({ top });
}

function statusColor(status: TaskStatus): string {
  const colors: Record<TaskStatus, string> = {
    [TaskStatus.BACKLOG]: "var(--status-backlog-text)",
    [TaskStatus.TODO]: "var(--status-todo-text)",
    [TaskStatus.ON_SCHEDULE]: "var(--status-scheduled-text)",
    [TaskStatus.OVERDUE]: "var(--status-late-text)",
    [TaskStatus.IN_PROGRESS]: "var(--status-inprogress-text)",
    [TaskStatus.AWAITING_REVIEW]: "var(--status-review-text)",
    [TaskStatus.IN_ANALYSIS]: "var(--status-analysis-text)",
    [TaskStatus.AWAITING_DEFINITION]: "var(--status-waiting-text)",
    [TaskStatus.FINISHED]: "var(--status-done-text)"
  };

  return colors[status];
}

function platformColor(key: string): string {
  if (key === "CAD") {
    return "var(--plat-cad-text)";
  }

  if (key === "BIM") {
    return "var(--plat-revit-text)";
  }

  return "var(--plat-none-text)";
}

function disciplineColor(index: number): string {
  const colors = [
    "var(--disc-ele-text)",
    "var(--disc-hid-text)",
    "var(--disc-ppci-text)",
    "var(--disc-tel-text)",
    "var(--disc-spda-text)",
    "var(--disc-gas-text)",
    "var(--disc-hvac-text)",
    "var(--disc-sprinkler-text)",
    "var(--disc-auto-text)",
    "var(--disc-exhaust-text)"
  ];

  return colors[index % colors.length] ?? "var(--disc-none-text)";
}
