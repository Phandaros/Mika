import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  ListChecks,
  MessageSquareText,
  TimerReset
} from "lucide-react";
import type { HomeDashboardActivity, HomeDashboardResponse } from "shared";
import { EmptyState } from "../shared/EmptyState";
import {
  ActivitySkeleton,
  formatActivityDate,
  MetricPill,
  MetricsSkeleton,
  MyWeeklyReportCard,
  Panel,
  PanelLink,
  ReviewList,
  TaskListSkeleton,
  TaskPriorityList,
  WeeklyReportsSummary
} from "./HomeDashboardParts";

interface PersonalHomeSectionsProps {
  data: HomeDashboardResponse | undefined;
  isLoading: boolean;
  onOpenTask: (taskId: string) => void;
  tasksLinkTo: string;
  tasksLinkLabel?: string;
  tasksPanelTitle?: string;
  reviewsLinkTo?: string;
  weeklyReportsLinkTo?: string;
  weeklyReportTitle?: string;
  showRecentActivity?: boolean;
  recentActivity?: HomeDashboardActivity[];
}

export function PersonalHomeSections({
  data,
  isLoading,
  onOpenTask,
  tasksLinkTo,
  tasksLinkLabel = "Ver todas as tarefas",
  tasksPanelTitle = "Prioridades de hoje",
  reviewsLinkTo = "/reviews",
  weeklyReportsLinkTo,
  weeklyReportTitle = "Meu relatório",
  showRecentActivity = false,
  recentActivity
}: PersonalHomeSectionsProps) {
  const resolvedWeeklyReportsLink =
    weeklyReportsLinkTo ?? (data?.myWeeklyReport !== undefined ? "/weekly-reports/mine" : "/weekly-reports");

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {isLoading ? (
          <MetricsSkeleton />
        ) : (
          <>
            <MetricPill label="Abertas" value={data?.stats.assignedOpen} loading={isLoading} icon={<ListChecks size={14} />} />
            <MetricPill label="Hoje" value={data?.stats.dueToday} loading={isLoading} icon={<CalendarClock size={14} />} />
            <MetricPill label="Atrasadas" value={data?.stats.overdue} loading={isLoading} tone="danger" icon={<AlertTriangle size={14} />} />
            <MetricPill label="Concluídas na semana" value={data?.stats.completedThisWeek} loading={isLoading} icon={<CheckCircle2 size={14} />} />
          </>
        )}
      </div>

      <main className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
        <Panel
          title={tasksPanelTitle}
          icon={<TimerReset size={16} />}
          action={<PanelLink to={tasksLinkTo}>{tasksLinkLabel}</PanelLink>}
        >
          {isLoading ? <TaskListSkeleton /> : <TaskPriorityList tasks={data?.myTasks ?? []} onOpenTask={onOpenTask} />}
        </Panel>

        <div className="grid gap-4">
          {data?.myReviews ? (
            <Panel
              title="Minhas revisões"
              icon={<ClipboardCheck size={16} />}
              compact
              action={<PanelLink to={reviewsLinkTo}>Ver fila</PanelLink>}
            >
              <div className="mb-3 flex items-center justify-between rounded-md border border-[--color-border-subtle] bg-[--bg-1] px-3 py-2">
                <span className="text-[12px] text-[--color-text-secondary]">Pendentes atribuídas</span>
                <strong className="text-[13px] text-[--color-text-primary]">{data.myReviews.totalPendingMine}</strong>
              </div>
              <ReviewList reviews={data.myReviews.items} onOpenTask={onOpenTask} />
            </Panel>
          ) : null}

          {data?.myWeeklyReport !== undefined || data?.weeklyReportsSummary ? (
            <Panel
              title="Relatórios semanais"
              icon={<ClipboardList size={16} />}
              compact
              action={<PanelLink to={resolvedWeeklyReportsLink}>Abrir</PanelLink>}
            >
              {data.myWeeklyReport !== undefined ? (
                <MyWeeklyReportCard report={data.myWeeklyReport} title={weeklyReportTitle} />
              ) : null}
              {data.weeklyReportsSummary ? <WeeklyReportsSummary summary={data.weeklyReportsSummary} /> : null}
            </Panel>
          ) : null}

          {showRecentActivity ? (
            <Panel title="Atividade recente" icon={<MessageSquareText size={16} />} compact>
              {isLoading ? (
                <ActivitySkeleton />
              ) : (recentActivity?.length ?? 0) === 0 ? (
                <EmptyState title="Sem atividade recente" />
              ) : (
                <ul className="grid gap-2">
                  {recentActivity?.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        disabled={!item.taskId}
                        onClick={() => item.taskId && onOpenTask(item.taskId)}
                        className="grid w-full gap-1 rounded-md border border-[--color-border-subtle] bg-[--bg-1] px-3 py-2 text-left transition-colors hover:bg-[--bg-3] disabled:cursor-default disabled:hover:bg-[--bg-1]"
                      >
                        <span className="truncate text-[13px] font-medium text-[--color-text-primary]">{item.title}</span>
                        <span className="line-clamp-2 text-[12px] text-[--color-text-secondary]">{item.subtitle}</span>
                        <span className="text-[11px] text-[--color-text-muted]">{formatActivityDate(item.at)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          ) : null}
        </div>
      </main>
    </div>
  );
}
