import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { CheckCircle2, Clock3, History, RotateCcw, Send, UserRoundPen, XCircle } from "lucide-react";
import { useMemo } from "react";
import { MessageSquareDiff, Paperclip, Trash2 } from "lucide-react";
import type { CommentRevision, TaskActivity, User } from "shared";
import { activitySentence } from "../../lib/taskActivityLabels";
import { cn } from "../../lib/utils";
import { AttachmentPreview } from "../shared/AttachmentPreview";
import { EmptyState } from "../shared/EmptyState";
import { MarkdownComment } from "./MarkdownComment";

interface TaskHistoryListProps {
  activities: TaskActivity[];
  commentRevisions?: CommentRevision[];
  isLoading?: boolean;
  currentUser?: User | null;
  taskId?: string;
}

type HistoryEntry =
  | { kind: "activity"; id: string; createdAt: string; activity: TaskActivity }
  | { kind: "revision"; id: string; createdAt: string; revision: CommentRevision };

export function TaskHistoryList({ activities, commentRevisions = [], isLoading, currentUser, taskId }: TaskHistoryListProps) {
  const entries = useMemo<HistoryEntry[]>(
    () =>
      [
        ...activities
          .filter((activity) => activity.type !== "COMMENTED")
          .map((activity) => ({ kind: "activity" as const, id: activity.id, createdAt: activity.createdAt, activity })),
        ...commentRevisions.map((revision) => ({
          kind: "revision" as const,
          id: revision.id,
          createdAt: revision.createdAt,
          revision
        }))
      ].sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()),
    [activities, commentRevisions]
  );

  if (isLoading) {
    return (
      <div className="grid gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-14 rounded-md bg-[--bg-3]" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <EmptyState title="Nenhuma movimentação ainda" icon={<History size={40} />}>
        As próximas alterações feitas nesta tarefa aparecerão aqui.
      </EmptyState>
    );
  }

  return (
    <div className="grid gap-0">
      {entries.map((entry, index) => (
        <div key={entry.id} className="grid grid-cols-[28px_1fr] gap-3">
          <div className="relative flex justify-center">
            <span className="mt-1 flex h-7 w-7 items-center justify-center rounded-full border border-[--color-border] bg-[--bg-2] text-[--color-text-secondary]">
              {entry.kind === "activity" ? <ActivityIcon activity={entry.activity} /> : <RevisionIcon revision={entry.revision} />}
            </span>
            {index < entries.length - 1 ? <span className="absolute top-9 h-[calc(100%-20px)] w-px bg-[--color-border-subtle]" /> : null}
          </div>
          <div className="min-w-0 border-b border-[--color-border-subtle] pb-4">
            <p className="text-[13px] leading-5 text-[--color-text-secondary]">
              <span className="font-semibold text-[--color-text-primary]">
                {(entry.kind === "activity" ? entry.activity.actor?.name : entry.revision.actor?.name) ?? "Sistema"}
              </span>{" "}
              {entry.kind === "activity" ? activitySentence(entry.activity) : revisionSentence(entry.revision)}
            </p>
            <time className="mt-1 block text-[12px] tabular-nums text-[--color-text-muted]">
              {format(new Date(entry.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </time>
            {entry.kind === "revision" ? (
              <RevisionDetails revision={entry.revision} currentUser={currentUser} taskId={taskId} />
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function RevisionIcon({ revision }: { revision: CommentRevision }) {
  if (revision.type === "DELETED") {
    return <Trash2 className="h-4 w-4 text-[--color-priority-urgent]" />;
  }

  if (revision.type === "ATTACHMENT_REMOVED") {
    return <Paperclip className="h-4 w-4" />;
  }

  return <MessageSquareDiff className="h-4 w-4" />;
}

function revisionSentence(revision: CommentRevision): string {
  const author = revision.author?.name ?? "usuário removido";

  if (revision.type === "DELETED") {
    return `apagou um comentário de ${author}`;
  }

  if (revision.type === "ATTACHMENT_REMOVED") {
    return `removeu um anexo de um comentário de ${author}`;
  }

  return `editou um comentário de ${author}`;
}

function revisionDetailsLabel(revision: CommentRevision): string {
  if (revision.type === "DELETED") {
    return "Ver comentário apagado";
  }

  if (revision.type === "ATTACHMENT_REMOVED") {
    return "Ver anexo removido";
  }

  return "Ver versão anterior";
}

function RevisionDetails({
  revision,
  currentUser,
  taskId
}: {
  revision: CommentRevision;
  currentUser?: User | null;
  taskId?: string;
}) {
  return (
    <details className="group/revision mt-2">
      <summary className="w-fit cursor-pointer text-[12px] font-medium text-[--color-text-secondary] outline-none hover:text-[--color-text-primary] focus-visible:ring-2 focus-visible:ring-[--color-brand-orange]">
        {revisionDetailsLabel(revision)}
      </summary>
      <div className="mt-2 rounded-md border border-[--color-border] bg-[--bg-1] px-3 py-2">
        {revision.type === "ATTACHMENT_REMOVED" ? null : <MarkdownComment content={revision.content} />}
        {revision.attachments.length > 0 ? (
          <div className={cn("flex flex-wrap gap-2", revision.type !== "ATTACHMENT_REMOVED" && "mt-2")}>
            {revision.attachments.map((attachment) => (
              <AttachmentPreview
                key={attachment.id}
                attachment={attachment}
                taskId={taskId}
                currentUserId={currentUser?.id}
                currentUserRole={currentUser?.role}
                canDeleteOverride={false}
              />
            ))}
          </div>
        ) : null}
      </div>
    </details>
  );
}

function ActivityIcon({ activity }: { activity: TaskActivity }) {
  const className = "h-4 w-4";

  if (activity.type === "COMPLETED") {
    return <CheckCircle2 className={cn(className, "text-[--status-done-text]")} />;
  }

  if (activity.type === "REVIEW_REQUESTED") {
    return <Send className={cn(className, "text-[--status-review-text]")} />;
  }

  if (activity.type === "REVIEW_APPROVED") {
    return <CheckCircle2 className={cn(className, "text-[--status-done-text]")} />;
  }

  if (activity.type === "REVIEW_REJECTED") {
    return <XCircle className={cn(className, "text-[--color-priority-urgent]")} />;
  }

  if (activity.type === "REOPENED") {
    return <RotateCcw className={className} />;
  }

  if (activity.type === "CREATED") {
    return <Clock3 className={className} />;
  }

  return <UserRoundPen className={className} />;
}
