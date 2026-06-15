import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { format } from "date-fns";
import { CheckCircle2, ClipboardCheck, ExternalLink, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Role, TaskReviewStatus, type Task, type TaskReview } from "shared";
import { Avatar } from "../components/shared/Avatar";
import { Chip, DisciplineChip } from "../components/shared/Chip";
import { EmptyCell } from "../components/shared/DataTable";
import { EmptyState } from "../components/shared/EmptyState";
import { PriorityBadge } from "../components/shared/PriorityBadge";
import { Button } from "../components/ui/button";
import { DatePicker } from "../components/ui/date-picker";
import { SearchableSelect } from "../components/ui/searchable-select";
import { Skeleton } from "../components/ui/skeleton";
import { TaskDetail } from "../components/task/TaskDetail";
import { TaskCommentEditor, type CommentEditorHandle, type PendingCommentFile } from "../components/task/TaskCommentEditor";
import { TaskStatusBadge } from "../components/task/TaskStatusBadge";
import { EmptyField, TaskFixedFieldGrid, TaskPanelShell } from "../components/task/TaskPanelPrimitives";
import { useAuth } from "../hooks/useAuth";
import { useApproveReview, useRejectReview, useReviews, useUpdateReview } from "../hooks/useReviews";
import { useTaskById } from "../hooks/useTasks";
import { useUsers } from "../hooks/useUsers";
import { classifyFile, getFileRejectionMessage } from "../lib/attachmentUtils";
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
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTaskSeed, setSelectedTaskSeed] = useState<Task | null>(null);
  const [taskDetailOpenVersion, setTaskDetailOpenVersion] = useState(0);
  const { data, isLoading } = useReviews({ status: TaskReviewStatus.PENDING, assigneeId: "me", page, limit: 25 });
  const { data: selectedTaskFromApi } = useTaskById(selectedTaskId);
  const reviews = data?.reviews ?? [];
  const selectedTask = selectedTaskFromApi ?? selectedTaskSeed;

  useEffect(() => {
    if (!selectedReview) {
      return;
    }

    const updated = reviews.find((review) => review.id === selectedReview.id);
    if (updated) {
      setSelectedReview(updated);
    }
  }, [reviews, selectedReview]);

  function openOriginalTask(review: TaskReview) {
    setSelectedReview(null);
    setSelectedTaskSeed(review.sourceTask ?? null);
    setSelectedTaskId(review.sourceTaskId);
    setTaskDetailOpenVersion((version) => version + 1);
  }

  function openTaskDetail(task: Task) {
    setSelectedTaskSeed(task);
    setSelectedTaskId(task.id);
    setTaskDetailOpenVersion((version) => version + 1);
  }

  function closeTaskDetail() {
    setSelectedTaskSeed(null);
    setSelectedTaskId(null);
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
          <table className="w-full min-w-[1120px] table-fixed border-collapse bg-[--bg-2] text-sm">
            <thead className="sticky top-0 z-10 bg-[--bg-1]">
              <tr className="border-b border-[--color-border]">
                <HeaderCell className="w-[240px]">Origem</HeaderCell>
                <HeaderCell className="w-[320px]">Tarefa original</HeaderCell>
                <HeaderCell className="w-[170px]">Projetista</HeaderCell>
                <HeaderCell className="w-[170px]">Revisor</HeaderCell>
                <HeaderCell className="w-[120px]">Entrega da revisão</HeaderCell>
                <HeaderCell className="w-[120px]">Status</HeaderCell>
              </tr>
            </thead>
            <tbody>
              {isLoading ? <ReviewTableSkeleton /> : null}
              {!isLoading
                ? reviews.map((review) => (
                    <tr
                      key={review.id}
                      className="h-10 cursor-pointer border-b border-[--color-border-subtle] transition-colors hover:bg-[--bg-3]"
                      onClick={() => setSelectedReview(review)}
                    >
                      <BodyCell>
                        <OriginCell review={review} />
                      </BodyCell>
                      <BodyCell>
                        <span className="block truncate font-semibold text-text-primary">{reviewTitle(review)}</span>
                      </BodyCell>
                      <BodyCell>
                        <UserCell user={review.sourceTask?.assignee ?? null} fallback="Sem responsável" />
                      </BodyCell>
                      <BodyCell>
                        <UserCell user={review.reviewer ?? null} fallback="Sem revisor" />
                      </BodyCell>
                      <BodyCell>{review.dueDate ? formatDateOnly(review.dueDate, "dd/MM/yyyy") : <EmptyCell />}</BodyCell>
                      <BodyCell>
                        <ReviewStatusChip status={review.status} />
                      </BodyCell>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>

        {!isLoading && reviews.length === 0 ? (
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

      <ReviewDetailPanel
        review={selectedReview}
        onClose={() => setSelectedReview(null)}
        onOpenOriginal={openOriginalTask}
      />
      <TaskDetail
        task={selectedTask}
        onClose={closeTaskDetail}
        openVersion={taskDetailOpenVersion}
        onOpenTask={openTaskDetail}
      />
    </div>
  );
}

function ReviewDetailPanel({
  review,
  onClose,
  onOpenOriginal
}: {
  review: TaskReview | null;
  onClose: () => void;
  onOpenOriginal: (review: TaskReview) => void;
}) {
  const [visibleReview, setVisibleReview] = useState<TaskReview | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [pendingFiles, setPendingFiles] = useState<PendingCommentFile[]>([]);
  const [commentUploading, setCommentUploading] = useState(false);
  const closeTimeoutRef = useRef<number | null>(null);
  const commentEditorRef = useRef<CommentEditorHandle | null>(null);
  const { user } = useAuth();
  const { data: users = [] } = useUsers();
  const updateReview = useUpdateReview();
  const approveReview = useApproveReview();
  const rejectReview = useRejectReview();
  const currentReview = visibleReview;
  const sourceTask = currentReview?.sourceTask ?? null;
  const sourceOrigin = taskOrigin(sourceTask);
  const isPending = currentReview?.status === TaskReviewStatus.PENDING;
  const isBusy = updateReview.isPending || approveReview.isPending || rejectReview.isPending || commentUploading;
  const mentionContext = useMemo(
    () => (sourceTask?.discipline?.projectId && sourceTask.id ? { projectId: sourceTask.discipline.projectId, taskId: sourceTask.id } : null),
    [sourceTask?.discipline?.projectId, sourceTask?.id]
  );
  const coordinatorOptions = useMemo(
    () =>
      users
        .filter((item) => item.role === Role.ADMIN || item.role === Role.COORDINATOR)
        .map((item) => ({
          value: item.id,
          label: item.name,
          description: item.email,
          avatarUrl: item.avatarUrl
        })),
    [users]
  );

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current != null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!review) {
      setIsOpen(false);
      if (closeTimeoutRef.current != null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
      closeTimeoutRef.current = window.setTimeout(() => {
        closeTimeoutRef.current = null;
        setVisibleReview(null);
      }, 480);
      return undefined;
    }

    if (closeTimeoutRef.current != null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }

    setVisibleReview(review);
    setMessage("");
    setPendingFiles([]);
    setCommentUploading(false);
    setIsOpen(false);
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setIsOpen(true));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [review]);

  if (!currentReview) {
    return null;
  }

  function requestClose() {
    setIsOpen(false);
    if (closeTimeoutRef.current != null) {
      return;
    }
    closeTimeoutRef.current = window.setTimeout(() => {
      closeTimeoutRef.current = null;
      onClose();
    }, 480);
  }

  async function patchReview(payload: { reviewerId?: string; startDate?: string | null; dueDate?: string | null }) {
    if (!currentReview) {
      return;
    }

    const updatedReview = await updateReview.mutateAsync({ id: currentReview.id, payload });
    setVisibleReview(updatedReview);
  }

  function validPendingFiles(): File[] {
    const files: File[] = [];

    for (const item of pendingFiles) {
      if (classifyFile(item.file) === "document") {
        files.push(item.file);
        continue;
      }

      toast.error(getFileRejectionMessage(item.file));
    }

    return files;
  }

  async function approve() {
    if (!currentReview) {
      return;
    }

    const reviewId = currentReview.id;
    const content = commentEditorRef.current?.getSubmitContent().trim() ?? message.trim();
    const files = validPendingFiles();

    await approveReview.mutateAsync({
      id: reviewId,
      payload: {
        message: content || undefined,
        files: files.length > 0 ? files : undefined
      }
    });
    setMessage("");
    setPendingFiles([]);
    requestClose();
  }

  async function reject() {
    if (!currentReview) {
      return;
    }

    const reviewId = currentReview.id;
    const content = commentEditorRef.current?.getSubmitContent().trim() ?? message.trim();

    if (!content) {
      toast.error("Informe uma mensagem para o projetista.");
      return;
    }

    const files = validPendingFiles();

    await rejectReview.mutateAsync({
      id: reviewId,
      payload: {
        message: content,
        files: files.length > 0 ? files : undefined
      }
    });
    setMessage("");
    setPendingFiles([]);
    requestClose();
  }

  return (
    <TaskPanelShell
      isOpen={isOpen}
      onClose={requestClose}
      headerContent={
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <ClipboardCheck size={18} className="shrink-0 text-brand-orange" />
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <h2 className="truncate text-[16px] font-semibold text-text-primary">{reviewTitle(currentReview)}</h2>
                <ReviewStatusChip status={currentReview.status} />
              </div>
              <p className="mt-0.5 truncate text-[12px] text-text-secondary">
                {sourceOrigin.project} {sourceOrigin.section ? `/ ${sourceOrigin.section}` : ""}
              </p>
            </div>
          </div>
          <Button variant="secondary" className="h-8 shrink-0 px-3 text-xs" onClick={() => onOpenOriginal(currentReview)}>
            <ExternalLink size={14} />
            Abrir tarefa original
          </Button>
        </div>
      }
      footer={
        isPending ? (
          <div className="flex items-start gap-3 border-t border-[--color-border] bg-[--bg-2] p-5">
            {user ? <Avatar name={user.name} imageUrl={user.avatarUrl} className="mt-1.5 h-9 w-9 shrink-0" /> : null}
            <div className="min-w-0 flex-1">
              <TaskCommentEditor
                ref={commentEditorRef}
                value={message}
                onChange={setMessage}
                onSubmit={() => void approve()}
                disabled={isBusy}
                placeholder="Mensagem ao projetista"
                pendingFiles={pendingFiles}
                onPendingFilesChange={setPendingFiles}
                onUploadingChange={setCommentUploading}
                mentionContext={mentionContext}
                footerActions={
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="secondary"
                      className="h-8 px-3 text-xs"
                      disabled={!isPending || isBusy || !message.trim()}
                      onClick={() => void reject()}
                    >
                      <XCircle size={14} />
                      Recusar
                    </Button>
                    <Button className="h-8 px-3 text-xs" disabled={!isPending || isBusy} onClick={() => void approve()}>
                      <CheckCircle2 size={14} />
                      Aprovar
                    </Button>
                  </div>
                }
              />
            </div>
          </div>
        ) : null
      }
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <PanelSectionTitle>Tarefa original</PanelSectionTitle>
        <TaskFixedFieldGrid
          fields={[
            {
              key: "origin",
              label: "Origem",
              render: () => <ReadOnlyValue value={sourceOrigin.label} />
            },
            {
              key: "designer",
              label: "Projetista",
              render: () => <ReadOnlyUser user={sourceTask?.assignee ?? null} fallback="Sem responsável" />
            },
            {
              key: "status",
              label: "Status",
              render: () => (sourceTask ? <TaskStatusBadge status={sourceTask.status} /> : <EmptyField />)
            },
            {
              key: "priority",
              label: "Prioridade",
              render: () => (sourceTask ? <PriorityBadge priority={sourceTask.priority} /> : <EmptyField />)
            },
            {
              key: "sourceStart",
              label: "Início original",
              render: () => <ReadOnlyValue value={formatDateValue(sourceTask?.startDate)} />
            },
            {
              key: "sourceDue",
              label: "Entrega original",
              render: () => <ReadOnlyValue value={formatDateValue(sourceTask?.dueDate)} />
            }
          ]}
        />

        <PanelSectionTitle className="mt-8">Revisão</PanelSectionTitle>
        <TaskFixedFieldGrid
          fields={[
            {
              key: "discipline",
              label: "Disciplina",
              render: () => <DisciplineChip discipline="Revisão" />
            },
            {
              key: "reviewer",
              label: "Revisor",
              render: () => (
                <SearchableSelect
                  value={currentReview.reviewerId}
                  options={coordinatorOptions}
                  disabled={!isPending || updateReview.isPending}
                  searchPlaceholder="Buscar revisor..."
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
              )
            },
            {
              key: "reviewStart",
              label: "Início da revisão",
              render: () => (
                <DatePicker
                  value={currentReview.startDate}
                  disabled={!isPending || updateReview.isPending}
                  onValueChange={(startDate) => void patchReview({ startDate })}
                  placeholder="Sem data"
                  className="h-8 max-w-[180px] justify-between bg-bg-3 px-3"
                />
              )
            },
            {
              key: "reviewDue",
              label: "Entrega da revisão",
              render: () => (
                <DatePicker
                  value={currentReview.dueDate}
                  disabled={!isPending || updateReview.isPending}
                  onValueChange={(dueDate) => void patchReview({ dueDate })}
                  placeholder="Sem data"
                  className="h-8 max-w-[180px] justify-between bg-bg-3 px-3"
                />
              )
            },
            {
              key: "requestedBy",
              label: "Solicitada por",
              render: () => <ReadOnlyUser user={currentReview.requestedBy ?? null} fallback="Sem solicitante" />
            },
            {
              key: "createdAt",
              label: "Criada em",
              render: () => <ReadOnlyValue value={formatDateTime(currentReview.createdAt)} />
            }
          ]}
        />
      </div>
    </TaskPanelShell>
  );
}

function ReviewTableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, index) => (
        <tr key={index} className="h-10 border-b border-[--color-border-subtle]">
          {Array.from({ length: 6 }).map((__, cellIndex) => (
            <td key={cellIndex} className="px-3 py-2">
              <Skeleton className="h-4 w-full" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function OriginCell({ review }: { review: TaskReview }) {
  const origin = taskOrigin(review.sourceTask ?? null);

  return (
    <span className="block min-w-0">
      <span className="block truncate font-medium text-text-primary">{origin.project}</span>
      <span className="block truncate text-[12px] text-text-muted">{origin.section || "Sem seção"}</span>
    </span>
  );
}

function UserCell({ user, fallback }: { user: { name: string; avatarUrl?: string | null } | null; fallback: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar name={user?.name ?? fallback} imageUrl={user?.avatarUrl} className="h-5 w-5 shrink-0" />
      <span className="truncate">{user?.name ?? fallback}</span>
    </span>
  );
}

function ReadOnlyUser({ user, fallback }: { user: { name: string; avatarUrl?: string | null } | null; fallback: string }) {
  if (!user) {
    return <span className="text-[13px] text-[--color-text-muted]">{fallback}</span>;
  }

  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar name={user.name} imageUrl={user.avatarUrl} className="h-6 w-6 shrink-0" />
      <span className="truncate text-[13px] text-text-primary">{user.name}</span>
    </span>
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
  return <th className={cn("px-3 py-2 text-left text-[11px] font-medium uppercase tracking-widest text-[--color-text-muted]", className)}>{children}</th>;
}

function BodyCell({ children }: { children: ReactNode }) {
  return <td className="px-3 py-2 text-[13px] text-[--color-text-secondary]">{children}</td>;
}

function PanelSectionTitle({ children, className }: { children: string; className?: string }) {
  return (
    <h3 className={cn("text-[11px] font-semibold uppercase tracking-widest text-[--color-text-muted]", className)}>
      {children}
    </h3>
  );
}

function ReadOnlyValue({ value }: { value: string | null | undefined }) {
  if (!value) {
    return <EmptyField />;
  }

  return <span className="min-w-0 truncate text-[13px] text-text-primary">{value}</span>;
}

function reviewTitle(review: TaskReview): string {
  return stripReviewPrefix(review.sourceTask?.title ?? review.title);
}

function stripReviewPrefix(title: string): string {
  return title.replace(/^\s*\[REV\]\s*/i, "");
}

function taskOrigin(task: Task | null): { project: string; section: string | null; label: string } {
  const membership = task?.projects?.[0];
  const project = membership?.name ?? task?.discipline?.projectName ?? "Sem projeto";
  const section = membership?.sectionName ?? task?.discipline?.name ?? null;

  return {
    project,
    section,
    label: section ? `${project} / ${section}` : project
  };
}

function formatDateValue(value: string | null | undefined): string | null {
  return value ? formatDateOnly(value, "dd/MM/yyyy") : null;
}

function formatDateTime(value: string): string {
  return format(new Date(value), "dd/MM/yyyy HH:mm");
}
