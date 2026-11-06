import { format } from "date-fns";
import { Check, History, MessageSquare, Pencil, RotateCcw, Trash2, X } from "lucide-react";
import { forwardRef, useEffect, useRef, useState, type ReactNode } from "react";
import { Role, type AttachmentDto, type Comment, type TaskActivity, type User } from "shared";
import { isAxiosError } from "axios";
import { canManageTasks } from "../../lib/permissions";
import type { MentionContext } from "../../lib/mentionUtils";
import { useCommentRevisions, useDeleteComment, useUpdateComment } from "../../hooks/useComments";
import { useDeleteAttachment, useUploadCommentAttachments } from "../../hooks/useCommentAttachments";
import { classifyFile, getFileRejectionMessage, isImageMimeType } from "../../lib/attachmentUtils";
import { commentErrorMessage, findUnsupportedMarkdown, unsupportedMarkdownWarning } from "../../lib/commentContent";
import {
  clearCommentDraft,
  loadCommentDraft,
  purgeExpiredCommentDrafts,
  saveCommentDraft,
  stripLocalImages,
  type CommentDraft
} from "../../lib/commentDrafts";
import { toast } from "sonner";
import { Avatar } from "../shared/Avatar";
import { EmptyState } from "../shared/EmptyState";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { AttachmentPreview } from "../shared/AttachmentPreview";
import { MarkdownComment } from "./MarkdownComment";
import { TaskCommentEditor, type CommentEditorHandle, type PendingCommentFile } from "./TaskCommentEditor";
import { TaskHistoryList } from "./TaskHistoryList";

export type TaskActivityTab = "comments" | "history";

const COMMENT_EDIT_WINDOW_MS = 2 * 60 * 60 * 1000;
const COMMENT_EDIT_GRACE_MS = 15 * 60 * 1000;
const COMMENT_EDIT_WARNING_MS = 15 * 60 * 1000;
const CLOCK_TICK_MS = 30 * 1000;

interface TaskActivityTabsProps {
  taskId: string;
  comments: Comment[];
  history: TaskActivity[];
  historyLoading?: boolean;
  value: TaskActivityTab;
  onValueChange: (value: TaskActivityTab) => void;
  currentUser: User | null | undefined;
  mentionContext?: MentionContext | null;
  onMentionTask?: (taskId: string) => void;
  onEditingChange?: (editing: boolean) => void;
}

export function TaskActivityTabs({
  taskId,
  comments,
  history,
  historyLoading,
  value,
  onValueChange,
  currentUser,
  mentionContext = null,
  onMentionTask,
  onEditingChange
}: TaskActivityTabsProps) {
  const canViewHistory = canManageTasks(currentUser);
  const { data: commentRevisions = [] } = useCommentRevisions(taskId, canViewHistory);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const visibleHistoryCount = history.filter((activity) => activity.type !== "COMMENTED").length + commentRevisions.length;
  const isEditing = editingCommentId !== null;

  useEffect(() => {
    if (!canViewHistory && value === "history") {
      onValueChange("comments");
    }
  }, [canViewHistory, onValueChange, value]);

  useEffect(() => {
    purgeExpiredCommentDrafts();
  }, []);

  useEffect(() => {
    onEditingChange?.(isEditing);
    return () => onEditingChange?.(false);
  }, [isEditing, onEditingChange]);

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
            {canViewHistory ? (
              <TabsTrigger value="history">
                <History size={16} />
                Histórico
                <span className="rounded bg-[--bg-4] px-1.5 py-0.5 text-[11px] text-[--color-text-secondary]">{visibleHistoryCount}</span>
              </TabsTrigger>
            ) : null}
          </TabsList>
        </div>

        <TabsContent value="comments" className="mt-4">
          <CommentList
            comments={comments}
            currentUser={currentUser}
            mentionContext={mentionContext}
            onMentionTask={onMentionTask}
            editingCommentId={editingCommentId}
            onEditingCommentChange={setEditingCommentId}
          />
        </TabsContent>
        {canViewHistory ? (
          <TabsContent value="history" className="mt-4">
            <TaskHistoryList
              activities={history}
              commentRevisions={commentRevisions}
              isLoading={historyLoading}
              currentUser={currentUser}
              taskId={taskId}
            />
          </TabsContent>
        ) : null}
      </Tabs>
    </section>
  );
}

function CommentList({
  comments,
  currentUser,
  mentionContext,
  onMentionTask,
  editingCommentId,
  onEditingCommentChange
}: {
  comments: Comment[];
  currentUser: User | null | undefined;
  mentionContext?: MentionContext | null;
  onMentionTask?: (taskId: string) => void;
  editingCommentId: string | null;
  onEditingCommentChange: (commentId: string | null) => void;
}) {
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
        <CommentItem
          key={item.id}
          comment={item}
          currentUser={currentUser}
          mentionContext={mentionContext}
          onMentionTask={onMentionTask}
          isEditing={editingCommentId === item.id}
          onStartEdit={() => onEditingCommentChange(item.id)}
          onStopEdit={() => onEditingCommentChange(null)}
        />
      ))}
    </div>
  );
}

function useCurrentTime(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) {
      return undefined;
    }

    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => window.clearInterval(interval);
  }, [active]);

  return now;
}

function CommentItem({
  comment,
  currentUser,
  mentionContext,
  onMentionTask,
  isEditing,
  onStartEdit,
  onStopEdit
}: {
  comment: Comment;
  currentUser: User | null | undefined;
  mentionContext?: MentionContext | null;
  onMentionTask?: (taskId: string) => void;
  isEditing: boolean;
  onStartEdit: () => void;
  onStopEdit: () => void;
}) {
  const userId = currentUser?.id;
  const [storedDraft, setStoredDraft] = useState<CommentDraft | null>(() => (userId ? loadCommentDraft(userId, comment.id) : null));
  const [draft, setDraft] = useState(storedDraft?.content ?? comment.content);
  const [draftRestored, setDraftRestored] = useState(Boolean(storedDraft));
  const [editorVersion, setEditorVersion] = useState(0);
  const [pendingEditFiles, setPendingEditFiles] = useState<PendingCommentFile[]>([]);
  const [pendingRemovalIds, setPendingRemovalIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const editorRef = useRef<CommentEditorHandle | null>(null);
  const articleRef = useRef<HTMLElement | null>(null);
  const editButtonRef = useRef<HTMLButtonElement | null>(null);
  const baseUpdatedAtRef = useRef(storedDraft?.baseUpdatedAt ?? comment.updatedAt);
  const restoreFocusRef = useRef(false);
  const updateComment = useUpdateComment(comment.taskId);
  const deleteComment = useDeleteComment(comment.taskId);
  const uploadCommentAttachments = useUploadCommentAttachments(comment.taskId);
  const deleteAttachment = useDeleteAttachment(comment.taskId);
  const editDeadline = commentEditDeadline(comment, currentUser);
  const now = useCurrentTime(editDeadline !== null && Date.now() <= editDeadline + COMMENT_EDIT_GRACE_MS);
  const permissions = commentPermissions(comment, currentUser, now);
  const documentAttachments = (comment.attachments ?? []).filter((attachment) => !isImageMimeType(attachment.mimeType));
  const unsupportedContent = isEditing ? findUnsupportedMarkdown(comment.content) : null;
  const deadlineNotice = isEditing ? commentDeadlineNotice(editDeadline, now) : null;

  useEffect(() => {
    if (isEditing) {
      articleRef.current?.scrollIntoView({ block: "nearest" });
      return;
    }

    if (restoreFocusRef.current) {
      restoreFocusRef.current = false;
      editButtonRef.current?.focus({ preventScroll: true });
    }
  }, [isEditing]);

  function resetEditState() {
    setPendingEditFiles([]);
    setPendingRemovalIds([]);
    setConflictMessage(null);
  }

  function startEdit() {
    const stored = userId ? loadCommentDraft(userId, comment.id) : null;

    setStoredDraft(stored);
    setDraftRestored(Boolean(stored));
    setDraft(stored?.content ?? comment.content);
    baseUpdatedAtRef.current = stored?.baseUpdatedAt ?? comment.updatedAt;
    resetEditState();
    onStartEdit();
  }

  function persistDraft(nextValue: string) {
    if (!userId) {
      return;
    }

    const content = stripLocalImages(editorRef.current?.getSubmitContent() ?? nextValue);

    if (!content || content === comment.content.trim()) {
      clearCommentDraft(userId, comment.id);
      setStoredDraft(null);
      return;
    }

    const nextDraft = { content, baseUpdatedAt: baseUpdatedAtRef.current, savedAt: Date.now() };

    saveCommentDraft(userId, comment.id, nextDraft);
    setStoredDraft(nextDraft);
  }

  function handleDraftChange(nextValue: string) {
    setDraft(nextValue);
    persistDraft(nextValue);
  }

  function discardDraft() {
    if (userId) {
      clearCommentDraft(userId, comment.id);
    }

    setStoredDraft(null);
    setDraftRestored(false);
  }

  function discardDraftInEditor() {
    discardDraft();
    setDraft(comment.content);
    baseUpdatedAtRef.current = comment.updatedAt;
    setEditorVersion((version) => version + 1);
  }

  async function saveComment(overwrite = false) {
    const content = editorRef.current?.getSubmitContent().trim() ?? draft.trim();

    if (!content) {
      return;
    }

    const validFiles: File[] = [];

    for (const item of pendingEditFiles) {
      if (classifyFile(item.file) === "document") {
        validFiles.push(item.file);
        continue;
      }

      toast.error(getFileRejectionMessage(item.file));
    }

    const contentChanged = content !== comment.content.trim();

    setIsSaving(true);
    setConflictMessage(null);

    try {
      if (contentChanged) {
        const updated = await updateComment.mutateAsync({
          id: comment.id,
          payload: { content, expectedUpdatedAt: overwrite ? undefined : baseUpdatedAtRef.current }
        });

        baseUpdatedAtRef.current = updated.updatedAt;
      }

      if (validFiles.length > 0) {
        await uploadCommentAttachments.mutateAsync({ commentId: comment.id, files: validFiles });
        setPendingEditFiles([]);
      }

      for (const attachmentId of pendingRemovalIds) {
        await deleteAttachment.mutateAsync(attachmentId);
        setPendingRemovalIds((ids) => ids.filter((id) => id !== attachmentId));
      }
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 409) {
        setConflictMessage(commentErrorMessage(error, "Este comentário foi alterado por outra pessoa."));
        return;
      }

      toast.error(commentErrorMessage(error, "Não foi possível salvar. Seu texto continua no editor."));
      return;
    } finally {
      setIsSaving(false);
    }

    discardDraft();
    resetEditState();
    restoreFocusRef.current = true;
    onStopEdit();

    if (contentChanged) {
      toast.success("Comentário salvo");
    }
  }

  function leaveEdit() {
    const keptDraft = Boolean(storedDraft);
    const lostFiles = pendingEditFiles.length > 0;

    resetEditState();
    restoreFocusRef.current = true;
    onStopEdit();

    if (keptDraft) {
      toast("Rascunho guardado neste navegador", {
        description: lostFiles ? "Os documentos pendentes não ficam no rascunho." : undefined,
        action: { label: "Descartar", onClick: discardDraft }
      });
    }
  }

  async function removeComment() {
    try {
      await deleteComment.mutateAsync(comment.id);

      if (userId) {
        clearCommentDraft(userId, comment.id);
      }
    } catch (error) {
      setConfirmingDelete(false);
      toast.error(commentErrorMessage(error, "Não foi possível apagar o comentário."));
    }
  }

  return (
    <article ref={articleRef} className="grid scroll-mt-4 grid-cols-[32px_1fr] gap-3">
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
            {comment.editedAt ? (
              <span className="text-[12px] text-[--color-text-muted]">
                editado por {comment.editedBy?.name ?? "usuário removido"} em {format(new Date(comment.editedAt), "dd/MM/yyyy HH:mm")}
              </span>
            ) : null}
          </div>

          {!isEditing && !confirmingDelete && (permissions.canEdit || permissions.canDelete) ? (
            <div className="flex shrink-0 items-center gap-1">
              {permissions.canEdit ? (
                <IconButton ref={editButtonRef} label="Editar comentário" onClick={startEdit} disabled={deleteComment.isPending}>
                  <Pencil size={14} />
                </IconButton>
              ) : null}
              {permissions.canDelete ? (
                <IconButton label="Apagar comentário" onClick={() => setConfirmingDelete(true)} disabled={deleteComment.isPending}>
                  <Trash2 size={14} />
                </IconButton>
              ) : null}
            </div>
          ) : null}
        </div>

        {isEditing ? (
          <div className="mt-3">
            {deadlineNotice ? <EditNotice>{deadlineNotice}</EditNotice> : null}
            {unsupportedContent ? <EditNotice>{unsupportedMarkdownWarning(unsupportedContent)}</EditNotice> : null}
            {conflictMessage ? (
              <EditNotice
                action={
                  <button
                    type="button"
                    className="shrink-0 font-medium text-[--color-brand-orange] hover:underline disabled:opacity-50"
                    disabled={isSaving}
                    onClick={() => void saveComment(true)}
                  >
                    Sobrescrever
                  </button>
                }
              >
                {conflictMessage} Seu texto continua no editor.
              </EditNotice>
            ) : null}
            {draftRestored ? (
              <EditNotice
                action={
                  <button
                    type="button"
                    className="shrink-0 font-medium text-[--color-brand-orange] hover:underline"
                    onClick={discardDraftInEditor}
                  >
                    Descartar
                  </button>
                }
              >
                Rascunho recuperado.
              </EditNotice>
            ) : null}
            {documentAttachments.length > 0 ? (
              <div className="mb-2 flex flex-wrap gap-2">
                {documentAttachments.map((attachment) =>
                  pendingRemovalIds.includes(attachment.id) ? (
                    <RemovedAttachment
                      key={attachment.id}
                      attachment={attachment}
                      onUndo={() => setPendingRemovalIds((ids) => ids.filter((id) => id !== attachment.id))}
                    />
                  ) : (
                    <AttachmentPreview
                      key={attachment.id}
                      attachment={attachment}
                      taskId={comment.taskId}
                      currentUserId={currentUser?.id}
                      currentUserRole={currentUser?.role}
                      onRemove={() => setPendingRemovalIds((ids) => [...ids, attachment.id])}
                    />
                  )
                )}
              </div>
            ) : null}
            <TaskCommentEditor
              key={editorVersion}
              ref={editorRef}
              value={draft}
              onChange={handleDraftChange}
              onSubmit={() => void saveComment()}
              onEscape={leaveEdit}
              onUploadingChange={(uploading) => {
                if (!uploading) {
                  persistDraft(draft);
                }
              }}
              disabled={isSaving}
              submitLabel="Salvar"
              submittingLabel="Salvando..."
              submitting={isSaving}
              submitIcon={<Check size={14} />}
              placeholder="Escreva o comentário"
              emptyHint="Escreva algo para salvar."
              minHeightClassName="min-h-[88px]"
              maxHeightClassName="max-h-[45vh]"
              autoFocus
              pendingFiles={pendingEditFiles}
              onPendingFilesChange={setPendingEditFiles}
              mentionContext={mentionContext}
              secondaryAction={
                <Button type="button" variant="ghost" className="h-8 px-3 text-xs" disabled={isSaving} onClick={leaveEdit}>
                  Cancelar
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <MarkdownComment
              content={comment.content}
              className="mt-2"
              mentionContext={mentionContext}
              onMentionTask={onMentionTask}
            />
            {documentAttachments.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {documentAttachments.map((attachment) => (
                  <AttachmentPreview
                    key={attachment.id}
                    attachment={attachment}
                    taskId={comment.taskId}
                    currentUserId={currentUser?.id}
                    currentUserRole={currentUser?.role}
                    canDeleteOverride={false}
                  />
                ))}
              </div>
            ) : null}
            {storedDraft ? (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[--color-text-muted]">
                <span>Você tem um rascunho não salvo.</span>
                {permissions.canEdit ? (
                  <button type="button" className="font-medium text-[--color-brand-orange] hover:underline" onClick={startEdit}>
                    Continuar
                  </button>
                ) : null}
                <button type="button" className="font-medium hover:underline" onClick={discardDraft}>
                  Descartar
                </button>
              </div>
            ) : null}
            {confirmingDelete ? (
              <div
                role="alertdialog"
                aria-label="Confirmar exclusão do comentário"
                className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-[--color-border] bg-[--bg-3] px-3 py-2"
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    setConfirmingDelete(false);
                  }
                }}
              >
                <p className="text-[13px] text-[--color-text-primary]">Apagar este comentário?</p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 px-3 text-xs"
                    autoFocus
                    disabled={deleteComment.isPending}
                    onClick={() => setConfirmingDelete(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-8 px-3 text-xs"
                    disabled={deleteComment.isPending}
                    onClick={() => void removeComment()}
                  >
                    <Trash2 size={14} />
                    Apagar
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </article>
  );
}

function EditNotice({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div
      role="status"
      className="mb-2 flex items-start justify-between gap-3 rounded-md border border-[--color-border] bg-[--bg-3] px-3 py-2 text-[12px] leading-5 text-[--color-text-secondary]"
    >
      <p className="min-w-0">{children}</p>
      {action}
    </div>
  );
}

function RemovedAttachment({ attachment, onUndo }: { attachment: AttachmentDto; onUndo: () => void }) {
  return (
    <div className="flex max-w-full items-center gap-2 rounded-md border border-dashed border-[--color-border] px-2.5 py-1.5">
      <X size={14} className="shrink-0 text-[--color-text-muted]" />
      <div className="min-w-0">
        <p className="max-w-[160px] truncate text-[13px] text-[--color-text-muted] line-through">{attachment.filename}</p>
        <p className="text-[11px] text-[--color-text-muted]">Será removido ao salvar</p>
      </div>
      <button
        type="button"
        aria-label={`Desfazer remoção de ${attachment.filename}`}
        title="Desfazer"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-[--color-text-muted] outline-none transition-colors hover:bg-[--bg-4] hover:text-[--color-text-primary] focus-visible:ring-2 focus-visible:ring-[--color-brand-orange]"
        onClick={onUndo}
      >
        <RotateCcw size={14} />
      </button>
    </div>
  );
}

const IconButton = forwardRef<
  HTMLButtonElement,
  {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    children: ReactNode;
  }
>(function IconButton({ label, onClick, disabled, children }, ref) {
  return (
    <button
      ref={ref}
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
});

function isPrivileged(user: User | null | undefined): boolean {
  return user?.role === Role.ADMIN || user?.role === Role.COORDINATOR;
}

/** Fim da janela de edição; `null` quando a pessoa não tem limite de tempo. */
function commentEditDeadline(comment: Comment, currentUser: User | null | undefined): number | null {
  if (isPrivileged(currentUser)) {
    return null;
  }

  return new Date(comment.createdAt).getTime() + COMMENT_EDIT_WINDOW_MS;
}

function commentDeadlineNotice(deadline: number | null, now: number): string | null {
  if (deadline === null) {
    return null;
  }

  const remainingMs = deadline - now;

  if (remainingMs > COMMENT_EDIT_WARNING_MS) {
    return null;
  }

  if (remainingMs > 0) {
    return `Restam ${Math.max(1, Math.ceil(remainingMs / 60_000))} min para editar este comentário.`;
  }

  if (remainingMs > -COMMENT_EDIT_GRACE_MS) {
    return `O prazo de 2h terminou. Salve até ${format(new Date(deadline + COMMENT_EDIT_GRACE_MS), "HH:mm")}.`;
  }

  return "O prazo para editar terminou. Copie seu texto ou peça a um coordenador para alterar.";
}

function commentPermissions(
  comment: Comment,
  currentUser: User | null | undefined,
  now: number
): { canEdit: boolean; canDelete: boolean } {
  if (!currentUser) {
    return { canEdit: false, canDelete: false };
  }

  if (isPrivileged(currentUser)) {
    return { canEdit: true, canDelete: true };
  }

  const isOwnComment = comment.authorId === currentUser.id;
  const isWithinWindow = now - new Date(comment.createdAt).getTime() <= COMMENT_EDIT_WINDOW_MS;
  const canMutateOwnComment = isOwnComment && isWithinWindow;

  return { canEdit: canMutateOwnComment, canDelete: canMutateOwnComment };
}
