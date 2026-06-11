import { format } from "date-fns";
import { Search, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { Task, TeamBoardColumnDto, TeamBoardTaskDto } from "shared";
import { LoadingSpinner } from "../components/shared/LoadingSpinner";
import { TeamBoardDesignerSection } from "../components/team/TeamBoardDesignerSection";
import { TaskDetail } from "../components/task/TaskDetail";
import { useCompanyHolidays } from "../hooks/useCompanyHolidays";
import { useTaskById } from "../hooks/useTasks";
import { useTeamBoard } from "../hooks/useTeamBoard";
import {
  buildTeamBoardNonWorkingDays,
  countInProgressTasks,
  sortDesignerColumns
} from "../lib/teamBoardMetrics";
import { cn } from "../lib/utils";

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

function columnMatchesSearch(column: TeamBoardColumnDto, search: string): TeamBoardColumnDto | null {
  if (!search) {
    return column;
  }

  const userMatch = column.user.name.toLowerCase().includes(search);
  const filteredTasks = column.tasks.filter((task) => taskMatchesSearch(task, search));

  if (!userMatch && filteredTasks.length === 0) {
    return null;
  }

  return {
    ...column,
    tasks: userMatch ? column.tasks : filteredTasks
  };
}

function taskMatchesSearch(task: TeamBoardTaskDto, search: string): boolean {
  const projectName = task.discipline?.projectName ?? task.projects?.[0]?.name ?? "";
  const sectionName = task.discipline?.name ?? task.projects?.[0]?.sectionName ?? "";

  return [task.title, projectName, sectionName].some((value) => value.toLowerCase().includes(search));
}

export function TeamBoardPage() {
  const today = format(new Date(), "yyyy-MM-dd");
  const holidayFrom = format(new Date(new Date().getFullYear(), 0, 1), "yyyy-MM-dd");
  const holidayTo = format(new Date(new Date().getFullYear(), 11, 31), "yyyy-MM-dd");
  const [search, setSearch] = useState("");
  const [includeEmpty, setIncludeEmpty] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const taskIdFromUrl = searchParams.get("task");
  const { data: taskFromApi } = useTaskById(taskIdFromUrl);
  const { data, isLoading } = useTeamBoard({ includeEmpty });
  const { data: holidays = [] } = useCompanyHolidays(holidayFrom, holidayTo);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskDetailOpenVersion, setTaskDetailOpenVersion] = useState(0);

  const nonWorkingDays = useMemo(
    () => buildTeamBoardNonWorkingDays(holidayFrom, holidayTo, holidays.map((holiday) => holiday.date)),
    [holidayFrom, holidayTo, holidays]
  );

  const normalizedSearch = normalizeSearch(search);

  const visibleColumns = useMemo(() => {
    if (!data?.columns) {
      return [];
    }

    return sortDesignerColumns(
      data.columns
        .map((column) => columnMatchesSearch(column, normalizedSearch))
        .filter((column): column is TeamBoardColumnDto => column !== null)
    );
  }, [data?.columns, normalizedSearch]);

  const inProgressCount = useMemo(() => countInProgressTasks(data?.columns ?? []), [data?.columns]);

  useEffect(() => {
    if (!taskIdFromUrl) {
      setSelectedTask(null);
      return;
    }

    if (taskFromApi?.id === taskIdFromUrl) {
      setSelectedTask(taskFromApi);
    }
  }, [taskIdFromUrl, taskFromApi]);

  function openTaskDetail(task: TeamBoardTaskDto) {
    setTaskDetailOpenVersion((version) => version + 1);
    setSelectedTask(task);
    const next = new URLSearchParams(searchParams);
    next.set("task", task.id);
    setSearchParams(next, { replace: true });
  }

  function closeTaskDetail() {
    setSelectedTask(null);
    const next = new URLSearchParams(searchParams);
    next.delete("task");
    setSearchParams(next, { replace: true });
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const totals = data?.totals ?? { activeTasks: 0, overdueTasks: 0, designersWithTasks: 0 };

  return (
    <div className="grid min-w-0 gap-5">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold uppercase text-brand-orange">Coordenação</p>
          <h1 className="mt-1 text-2xl font-bold text-text-primary">Quadro do Time</h1>
          <p className="mt-2 max-w-3xl text-sm text-text-secondary">
            Tarefas em execução por projetista. Passe o mouse em &quot;+N outras&quot; para ver revisão e demais status.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-sm">
          <Metric label="Em andamento" value={inProgressCount} />
          <Metric label="Atrasadas" value={totals.overdueTasks} />
          <Metric label="Com tarefas" value={totals.designersWithTasks} />
        </div>
      </header>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative block max-w-md flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por tarefa, projeto ou projetista..."
            className="h-10 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm text-text-primary outline-none transition focus:border-brand-orange"
          />
        </label>

        <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={includeEmpty}
            onChange={(event) => setIncludeEmpty(event.target.checked)}
            className="rounded border-border bg-surface"
          />
          Mostrar projetistas sem tarefas
        </label>
      </div>

      {visibleColumns.length === 0 ? (
        <div className="rounded-md border border-border bg-surface px-6 py-16 text-center">
          <Users size={32} className="mx-auto text-text-muted" />
          <p className="mt-4 text-sm font-semibold text-text-primary">Nenhum resultado encontrado</p>
          <p className="mt-1 text-sm text-text-secondary">Ajuste a busca ou inclua projetistas sem tarefas.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {visibleColumns.map((column) => (
            <TeamBoardDesignerSection
              key={column.user.id}
              column={column}
              today={today}
              nonWorkingDays={nonWorkingDays}
              onOpenTask={openTaskDetail}
            />
          ))}
        </div>
      )}

      <TaskDetail task={selectedTask} onClose={closeTaskDetail} openVersion={taskDetailOpenVersion} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className={cn("min-w-24 rounded-md border border-border bg-surface px-3 py-2")}>
      <p className="text-[11px] font-semibold uppercase text-text-muted">{label}</p>
      <p className="mt-1 text-lg font-bold text-text-primary">{value}</p>
    </div>
  );
}
