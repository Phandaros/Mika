import { Link } from "react-router-dom";
import { TaskStatus, type TeamBoardColumnDto, type TeamBoardTaskDto } from "shared";
import { Avatar } from "../shared/Avatar";
import { splitTeamBoardTasks } from "../../lib/teamBoardMetrics";
import { TeamBoardOtherTasksPopover } from "./TeamBoardOtherTasksPopover";
import { TeamBoardTaskCard } from "./TeamBoardTaskCard";

interface TeamBoardDesignerSectionProps {
  column: TeamBoardColumnDto;
  today: string;
  nonWorkingDays: Set<string>;
  onOpenTask: (task: TeamBoardTaskDto) => void;
}

export function TeamBoardDesignerSection({
  column,
  today,
  nonWorkingDays,
  onOpenTask
}: TeamBoardDesignerSectionProps) {
  const { user, summary, tasks } = column;
  const { primary, secondary } = splitTeamBoardTasks(tasks);
  const inProgressCount = tasks.filter((task) => task.status === TaskStatus.IN_PROGRESS).length;

  return (
    <section className="rounded-md border border-border bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={user.name} imageUrl={user.avatarUrl} className="h-8 w-8" />
          <div className="min-w-0">
            <Link to={`/users/${user.id}`} className="truncate text-sm font-bold text-text-primary hover:text-brand-orange">
              {user.name}
            </Link>
            <p className="mt-0.5 text-xs text-text-muted">
              {inProgressCount > 0
                ? `${inProgressCount} em andamento`
                : primary.length > 0
                  ? `${primary.length} atrasada${primary.length === 1 ? "" : "s"} em execução`
                  : "Sem tarefa em execução"}
              {summary.awaitingReviewCount > 0 ? ` · ${summary.awaitingReviewCount} em revisão` : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {summary.overdueCount > 0 ? (
            <span className="rounded-md bg-[var(--status-late-bg)] px-2 py-1 text-[11px] font-semibold text-[var(--status-late-text)]">
              {summary.overdueCount} atrasada{summary.overdueCount === 1 ? "" : "s"}
            </span>
          ) : null}
          <TeamBoardOtherTasksPopover
            tasks={secondary}
            today={today}
            nonWorkingDays={nonWorkingDays}
            onOpenTask={onOpenTask}
          />
        </div>
      </header>

      <div className="p-4">
        {primary.length === 0 ? (
          <p className="text-sm text-text-muted">Nenhuma tarefa em execução</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {primary.map((task) => (
              <TeamBoardTaskCard
                key={task.id}
                task={task}
                today={today}
                nonWorkingDays={nonWorkingDays}
                onOpen={onOpenTask}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
