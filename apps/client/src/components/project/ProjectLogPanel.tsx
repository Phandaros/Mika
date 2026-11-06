import { isAxiosError } from "axios";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import {
  CheckCircle2,
  CirclePlus,
  History,
  Loader2,
  MessageSquare,
  NotebookPen,
  Pencil,
  RotateCcw,
  Send,
  Trash2,
  UserRoundPen,
  UsersRound,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { ProjectLogEntryDto, ProjectLogEntryType, ProjectNoteDto } from "shared";
import {
  refreshProjectDocument,
  useDeleteProjectDocument,
  useProjectLog,
  useProjectNote,
  useSaveProjectNote
} from "../../hooks/useProjectDocuments";
import { useDeleteAttachment } from "../../hooks/useCommentAttachments";
import { cn } from "../../lib/utils";
import { AttachmentPreview } from "../shared/AttachmentPreview";
import { Avatar } from "../shared/Avatar";
import { EmptyState } from "../shared/EmptyState";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
  type PendingMarkdownFile
} from "../shared/MarkdownEditor";
import { MarkdownComment } from "../task/MarkdownComment";
import { activityFieldLabel, formatActivityValue } from "../../lib/taskActivityLabels";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { DatePicker } from "../ui/date-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";

type BadgeTone = "default" | "orange" | "blue" | "green" | "purple" | "red" | "yellow" | "muted";

interface LogFilterGroup {
  key: string;
  label: string;
  types: ProjectLogEntryType[];
}

const logFilterGroups: LogFilterGroup[] = [
  { key: "manual", label: "Entradas manuais", types: ["NOTE"] },
  { key: "minutes", label: "Atas", types: ["MEETING_MINUTE"] },
  { key: "created", label: "Tarefas criadas", types: ["TASK_CREATED"] },
  { key: "completed", label: "Conclusões", types: ["TASK_COMPLETED", "TASK_REOPENED"] },
  { key: "updated", label: "Alterações", types: ["TASK_UPDATED", "TASK_DELETED"] },
  { key: "reviews", label: "Revisões", types: ["TASK_REVIEW"] },
  { key: "comments", label: "Comentários", types: ["TASK_COMMENT"] }
];

const defaultFilterKeys = logFilterGroups.map((group) => group.key);

const entryTypeMeta: Record<ProjectLogEntryType, { label: string; tone: BadgeTone; icon: ReactNode }> = {
  NOTE: { label: "Entrada manual", tone: "orange", icon: <NotebookPen /> },
  MEETING_MINUTE: { label: "Ata de reunião", tone: "purple", icon: <UsersRound /> },
  TASK_CREATED: { label: "Tarefa criada", tone: "blue", icon: <CirclePlus /> },
  TASK_COMPLETED: { label: "Tarefa concluída", tone: "green", icon: <CheckCircle2 /> },
  TASK_REOPENED: { label: "Tarefa reaberta", tone: "yellow", icon: <RotateCcw /> },
  TASK_UPDATED: { label: "Alteração", tone: "default", icon: <UserRoundPen /> },
  TASK_REVIEW: { label: "Revisão", tone: "yellow", icon: <Send /> },
  TASK_DELETED: { label: "Tarefa excluída", tone: "red", icon: <Trash2 /> },
  TASK_COMMENT: { label: "Comentário", tone: "muted", icon: <MessageSquare /> }
};

interface ProjectLogPanelProps {
  projectId: string;
  selectedNoteId: string | null;
  onSelectedNoteIdChange: (id: string | null) => void;
  onOpenTask: (taskId: string) => void;
  onOpenMeetingMinute: (meetingMinuteId: string) => void;
  createRequestVersion: number;
}

export function ProjectLogPanel({
  projectId,
  selectedNoteId,
  onSelectedNoteIdChange,
  onOpenTask,
  onOpenMeetingMinute,
  createRequestVersion
}: ProjectLogPanelProps) {
  const [filterKeys, setFilterKeys] = useState<string[]>(defaultFilterKeys);
  const [editorNote, setEditorNote] = useState<ProjectNoteDto | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProjectNoteDto | null>(null);
  const handledCreateRequest = useRef(createRequestVersion);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const types = useMemo(
    () => logFilterGroups.filter((group) => filterKeys.includes(group.key)).flatMap((group) => group.types),
    [filterKeys]
  );
  const logQuery = useProjectLog(projectId, types);
  const selectedNoteQuery = useProjectNote(selectedNoteId);
  const deleteNote = useDeleteProjectDocument(projectId, "notes");
  const entries = useMemo(() => logQuery.data?.pages.flatMap((page) => page.entries) ?? [], [logQuery.data]);
  const dayGroups = useMemo(() => groupEntriesByDay(entries), [entries]);
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = logQuery;

  useEffect(() => {
    if (handledCreateRequest.current === createRequestVersion) {
      return;
    }
    handledCreateRequest.current = createRequestVersion;
    setEditorNote(null);
    setEditorOpen(true);
  }, [createRequestVersion]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasNextPage) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: "400px 0px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  function toggleFilter(key: string) {
    setFilterKeys((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    );
  }

  function editNote(note: ProjectNoteDto) {
    setEditorNote(note);
    setEditorOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }
    try {
      await deleteNote.mutateAsync(deleteTarget.id);
      if (selectedNoteId === deleteTarget.id) {
        onSelectedNoteIdChange(null);
      }
      setDeleteTarget(null);
      toast.success("Entrada excluída");
    } catch {
      toast.error("Não foi possível excluir a entrada");
    }
  }

  const allSelected = filterKeys.length === logFilterGroups.length;
  const selectedNote = selectedNoteQuery.data ?? null;
  const entryHandlers = { onOpenTask, onOpenMeetingMinute, onEditNote: editNote, onDeleteNote: setDeleteTarget };

  return (
    <section className="min-w-0">
      <div className="flex min-w-0 flex-wrap items-center gap-2 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => setFilterKeys(allSelected ? [] : defaultFilterKeys)}
          className="h-7 rounded-md border border-border px-2.5 text-[12px] font-semibold text-text-secondary transition-colors hover:bg-[--bg-3] hover:text-text-primary"
        >
          {allSelected ? "Limpar filtros" : "Mostrar tudo"}
        </button>
        {logFilterGroups.map((group) => {
          const active = filterKeys.includes(group.key);
          return (
            <button
              key={group.key}
              type="button"
              aria-pressed={active}
              onClick={() => toggleFilter(group.key)}
              className={cn(
                "h-7 rounded-md border px-2.5 text-[12px] font-semibold transition-colors",
                active
                  ? "border-transparent bg-[--priority-high-bg] text-[--priority-high-text]"
                  : "border-border text-text-muted hover:bg-[--bg-3] hover:text-text-secondary"
              )}
            >
              {group.label}
            </button>
          );
        })}
      </div>

      {selectedNote ? (
        <div className="mt-4 rounded-md border border-[--color-brand-orange] bg-[--bg-1]">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">Entrada selecionada</span>
            <Button variant="ghost" className="h-7 px-2" onClick={() => onSelectedNoteIdChange(null)}>
              <X aria-hidden="true" />
              Fechar
            </Button>
          </div>
          <div className="px-4 py-3">
            <LogEntryRow entry={noteLogEntry(selectedNote)} {...entryHandlers} />
          </div>
        </div>
      ) : null}

      <div className="mt-2 min-w-0">
        {types.length === 0 ? (
          <EmptyState icon={<History />} title="Nenhum tipo selecionado">
            Selecione ao menos um filtro para ver o histórico.
          </EmptyState>
        ) : logQuery.isLoading ? (
          <LogSkeleton />
        ) : logQuery.isError ? (
          <EmptyState icon={<History />} title="Não foi possível carregar o log" />
        ) : entries.length === 0 ? (
          <EmptyState icon={<History />} title="Nenhum registro no log">
            O histórico de tarefas e as entradas manuais deste projeto aparecerão aqui.
          </EmptyState>
        ) : (
          dayGroups.map((group) => (
            <section key={group.day} className="min-w-0">
              <h3 className="sticky top-0 z-10 border-b border-border bg-[--bg-0]/95 py-2 text-[12px] font-semibold text-text-secondary backdrop-blur">
                {dayLabel(group.day)}
                <span className="ml-2 font-normal text-text-muted">
                  {group.entries.length} {group.entries.length === 1 ? "registro" : "registros"}
                </span>
              </h3>
              <ol className="divide-y divide-[--color-border-subtle]">
                {group.entries.map((entry) => (
                  <li key={entry.id} className="py-3">
                    <LogEntryRow entry={entry} {...entryHandlers} />
                  </li>
                ))}
              </ol>
            </section>
          ))
        )}

        <div ref={sentinelRef} />
        {hasNextPage ? (
          <div className="flex justify-center py-4">
            <Button variant="secondary" className="h-8 px-3" disabled={isFetchingNextPage} onClick={() => void fetchNextPage()}>
              {isFetchingNextPage ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Carregar registros anteriores
            </Button>
          </div>
        ) : entries.length > 0 ? (
          <p className="py-4 text-center text-[12px] text-text-muted">Início do histórico do projeto</p>
        ) : null}
      </div>

      <LogNoteEditorDialog
        projectId={projectId}
        open={editorOpen}
        note={editorNote}
        onOpenChange={setEditorOpen}
      />

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir entrada do log?</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-text-secondary">
            A entrada “{deleteTarget?.title}” e todos os seus anexos serão removidos permanentemente.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button variant="danger" disabled={deleteNote.isPending} onClick={() => void confirmDelete()}>
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

interface LogEntryRowProps {
  entry: ProjectLogEntryDto;
  onOpenTask: (taskId: string) => void;
  onOpenMeetingMinute: (meetingMinuteId: string) => void;
  onEditNote: (note: ProjectNoteDto) => void;
  onDeleteNote: (note: ProjectNoteDto) => void;
}

function LogEntryRow({ entry, onOpenTask, onOpenMeetingMinute, onEditNote, onDeleteNote }: LogEntryRowProps) {
  const meta = entryTypeMeta[entry.type];
  const occurredAt = parseISO(entry.occurredAt);
  const detail = entryDetail(entry);

  return (
    <article className="grid min-w-0 grid-cols-[44px_minmax(0,1fr)] gap-3 sm:grid-cols-[52px_28px_minmax(0,1fr)]">
      <time
        dateTime={entry.occurredAt}
        title={format(occurredAt, "dd/MM/yyyy 'às' HH:mm:ss")}
        className="pt-1 text-[12px] font-semibold tabular-nums text-text-secondary"
      >
        {format(occurredAt, "HH:mm")}
      </time>
      <span className="mt-0.5 hidden size-7 items-center justify-center rounded-full border border-border bg-[--bg-2] text-text-secondary sm:flex [&_svg]:size-3.5">
        {meta.icon}
      </span>
      <div className="min-w-0 [overflow-wrap:anywhere]">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <Badge tone={meta.tone} className="h-5 shrink-0 px-1.5 text-[11px]">
            {meta.label}
          </Badge>
          <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] text-text-secondary">
            {entry.actor ? (
              <>
                <Avatar name={entry.actor.name} imageUrl={entry.actor.avatarUrl} className="size-5 shrink-0 text-[9px]" />
                <span className="font-semibold text-text-primary">{entry.actor.name}</span>
              </>
            ) : (
              <span className="font-semibold text-text-muted">{entry.derived ? "Registro importado" : "Sistema"}</span>
            )}
            <span>{entrySentence(entry)}</span>
          </span>
        </div>

        {entry.task ? (
          entry.task.deleted ? (
            <p className="mt-1 text-[13px] font-medium text-text-muted line-through">{entry.task.name}</p>
          ) : (
            <button
              type="button"
              onClick={() => entry.task && onOpenTask(entry.task.id)}
              className="mt-1 block max-w-full text-left text-[13px] font-medium text-text-primary hover:text-brand-orange hover:underline"
            >
              {entry.task.name}
            </button>
          )
        ) : null}

        {detail ? <p className="mt-1 text-[12px] text-text-secondary">{detail}</p> : null}

        {entry.comment ? (
          <div className="mt-2 line-clamp-6 rounded-md border border-[--color-border-subtle] bg-[--bg-1] px-3 py-2">
            <MarkdownComment content={entry.comment.content} className="[&_*]:text-[13px]" />
          </div>
        ) : null}

        {entry.meetingMinute ? (
          <button
            type="button"
            onClick={() => entry.meetingMinute && onOpenMeetingMinute(entry.meetingMinute.id)}
            className="mt-1 block max-w-full text-left text-[13px] font-medium text-text-primary hover:text-brand-orange hover:underline"
          >
            {entry.meetingMinute.title}
            <span className="ml-2 text-[12px] font-normal text-text-muted">
              Reunião em {format(parseISO(`${entry.meetingMinute.meetingDate}T12:00:00`), "dd/MM/yyyy")}
              {entry.meetingMinute.meetingTime ? ` às ${entry.meetingMinute.meetingTime}` : ""}
            </span>
          </button>
        ) : null}

        {entry.note ? (
          <NoteEntryBody note={entry.note} onEdit={onEditNote} onDelete={onDeleteNote} />
        ) : null}

        {entry.derived ? (
          <p className="mt-1 text-[11px] text-text-muted">Data reconstruída a partir dos dados da tarefa.</p>
        ) : null}
      </div>
    </article>
  );
}

function NoteEntryBody({
  note,
  onEdit,
  onDelete
}: {
  note: ProjectNoteDto;
  onEdit: (note: ProjectNoteDto) => void;
  onDelete: (note: ProjectNoteDto) => void;
}) {
  const createdDay = format(parseISO(note.createdAt), "yyyy-MM-dd");
  const edited = note.createdAt !== note.updatedAt;

  return (
    <div className="mt-2 min-w-0 rounded-md border border-border bg-[--bg-1]">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2 border-b border-[--color-border-subtle] px-3 py-2">
        <div className="min-w-0">
          <h4 className="text-[14px] font-semibold text-text-primary">{note.title}</h4>
          <p className="mt-0.5 text-[11px] text-text-muted">
            {note.noteDate !== createdDay
              ? `Referente a ${format(parseISO(`${note.noteDate}T12:00:00`), "dd/MM/yyyy")}`
              : null}
            {note.noteDate !== createdDay && edited ? " · " : null}
            {edited ? `Editado em ${format(parseISO(note.updatedAt), "dd/MM/yyyy 'às' HH:mm")}` : null}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" className="h-7 px-2" onClick={() => onEdit(note)}>
            <Pencil aria-hidden="true" />
            Editar
          </Button>
          <Button variant="ghost" className="h-7 px-2 text-[--status-late-text]" onClick={() => onDelete(note)}>
            <Trash2 aria-hidden="true" />
            Excluir
          </Button>
        </div>
      </div>
      {note.content || note.attachments.length ? (
        <div className="flex min-w-0 flex-col gap-3 px-3 py-3">
          {note.content ? (
            <MarkdownComment content={note.content} className="[&_*]:text-[14px] [&_img]:max-w-full [&_p]:leading-6" />
          ) : null}
          {note.attachments.length ? (
            <div className="flex min-w-0 flex-wrap gap-2">
              {note.attachments.map((attachment) => (
                <AttachmentPreview key={attachment.id} attachment={attachment} canDeleteOverride={false} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

interface NoteDraft {
  title: string;
  content: string;
  noteDate: string;
}

function draftFromNote(note: ProjectNoteDto | null): NoteDraft {
  return note
    ? { title: note.title, content: note.content ?? "", noteDate: note.noteDate }
    : { title: "", content: "", noteDate: format(new Date(), "yyyy-MM-dd") };
}

function LogNoteEditorDialog({
  projectId,
  open,
  note,
  onOpenChange
}: {
  projectId: string;
  open: boolean;
  note: ProjectNoteDto | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [draft, setDraft] = useState<NoteDraft>(() => draftFromNote(note));
  const [initialDraft, setInitialDraft] = useState<NoteDraft>(() => draftFromNote(note));
  const [pendingFiles, setPendingFiles] = useState<PendingMarkdownFile[]>([]);
  const [conflict, setConflict] = useState(false);
  const editorRef = useRef<MarkdownEditorHandle | null>(null);
  const saveNote = useSaveProjectNote(projectId);
  const deleteAttachment = useDeleteAttachment(undefined);
  const noteQuery = useProjectNote(open && note ? note.id : null);
  const currentNote = noteQuery.data ?? note;
  const dirty = JSON.stringify(draft) !== JSON.stringify(initialDraft) || pendingFiles.length > 0;

  useEffect(() => {
    if (!open) {
      return;
    }
    const nextDraft = draftFromNote(note);
    setDraft(nextDraft);
    setInitialDraft(nextDraft);
    setPendingFiles([]);
    setConflict(false);
  }, [note, open]);

  function requestClose(nextOpen: boolean) {
    if (!nextOpen && dirty && !window.confirm("Descartar alterações não salvas?")) {
      return;
    }
    onOpenChange(nextOpen);
  }

  async function save() {
    const title = draft.title.trim();
    const content = editorRef.current?.getSubmitContent() ?? draft.content.trim();
    if (title.length < 2) {
      toast.error("Informe um título com pelo menos 2 caracteres");
      return;
    }
    if (!content && pendingFiles.length === 0 && (currentNote?.attachments.length ?? 0) === 0) {
      toast.error("Informe um texto ou adicione pelo menos um anexo");
      return;
    }
    if (!draft.noteDate) {
      toast.error("Informe a data de referência");
      return;
    }

    try {
      await saveNote.mutateAsync({
        noteId: currentNote?.id,
        values: {
          title,
          content,
          noteDate: draft.noteDate,
          expectedUpdatedAt: currentNote?.updatedAt
        },
        files: pendingFiles
      });
      setPendingFiles([]);
      onOpenChange(false);
      toast.success(currentNote ? "Entrada atualizada" : "Entrada adicionada ao log");
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 409) {
        setConflict(true);
        return;
      }
      const message = isAxiosError(error)
        ? (error.response?.data as { error?: string } | undefined)?.error
        : undefined;
      toast.error(message ?? "Não foi possível salvar a entrada");
    }
  }

  async function reloadConflict() {
    if (!currentNote) {
      return;
    }
    await refreshProjectDocument(projectId, "notes", currentNote.id);
    setConflict(false);
  }

  async function removeAttachment(attachmentId: string) {
    try {
      await deleteAttachment.mutateAsync(attachmentId);
      if (currentNote) {
        await refreshProjectDocument(projectId, "notes", currentNote.id);
      }
    } catch (error) {
      const message = isAxiosError(error)
        ? (error.response?.data as { error?: string } | undefined)?.error
        : undefined;
      toast.error(message ?? "Não foi possível remover o anexo");
    }
  }

  const isSaving = saveNote.isPending;

  return (
    <Dialog open={open} onOpenChange={requestClose}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>{note ? "Editar entrada do log" : "Nova entrada no log"}</DialogTitle>
        </DialogHeader>

        {conflict ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[--status-review-text]/30 bg-[--status-review-bg] px-3 py-2">
            <p className="text-[13px] text-[--status-review-text]">
              Outra pessoa alterou esta entrada. Seu conteúdo local foi preservado.
            </p>
            <Button variant="secondary" className="h-8 px-3" onClick={() => void reloadConflict()}>
              Carregar versão atual
            </Button>
          </div>
        ) : null}

        <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[13px] text-text-secondary">Título</span>
            <Input
              value={draft.title}
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              placeholder="Resumo do que aconteceu"
              autoFocus
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[13px] text-text-secondary">Data de referência</span>
            <DatePicker
              value={draft.noteDate}
              clearable={false}
              onChange={(noteDate) => setDraft((current) => ({ ...current, noteDate: noteDate ?? "" }))}
            />
          </label>
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-[13px] text-text-secondary">Texto, imagens e anexos</span>
          <MarkdownEditor
            ref={editorRef}
            value={draft.content}
            onChange={(content) => setDraft((current) => ({ ...current, content }))}
            onSubmit={() => void save()}
            pendingFiles={pendingFiles}
            onPendingFilesChange={setPendingFiles}
            submitLabel="Salvar"
            placeholder="Registre decisões, observações, fotos de obra, referências..."
            minHeightClassName="min-h-[200px]"
            maxHeightClassName="max-h-[55vh]"
            allowAttachmentOnly
            disabled={isSaving}
            footerActions={
              <div className="flex w-full justify-end gap-2">
                <Button variant="ghost" className="h-8 px-3" disabled={isSaving} onClick={() => requestClose(false)}>
                  Cancelar
                </Button>
                <Button className="h-8 px-3" disabled={isSaving} onClick={() => void save()}>
                  {isSaving ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                  Salvar
                </Button>
              </div>
            }
          />
        </div>

        {currentNote?.attachments.length ? (
          <section className="flex min-w-0 flex-col gap-2">
            <h3 className="text-[12px] font-semibold uppercase tracking-wider text-text-muted">Anexos atuais</h3>
            <div className="flex min-w-0 flex-wrap gap-2">
              {currentNote.attachments.map((attachment) => (
                <div key={attachment.id} className="relative">
                  <AttachmentPreview attachment={attachment} canDeleteOverride={false} />
                  <button
                    type="button"
                    disabled={deleteAttachment.isPending}
                    onClick={() => void removeAttachment(attachment.id)}
                    className="mt-1 text-[11px] text-[--status-late-text] hover:underline disabled:opacity-50"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function entrySentence(entry: ProjectLogEntryDto): string {
  switch (entry.type) {
    case "NOTE":
      return "registrou uma entrada";
    case "MEETING_MINUTE":
      return "registrou uma ata de reunião";
    case "TASK_CREATED":
      return entry.actor ? "criou a tarefa" : "tarefa criada";
    case "TASK_COMPLETED":
      return entry.actor ? "concluiu a tarefa" : "tarefa concluída";
    case "TASK_REOPENED":
      return "reabriu a tarefa";
    case "TASK_DELETED":
      return "excluiu a tarefa";
    case "TASK_COMMENT":
      return "comentou na tarefa";
    case "TASK_REVIEW":
      if (entry.activityType === "REVIEW_APPROVED") {
        return "aprovou a revisão da tarefa";
      }
      if (entry.activityType === "REVIEW_REJECTED") {
        return "reprovou a revisão da tarefa";
      }
      return `enviou para revisão de ${reviewerName(entry)}`;
    case "TASK_UPDATED":
      return `alterou ${activityFieldLabel(entry.field)} da tarefa`;
  }
}

function entryDetail(entry: ProjectLogEntryDto): string | null {
  if (entry.type !== "TASK_UPDATED") {
    return null;
  }
  if (entry.field === "description") {
    return "Descrição atualizada";
  }
  return `${formatActivityValue(entry.field, entry.fromValue)} → ${formatActivityValue(entry.field, entry.toValue)}`;
}

function reviewerName(entry: ProjectLogEntryDto): string {
  const name = entry.metadata?.reviewerName;
  return typeof name === "string" && name.trim() ? name : entry.toValue ?? "revisor";
}

function noteLogEntry(note: ProjectNoteDto): ProjectLogEntryDto {
  return {
    id: `note:${note.id}`,
    type: "NOTE",
    occurredAt: note.createdAt,
    actor: { id: note.author.id, name: note.author.name, avatarUrl: note.author.avatarUrl },
    task: null,
    activityType: null,
    field: null,
    fromValue: null,
    toValue: null,
    metadata: null,
    note,
    meetingMinute: null,
    comment: null,
    derived: false
  };
}

function groupEntriesByDay(entries: ProjectLogEntryDto[]): Array<{ day: string; entries: ProjectLogEntryDto[] }> {
  const groups: Array<{ day: string; entries: ProjectLogEntryDto[] }> = [];
  for (const entry of entries) {
    const day = format(parseISO(entry.occurredAt), "yyyy-MM-dd");
    const last = groups.at(-1);
    if (last?.day === day) {
      last.entries.push(entry);
    } else {
      groups.push({ day, entries: [entry] });
    }
  }
  return groups;
}

function dayLabel(day: string): string {
  const date = parseISO(`${day}T12:00:00`);
  const full = format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
  const capitalized = full.charAt(0).toUpperCase() + full.slice(1);
  if (isToday(date)) {
    return `Hoje · ${capitalized}`;
  }
  if (isYesterday(date)) {
    return `Ontem · ${capitalized}`;
  }
  return capitalized;
}

function LogSkeleton() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="grid grid-cols-[52px_minmax(0,1fr)] gap-3 border-b border-[--color-border-subtle] py-3">
          <div className="h-4 w-10 animate-pulse rounded bg-[--bg-4]" />
          <div>
            <div className="h-4 w-2/3 animate-pulse rounded bg-[--bg-4]" />
            <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-[--bg-4]" />
          </div>
        </div>
      ))}
    </div>
  );
}
