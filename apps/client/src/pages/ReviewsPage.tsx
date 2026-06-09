import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { CheckCircle2, ClipboardCheck, XCircle } from "lucide-react";
import { Role, TaskReviewStatus, type TaskReview } from "shared";
import { Avatar } from "../components/shared/Avatar";
import { Chip, CompletionStatusChip, DisciplineChip } from "../components/shared/Chip";
import { EmptyState } from "../components/shared/EmptyState";
import { LoadingSpinner } from "../components/shared/LoadingSpinner";
import { Button } from "../components/ui/button";
import { DatePicker } from "../components/ui/date-picker";
import { SearchableSelect } from "../components/ui/searchable-select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../components/ui/sheet";
import { Textarea } from "../components/ui/textarea";
import { useApproveReview, useRejectReview, useReviews, useUpdateReview } from "../hooks/useReviews";
import { useUsers } from "../hooks/useUsers";
import { cn, formatDateOnly } from "../lib/utils";

const reviewStatusLabels: Record<TaskReviewStatus, string> = {
  [TaskReviewStatus.PENDING]: "Pendente",
  [TaskReviewStatus.APPROVED]: "Aprovada",
  [TaskReviewStatus.REJECTED]: "Recusada"
};

const reviewStatusTokens: Record<TaskReviewStatus, { bg: string; text: string }> = {
  [TaskReviewStatus.PENDING]: { bg: "--status-review-bg", text: "--status-review-text" },
  [TaskReviewStatus.APPROVED]: { bg: "--status-done-bg", text: "--status-done-text" },
  [TaskReviewStatus.REJECTED]: { bg: "--status-late-bg", text: "--status-late-text" }
};

export function ReviewsPage() {
  const [page, setPage] = useState(1);
  const [selectedReview, setSelectedReview] = useState<TaskReview | null>(null);
  const { data, isLoading } = useReviews({ status: TaskReviewStatus.PENDING, assigneeId: "me", page, limit: 25 });
  const reviews = data?.reviews ?? [];

  useEffect(() => {
    if (!selectedReview) {
      return;
    }

    const updated = reviews.find((review) => review.id === selectedReview.id);
    if (updated) {
      setSelectedReview(updated);
    }
  }, [reviews, selectedReview]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="grid min-w-0 gap-5">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold uppercase text-brand-orange">Revisões</p>
          <h1 className="mt-1 text-2xl font-bold text-text-primary">Fila de revisões</h1>
          <p className="mt-2 max-w-3xl text-sm text-text-secondary">
            Tarefas aguardando aprovação de coordenadores e gerentes.
          </p>
        </div>
        <div className="rounded-md border border-border bg-surface-card px-3 py-2 text-sm">
          <p className="text-[11px] font-semibold uppercase text-text-muted">Pendentes</p>
          <p className="mt-1 text-lg font-bold text-text-primary">{data?.total ?? 0}</p>
        </div>
      </header>

      <section className="overflow-hidden rounded-md border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] table-fixed border-collapse">
            <thead className="sticky top-0 z-10 bg-bg-1">
              <tr className="border-b border-border">
                <HeaderCell className="w-[280px]">Tarefa</HeaderCell>
                <HeaderCell className="w-[150px]">Responsável</HeaderCell>
                <HeaderCell className="w-[220px]">Origem</HeaderCell>
                <HeaderCell className="w-[120px]">Disciplina</HeaderCell>
                <HeaderCell className="w-[120px]">Entrega</HeaderCell>
                <HeaderCell className="w-[120px]">Status</HeaderCell>
              </tr>
            </thead>
            <tbody>
              {reviews.map((review) => (
                <tr
                  key={review.id}
                  className="h-10 cursor-pointer border-b border-border-subtle hover:bg-surface-hover"
                  onClick={() => setSelectedReview(review)}
                >
                  <BodyCell>
                    <span className="block truncate font-semibold text-text-primary">{review.title}</span>
                  </BodyCell>
                  <BodyCell>
                    <span className="flex min-w-0 items-center gap-2">
                      <Avatar name={review.reviewer?.name ?? "Sem responsável"} imageUrl={review.reviewer?.avatarUrl} className="h-5 w-5 shrink-0" />
                      <span className="truncate">{review.reviewer?.name ?? "Sem responsável"}</span>
                    </span>
                  </BodyCell>
                  <BodyCell>
                    <span className="block truncate">{review.sourceTask?.projects?.[0]?.name ?? "Sem projeto"}</span>
                  </BodyCell>
                  <BodyCell>
                    <DisciplineChip discipline="Revisão" />
                  </BodyCell>
                  <BodyCell>{review.dueDate ? formatDateOnly(review.dueDate, "dd/MM/yyyy") : <span className="text-text-muted">Sem data</span>}</BodyCell>
                  <BodyCell>
                    <ReviewStatusChip status={review.status} />
                  </BodyCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {reviews.length === 0 ? (
          <div className="p-10">
            <EmptyState icon={<ClipboardCheck size={32} />} title="Nenhuma revisão pendente" />
          </div>
        ) : null}

        <div className="flex items-center justify-between border-t border-border px-3 py-2 text-sm text-text-secondary">
          <span>
            Página {data?.page ?? page} de {Math.max(data?.totalPages ?? 1, 1)}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" className="h-8 px-3" disabled={page <= 1} onClick={() => setPage((current) => Math.max(current - 1, 1))}>
              Anterior
            </Button>
            <Button
              variant="secondary"
              className="h-8 px-3"
              disabled={page >= Math.max(data?.totalPages ?? 1, 1)}
              onClick={() => setPage((current) => current + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      </section>

      <ReviewDetailSheet review={selectedReview} onOpenChange={(open) => !open && setSelectedReview(null)} />
    </div>
  );
}

function ReviewDetailSheet({ review, onOpenChange }: { review: TaskReview | null; onOpenChange: (open: boolean) => void }) {
  const [message, setMessage] = useState("");
  const { data: users = [] } = useUsers();
  const updateReview = useUpdateReview();
  const approveReview = useApproveReview();
  const rejectReview = useRejectReview();
  const coordinatorOptions = useMemo(
    () =>
      users
        .filter((user) => user.role === Role.ADMIN || user.role === Role.COORDINATOR)
        .map((user) => ({
          value: user.id,
          label: user.name,
          description: user.email,
          avatarUrl: user.avatarUrl
        })),
    [users]
  );

  useEffect(() => {
    setMessage("");
  }, [review?.id]);

  async function patchReview(payload: { reviewerId?: string; startDate?: string | null; dueDate?: string | null }) {
    if (!review) {
      return;
    }

    await updateReview.mutateAsync({ id: review.id, payload });
  }

  async function handleApprove(event: FormEvent) {
    event.preventDefault();
    if (!review) {
      return;
    }

    await approveReview.mutateAsync({ id: review.id, payload: { message: message.trim() || undefined } });
    setMessage("");
    onOpenChange(false);
  }

  async function handleReject() {
    if (!review || !message.trim()) {
      return;
    }

    await rejectReview.mutateAsync({ id: review.id, payload: { message: message.trim() } });
    setMessage("");
    onOpenChange(false);
  }

  const isPending = review?.status === TaskReviewStatus.PENDING;

  return (
    <Sheet open={Boolean(review)} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 border-border bg-surface p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border bg-surface-card px-6 py-4">
          <SheetTitle className="flex min-w-0 items-center gap-2 text-[16px]">
            <ClipboardCheck size={17} className="shrink-0 text-brand-orange" />
            <span className="truncate">{review?.title ?? "Revisão"}</span>
          </SheetTitle>
          <SheetDescription className="sr-only">Detalhe da revisão de tarefa</SheetDescription>
        </SheetHeader>

        {review ? (
          <form onSubmit={handleApprove} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-[140px_1fr] gap-x-4">
                <DetailLabel>Status de conclusão</DetailLabel>
                <DetailValue>
                  <CompletionStatusChip completed={review.status !== TaskReviewStatus.PENDING} />
                </DetailValue>
                <DetailLabel>Título</DetailLabel>
                <DetailValue>
                  <span className="truncate text-text-primary">{review.title}</span>
                </DetailValue>
                <DetailLabel>Disciplina</DetailLabel>
                <DetailValue>
                  <DisciplineChip discipline="Revisão" />
                </DetailValue>
                <DetailLabel>Responsável</DetailLabel>
                <DetailValue>
                  <SearchableSelect
                    value={review.reviewerId}
                    options={coordinatorOptions}
                    disabled={!isPending || updateReview.isPending}
                    searchPlaceholder="Buscar responsável..."
                    triggerClassName="h-8 max-w-[260px] bg-bg-3"
                    contentClassName="min-w-[240px] max-w-[320px]"
                    renderValue={(option) => (
                      <span className="flex min-w-0 items-center gap-2">
                        <Avatar name={option.label} imageUrl={option.avatarUrl} className="h-6 w-6 shrink-0" />
                        <span className="truncate">{option.label}</span>
                      </span>
                    )}
                    onValueChange={(reviewerId) => void patchReview({ reviewerId })}
                  />
                </DetailValue>
                <DetailLabel>Início</DetailLabel>
                <DetailValue>
                  <DatePicker
                    value={review.startDate}
                    disabled={!isPending || updateReview.isPending}
                    onValueChange={(startDate) => void patchReview({ startDate })}
                    placeholder="Sem data"
                    className="h-8 max-w-[180px] justify-between bg-bg-3 px-3"
                  />
                </DetailValue>
                <DetailLabel>Entrega</DetailLabel>
                <DetailValue>
                  <DatePicker
                    value={review.dueDate}
                    disabled={!isPending || updateReview.isPending}
                    onValueChange={(dueDate) => void patchReview({ dueDate })}
                    placeholder="Sem data"
                    className="h-8 max-w-[180px] justify-between bg-bg-3 px-3"
                  />
                </DetailValue>
                <DetailLabel>Origem</DetailLabel>
                <DetailValue>
                  <span className="truncate text-text-secondary">{review.sourceTask?.title ?? "Tarefa original"}</span>
                </DetailValue>
              </div>
            </div>

            <div className="border-t border-border p-5">
              <Textarea
                value={message}
                disabled={!isPending}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Mensagem ao projetista"
                className="min-h-24 resize-none bg-bg-3"
              />
              <div className="mt-3 flex items-center justify-end gap-2">
                <Button
                  variant="secondary"
                  disabled={!isPending || rejectReview.isPending || approveReview.isPending || !message.trim()}
                  onClick={() => void handleReject()}
                >
                  <XCircle size={16} />
                  Recusar
                </Button>
                <Button type="submit" disabled={!isPending || approveReview.isPending || rejectReview.isPending}>
                  <CheckCircle2 size={16} />
                  Aprovar
                </Button>
              </div>
            </div>
          </form>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function ReviewStatusChip({ status }: { status: TaskReviewStatus }) {
  const tokens = reviewStatusTokens[status];
  return (
    <Chip bg={tokens.bg} text={tokens.text}>
      {reviewStatusLabels[status]}
    </Chip>
  );
}

function HeaderCell({ className, children }: { className?: string; children: string }) {
  return <th className={cn("px-3 py-2 text-left text-[11px] font-medium uppercase tracking-widest text-text-muted", className)}>{children}</th>;
}

function BodyCell({ children }: { children: ReactNode }) {
  return <td className="px-3 py-2 text-[13px] text-text-secondary">{children}</td>;
}

function DetailLabel({ children }: { children: string }) {
  return (
    <div className="flex min-h-8 items-center border-b border-border-subtle">
      <span className="text-[13px] font-normal text-text-secondary">{children}</span>
    </div>
  );
}

function DetailValue({ children }: { children: ReactNode }) {
  return <div className="flex min-h-8 min-w-0 items-center border-b border-border-subtle">{children}</div>;
}
