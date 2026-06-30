import { useMemo, useState } from "react";
import {
  addWeeks,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  subWeeks
} from "date-fns";
import { BarChart2, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Role, TaskStatus, type WeeklyReportStatus, type WeeklyReportSummaryDto } from "shared";
import { Avatar } from "../components/shared/Avatar";
import { Chip, taskStatusLabels, taskStatusTokens } from "../components/shared/Chip";
import { EmptyState } from "../components/shared/EmptyState";
import { LoadingSpinner } from "../components/shared/LoadingSpinner";
import { Button } from "../components/ui/button";
import { DatePicker } from "../components/ui/date-picker";
import { SearchableSelect } from "../components/ui/searchable-select";
import { useAuth } from "../hooks/useAuth";
import { useUsers } from "../hooks/useUsers";
import { useDownloadMonthlyCompletedTemplate, useWeeklyReport, useWeeklyReports } from "../hooks/useWeeklyReports";
import { hasMinimumRole } from "../lib/permissions";
import { cn, localDateToDateOnly } from "../lib/utils";

const reportStatusConfig: Record<
  WeeklyReportStatus,
  { label: string; bg: string; text: string }
> = {
  PENDING: { label: "Pendente", bg: "--status-review-bg", text: "--status-review-text" },
  SUBMITTED: { label: "Enviado", bg: "--status-done-bg", text: "--status-done-text" },
  LATE: { label: "Atrasado", bg: "--status-late-bg", text: "--status-late-text" }
};

const statusFilterOptions: Array<{ value: "ALL" | WeeklyReportStatus; label: string }> = [
  { value: "ALL", label: "Todos" },
  { value: "PENDING", label: "Pendente" },
  { value: "SUBMITTED", label: "Enviado" },
  { value: "LATE", label: "Atrasado" }
];

function ReportStatusBadge({ status }: { status: WeeklyReportStatus }) {
  const config = reportStatusConfig[status];
  return (
    <Chip bg={config.bg} text={config.text}>
      {config.label}
    </Chip>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border bg-surface-card px-4 py-3">
      <p className="text-[11px] font-semibold uppercase text-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-text-primary">{value}</p>
    </div>
  );
}

function ReportListCard({
  report,
  selected,
  onSelect
}: {
  report: WeeklyReportSummaryDto;
  selected: boolean;
  onSelect: () => void;
}) {
  const weekLabel = format(parseISO(report.weekStart), "dd/MM/yyyy");

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "grid w-full gap-2 rounded-md border p-3 text-left transition",
        selected
          ? "border-brand-orange bg-surface-hover"
          : "border-border bg-surface-card hover:bg-surface-hover"
      )}
    >
      <div className="flex items-center gap-3">
        <Avatar name={report.userName} className="h-9 w-9 text-xs" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-text-primary">{report.userName}</p>
          <p className="text-xs text-text-secondary">Semana de {weekLabel}</p>
        </div>
        <ReportStatusBadge status={report.status} />
      </div>
      <div className="flex items-center justify-between text-xs text-text-muted">
        <span>{report.itemCount} tarefa{report.itemCount === 1 ? "" : "s"}</span>
        {report.submittedAt ? (
          <span>Enviado em {format(parseISO(report.submittedAt), "dd/MM HH:mm")}</span>
        ) : null}
      </div>
    </button>
  );
}

export function WeeklyReportsAdminPage() {
  const [selectedWeek, setSelectedWeek] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedReportMonth, setSelectedReportMonth] = useState(() => startOfMonth(new Date()));
  const [userId, setUserId] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<"ALL" | WeeklyReportStatus>("ALL");
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  const { user } = useAuth();
  const canGenerateMonthlyTemplate = hasMinimumRole(user, Role.COORDINATOR);
  const downloadMonthlyCompletedTemplate = useDownloadMonthlyCompletedTemplate();
  const reportMonth = format(selectedReportMonth, "yyyy-MM");
  const weekStartIso = selectedWeek.toISOString();
  const { data: users = [] } = useUsers();
  const { data: listData, isLoading: listLoading } = useWeeklyReports({
    userId,
    weekStart: weekStartIso,
    status: statusFilter === "ALL" ? undefined : statusFilter,
    page: 1,
    limit: 50
  });
  const { data: selectedReport, isLoading: detailLoading } = useWeeklyReport(selectedReportId);

  const designerOptions = useMemo(
    () =>
      users
        .filter((entry) => entry.role === Role.DESIGNER || entry.role === Role.INTERN)
        .map((entry) => ({
          value: entry.id,
          label: entry.name,
          description: entry.role === Role.INTERN ? "Estagiário" : "Projetista"
        })),
    [users]
  );

  const reports = listData?.reports ?? [];
  const summary = listData?.summary;

  async function handleDownloadMonthlyTemplate() {
    try {
      await downloadMonthlyCompletedTemplate.mutateAsync(reportMonth);
      toast.success("Word gerado com sucesso");
    } catch {
      toast.error("Não foi possível gerar o Word");
    }
  }

  return (
    <div className="grid min-w-0 gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
        <p className="text-sm font-semibold uppercase text-brand-orange">Gestão</p>
        <h1 className="mt-1 text-2xl font-bold text-text-primary">Relatórios semanais</h1>
        <p className="mt-2 max-w-3xl text-sm text-text-secondary">
          Acompanhe o envio dos relatórios dos projetistas por semana.
        </p>
        </div>
        {canGenerateMonthlyTemplate ? (
          <div className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-surface-card p-3">
            <div className="min-w-44">
              <p className="mb-2 text-xs font-semibold uppercase text-text-muted">Mês do Word</p>
              <DatePicker
                value={localDateToDateOnly(selectedReportMonth)}
                onValueChange={(value) => {
                  if (value) {
                    setSelectedReportMonth(startOfMonth(new Date(`${value}T12:00:00`)));
                  }
                }}
              />
            </div>
            <Button
              onClick={() => void handleDownloadMonthlyTemplate()}
              disabled={downloadMonthlyCompletedTemplate.isPending}
              className="h-10"
            >
              <Download size={16} />
              {downloadMonthlyCompletedTemplate.isPending ? "Gerando..." : "Gerar Word"}
            </Button>
          </div>
        ) : null}
      </header>

      {summary ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Esperados" value={summary.expected} />
          <SummaryCard label="Enviados no prazo" value={summary.submitted} />
          <SummaryCard label="Atrasados / Pendentes" value={`${summary.late} / ${summary.pending}`} />
          <SummaryCard label="Taxa de envio" value={`${summary.submissionRate}%`} />
        </section>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="grid gap-4">
          <div className="rounded-md border border-border bg-surface-card p-4">
            <p className="mb-3 text-xs font-semibold uppercase text-text-muted">Semana</p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                className="h-9 w-9 px-0"
                onClick={() => setSelectedWeek((current) => subWeeks(current, 1))}
              >
                <ChevronLeft size={18} />
              </Button>
              <DatePicker
                value={localDateToDateOnly(selectedWeek)}
                onValueChange={(value) => {
                  if (value) {
                    setSelectedWeek(startOfWeek(new Date(`${value}T12:00:00`), { weekStartsOn: 1 }));
                  }
                }}
                className="flex-1"
              />
              <Button
                variant="ghost"
                className="h-9 w-9 px-0"
                onClick={() => setSelectedWeek((current) => addWeeks(current, 1))}
              >
                <ChevronRight size={18} />
              </Button>
            </div>
            <p className="mt-2 text-xs text-text-muted">
              {format(selectedWeek, "dd/MM/yyyy")} — {format(addWeeks(selectedWeek, 1), "dd/MM/yyyy")}
            </p>
          </div>

          <div className="rounded-md border border-border bg-surface-card p-4">
            <p className="mb-3 text-xs font-semibold uppercase text-text-muted">Projetista</p>
            <SearchableSelect
              value={userId ?? ""}
              options={[{ value: "", label: "Todos os projetistas" }, ...designerOptions]}
              onValueChange={(value) => setUserId(value || undefined)}
              placeholder="Filtrar projetista"
              searchPlaceholder="Buscar projetista..."
            />
          </div>

          <div className="rounded-md border border-border bg-surface-card p-4">
            <p className="mb-3 text-xs font-semibold uppercase text-text-muted">Status</p>
            <div className="flex flex-wrap gap-2">
              {statusFilterOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setStatusFilter(option.value)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition",
                    statusFilter === option.value
                      ? "border-brand-orange bg-brand-orange/10 text-brand-orange"
                      : "border-border text-text-secondary hover:bg-surface-hover"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            {listLoading ? <LoadingSpinner /> : null}
            {!listLoading && reports.length === 0 ? (
              <EmptyState icon={<BarChart2 size={32} />} title="Nenhum relatório">
                Não há relatórios para os filtros selecionados.
              </EmptyState>
            ) : null}
            {reports.map((report) => (
              <ReportListCard
                key={report.id}
                report={report}
                selected={selectedReportId === report.id}
                onSelect={() => setSelectedReportId(report.id)}
              />
            ))}
          </div>
        </div>

        <div className="rounded-md border border-border bg-surface-card p-5">
          {!selectedReportId ? (
            <EmptyState icon={<BarChart2 size={32} />} title="Selecione um relatório">
              Escolha um projetista na lista para ver os comentários da semana.
            </EmptyState>
          ) : detailLoading ? (
            <LoadingSpinner />
          ) : selectedReport ? (
            <div className="grid gap-4">
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
                <div>
                  <h2 className="text-xl font-bold text-text-primary">{selectedReport.userName}</h2>
                  <p className="mt-1 text-sm text-text-secondary">
                    Semana de {format(parseISO(selectedReport.weekStart), "dd/MM")} a{" "}
                    {format(parseISO(selectedReport.weekEnd), "dd/MM/yyyy")}
                  </p>
                </div>
                <ReportStatusBadge status={selectedReport.status} />
              </header>

              {selectedReport.status !== "SUBMITTED" ? (
                <p className="rounded-md border border-[--status-late-bg] bg-[--status-late-bg]/20 px-3 py-2 text-sm text-text-secondary">
                  Relatório não enviado.
                </p>
              ) : null}

              <div className="grid gap-3">
                {selectedReport.items.map((item) => {
                  const isKnownStatus = Object.values(TaskStatus).includes(item.taskStatus as TaskStatus);
                  const statusLabel = isKnownStatus
                    ? taskStatusLabels[item.taskStatus as TaskStatus]
                    : item.taskStatus;
                  const statusTokens = isKnownStatus
                    ? taskStatusTokens[item.taskStatus as TaskStatus]
                    : { bg: "--status-todo-bg", text: "--status-todo-text" };

                  return (
                    <article key={item.id} className="rounded-md border border-border bg-[--bg-2] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            to={`/my-tasks?task=${encodeURIComponent(item.taskId)}`}
                            className="font-semibold text-text-primary hover:text-brand-orange"
                          >
                            {item.taskTitle}
                          </Link>
                          <p className="mt-1 text-sm text-text-secondary">
                            {item.projectName || "—"} · {item.sectionName || "—"}
                          </p>
                        </div>
                        <Chip bg={statusTokens.bg} text={statusTokens.text}>
                          {statusLabel}
                        </Chip>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-text-primary">
                        {item.comment.trim() || "—"}
                      </p>
                    </article>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
