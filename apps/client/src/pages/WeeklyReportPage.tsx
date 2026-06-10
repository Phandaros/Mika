import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ClipboardList } from "lucide-react";
import { Role, TaskStatus, type WeeklyReportItemDto, type WeeklyReportStatus } from "shared";
import { Chip, taskStatusLabels, taskStatusTokens } from "../components/shared/Chip";
import { EmptyState } from "../components/shared/EmptyState";
import { LoadingSpinner } from "../components/shared/LoadingSpinner";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { useAuth } from "../hooks/useAuth";
import {
  useMyWeeklyReport,
  useSubmitWeeklyReport,
  useUpdateWeeklyReportItem
} from "../hooks/useMyWeeklyReport";
import { cn } from "../lib/utils";

const reportStatusConfig: Record<
  WeeklyReportStatus,
  { label: string; bg: string; text: string }
> = {
  PENDING: { label: "Pendente", bg: "--status-review-bg", text: "--status-review-text" },
  SUBMITTED: { label: "Enviado", bg: "--status-done-bg", text: "--status-done-text" },
  LATE: { label: "Atrasado", bg: "--status-late-bg", text: "--status-late-text" }
};

function isTaskStatus(value: string): value is TaskStatus {
  return Object.values(TaskStatus).includes(value as TaskStatus);
}

function TaskStatusChip({ status }: { status: string }) {
  if (!isTaskStatus(status)) {
    return <Chip bg="--status-todo-bg" text="--status-todo-text">{status}</Chip>;
  }

  const tokens = taskStatusTokens[status];
  return (
    <Chip bg={tokens.bg} text={tokens.text}>
      {taskStatusLabels[status]}
    </Chip>
  );
}

function ReportStatusBadge({ status }: { status: WeeklyReportStatus }) {
  const config = reportStatusConfig[status];

  return (
    <Chip bg={config.bg} text={config.text}>
      {config.label}
    </Chip>
  );
}

function WeeklyReportItemCard({
  item,
  readOnly,
  onCommentChange,
  saving,
  saved
}: {
  item: WeeklyReportItemDto;
  readOnly: boolean;
  onCommentChange: (comment: string) => void;
  saving: boolean;
  saved: boolean;
}) {
  const [comment, setComment] = useState(item.comment);

  useEffect(() => {
    setComment(item.comment);
  }, [item.comment]);

  return (
    <article className="rounded-md border border-border bg-surface-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-text-primary">{item.taskTitle}</h3>
          <p className="mt-1 text-sm text-text-secondary">
            {item.projectName || "—"} · {item.sectionName || "—"}
          </p>
        </div>
        <TaskStatusChip status={item.taskStatus} />
      </div>

      <div className="mt-4">
        <Textarea
          value={comment}
          disabled={readOnly}
          placeholder="O que evoluiu? O que travou? O que ficou pendente?"
          className="min-h-[120px] resize-y bg-[--bg-2]"
          onChange={(event) => {
            const next = event.target.value;
            setComment(next);
            if (!readOnly) {
              onCommentChange(next);
            }
          }}
        />
        {!readOnly ? (
          <p className="mt-2 text-xs text-text-muted">
            {saving ? "Salvando..." : saved ? "Salvo ✓" : null}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export function WeeklyReportPage() {
  const { user } = useAuth();
  const { data: report, isLoading, error } = useMyWeeklyReport();
  const submitReport = useSubmitWeeklyReport();
  const { debouncedUpdate, savingItemId, savedItemIds } = useUpdateWeeklyReportItem(report?.id ?? "");

  const canFillReport = user?.role === Role.DESIGNER || user?.role === Role.INTERN;

  const canSubmit = useMemo(() => {
    if (!report || report.status === "SUBMITTED") {
      return false;
    }

    if (report.items.length === 0) {
      return false;
    }

    return report.items.every((item) => item.comment.trim().length > 0);
  }, [report]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!canFillReport) {
    return (
      <EmptyState icon={<ClipboardList size={32} />} title="Relatório semanal">
        Relatórios semanais são destinados a projetistas (designers e estagiários).
      </EmptyState>
    );
  }

  if (error || !report) {
    return (
      <EmptyState icon={<ClipboardList size={32} />} title="Relatório indisponível">
        Não foi possível carregar seu relatório semanal. Tente novamente em instantes.
      </EmptyState>
    );
  }

  const weekStartLabel = format(parseISO(report.weekStart), "dd/MM");
  const weekEndLabel = format(parseISO(report.weekEnd), "dd/MM");
  const readOnly = report.status === "SUBMITTED";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase text-brand-orange">Relatório semanal</p>
          <h1 className="mt-1 text-2xl font-bold text-text-primary">
            Semana de {weekStartLabel} a {weekEndLabel}
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            Comente o que evoluiu em cada tarefa da semana antes de enviar ao coordenador.
          </p>
        </div>
        <ReportStatusBadge status={report.status} />
      </header>

      {report.items.length === 0 ? (
        <EmptyState icon={<ClipboardList size={32} />} title="Nenhuma tarefa registrada nesta semana">
          Quando houver atividade nas suas tarefas, elas aparecerão aqui automaticamente.
        </EmptyState>
      ) : (
        <div className="grid gap-4">
          {report.items.map((item) => (
            <WeeklyReportItemCard
              key={item.id}
              item={item}
              readOnly={readOnly}
              saving={savingItemId === item.id}
              saved={savedItemIds.has(item.id)}
              onCommentChange={(comment) => debouncedUpdate(item.id, comment)}
            />
          ))}
        </div>
      )}

      {!readOnly && report.items.length > 0 ? (
        <div className="flex justify-end border-t border-border pt-4">
          <Button
            onClick={() => void submitReport.mutateAsync(report.id)}
            disabled={!canSubmit || submitReport.isPending}
            className={cn(!canSubmit && "opacity-60")}
          >
            {submitReport.isPending ? "Enviando..." : "Enviar relatório"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
