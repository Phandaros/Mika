import { format } from "date-fns";
import { History, MessageSquare, Pencil, Trash2, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Role, type Comment, type TaskActivity, type User } from "shared";
import { useDeleteComment, useUpdateComment } from "../../hooks/useComments";
import { Avatar } from "../shared/Avatar";
import { EmptyState } from "../shared/EmptyState";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { MarkdownComment } from "./MarkdownComment";
import { TaskCommentEditor } from "./TaskCommentEditor";
import { TaskHistoryList } from "./TaskHistoryList";

export type TaskActivityTab = "comments" | "history";

interface TaskActivityTabsProps {
  comments: Comment[];
  history: TaskActivity[];
  historyLoading?: boolean;
  value: TaskActivityTab;
  onValueChange: (value: TaskActivityTab) => void;
  currentUser: User | null | undefined;
}

export function TaskActivityTabs({ comments, history, historyLoading, value, onValueChange, currentUser }: TaskActivityTabsProps) {
  const visibleHistoryCount = history.filter((activity) => activity.type !== "COMMENTED").length;

  return (
    <section className="mt-8">
      <Tabs value={value} onValueChange={(nextValue) => onValueChange(nextValue as TaskActivityTab)}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="comments">
              <MessageSquare size={16} />
              Comentários
              <span className="rounded bg-[--bg-4] px-1.5 py-0.5 text-[11px] text-[--color-text-secondary]">{comments.length}</span>
            </TabsTrigger>
            <TabsTrigger value="history">
              <History size={16} />
              Histórico
              <span className="rounded bg-[--bg-4] px-1.5 py-0.5 text-[11px] text-[--color-text-secondary]">{visibleHistoryCount}</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="comments" className="mt-4">
          <CommentList comments={comments} currentUser={currentUser} />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <TaskHistoryList activities={history} isLoading={historyLoading} />
        </TabsContent>
      </Tabs>
    </section>
  );
}

function CommentList({ comments, currentUser }: { comments: Comment[]; currentUser: User | null | undefined }) {
  if (comments.length === 0) {
    return (
      <EmptyState title="Nenhum comentário ainda" icon={<MessageSquare size={40} />}>
        Use o editor abaixo para registrar decisões, dúvidas e alinhamentos desta tarefa.
      </EmptyState>
    );
  }

  return (
    <div className="grid gap-5">
      {comments.map((item) => (
        <CommentItem key={item.id} comment={item} currentUser={currentUser} />
      ))}
    </div>
  );
}

function CommentItem({ comment, currentUser }: { comment: Comment; currentUser: User | null | undefined }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(comment.content);
  const updateComment = useUpdateComment(comment.taskId);
  const deleteComment = useDeleteComment(comment.taskId);
  const permissions = commentPermissions(comment, currentUser);
  const wasEdited = new Date(comment.updatedAt).getTime() !== new Date(comment.createdAt).getTime();

  async function saveComment() {
    const content = draft.trim();

    if (!content) {
      return;
    }

    await updateComment.mutateAsync({ id: comment.id, payload: { content } });
    setIsEditing(false);
  }

  async function removeComment() {
    const confirmed = window.confirm("Apagar este comentário?");

    if (!confirmed) {
      return;
    }

    await deleteComment.mutateAsync(comment.id);
  }

  return (
    <article className="grid grid-cols-[32px_1fr] gap-3">
      <Avatar
        name={comment.author?.name ?? "Usuário"}
        imageUrl={comment.author?.avatarUrl}
        className="mt-0.5 h-8 w-8 shrink-0"
      />
      <div className="min-w-0 border-b border-[--color-border-subtle] pb-5">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="truncate text-[13px] font-semibold leading-5 text-[--color-text-primary]">{comment.author?.name ?? "Usuário"}</span>
            <time className="shrink-0 text-[12px] tabular-nums text-[--color-text-muted]">
              {format(new Date(comment.asanaCreatedAt ?? comment.createdAt), "dd/MM/yyyy HH:mm")}
            </time>
            {wasEdited ? <span className="text-[12px] text-[--color-text-muted]">editado</span> : null}
          </div>

          {!isEditing && (permissions.canEdit || permissions.canDelete) ? (
            <div className="flex shrink-0 items-center gap-1">
              {permissions.canEdit ? (
                <IconButton label="Editar comentário" onClick={() => setIsEditing(true)} disabled={updateComment.isPending || deleteComment.isPending}>
                  <Pencil size={14} />
                </IconButton>
              ) : null}
              {permissions.canDelete ? (
                <IconButton label="Apagar comentário" onClick={() => void removeComment()} disabled={updateComment.isPending || deleteComment.isPending}>
                  <Trash2 size={14} />
                </IconButton>
              ) : null}
            </div>
          ) : null}
        </div>

        {isEditing ? (
          <div className="mt-3">
            <TaskCommentEditor
              value={draft}
              onChange={setDraft}
              onSubmit={() => void saveComment()}
              disabled={updateComment.isPending}
              submitLabel="Salvar"
              minHeightClassName="min-h-[88px]"
            />
            <div className="mt-2 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                className="h-8 px-3 text-xs"
                onClick={() => {
                  setDraft(comment.content);
                  setIsEditing(false);
                }}
              >
                <X size={14} />
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <MarkdownComment content={comment.content} className="mt-2" />
        )}
      </div>
    </article>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded text-[--color-text-muted] transition-colors hover:bg-[--bg-4] hover:text-[--color-text-primary] focus-visible:ring-2 focus-visible:ring-[--color-brand-orange] focus-visible:ring-offset-1 focus-visible:ring-offset-[--bg-2] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function commentPermissions(comment: Comment, currentUser: User | null | undefined): { canEdit: boolean; canDelete: boolean } {
  if (!currentUser) {
    return { canEdit: false, canDelete: false };
  }

  if (currentUser.role === Role.ADMIN || currentUser.role === Role.COORDINATOR) {
    return { canEdit: true, canDelete: true };
  }

  const isOwnComment = comment.authorId === currentUser.id;
  const isWithinWindow = Date.now() - new Date(comment.createdAt).getTime() <= 2 * 60 * 60 * 1000;
  const canMutateOwnComment = isOwnComment && isWithinWindow;

  return { canEdit: canMutateOwnComment, canDelete: canMutateOwnComment };
}
