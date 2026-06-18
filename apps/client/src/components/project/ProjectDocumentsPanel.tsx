import { isAxiosError } from "axios";
import { format, parseISO } from "date-fns";
import {
  CalendarDays,
  Clock3,
  FileText,
  Loader2,
  NotebookPen,
  Search,
  Trash2,
  UsersRound
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { toast } from "sonner";
import type { MeetingMinuteDto, ProjectNoteDto } from "shared";
import {
  refreshProjectDocument,
  useDeleteProjectDocument,
  useMeetingMinute,
  useMeetingMinutes,
  useProjectNote,
  useProjectNotes,
  useSaveMeetingMinute,
  useSaveProjectNote,
  type ProjectDocumentKind
} from "../../hooks/useProjectDocuments";
import { useUsers } from "../../hooks/useUsers";
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
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { DatePicker } from "../ui/date-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious
} from "../ui/pagination";
import { SearchableMultiSelect } from "../ui/searchable-multi-select";

type ProjectDocument = ProjectNoteDto | MeetingMinuteDto;

function isMeetingMinute(document: ProjectDocument): document is MeetingMinuteDto {
  return "meetingDate" in document;
}

interface ProjectDocumentsPanelProps {
  projectId: string;
  kind: ProjectDocumentKind;
  selectedId: string | null;
  onSelectedIdChange: (id: string | null) => void;
  createRequestVersion: number;
}

interface DocumentDraft {
  title: string;
  content: string;
  meetingDate: string;
  meetingTime: string;
  participantUserIds: string[];
  externalParticipantsText: string;
}

const emptyDraft: DocumentDraft = {
  title: "",
  content: "",
  meetingDate: format(new Date(), "yyyy-MM-dd"),
  meetingTime: "",
  participantUserIds: [],
  externalParticipantsText: ""
};

function minuteParticipantsText(minute: MeetingMinuteDto): string {
  return minute.externalParticipants.join("\n");
}

function draftFromDocument(document: ProjectDocument | null): DocumentDraft {
  if (!document) {
    return { ...emptyDraft, meetingDate: format(new Date(), "yyyy-MM-dd") };
  }

  if (isMeetingMinute(document)) {
    return {
      title: document.title,
      content: document.content ?? "",
      meetingDate: document.meetingDate,
      meetingTime: document.meetingTime ?? "",
      participantUserIds: document.participants.map((participant) => participant.userId),
      externalParticipantsText: minuteParticipantsText(document)
    };
  }

  return {
    ...emptyDraft,
    title: document.title,
    content: document.content ?? ""
  };
}

function normalizedExternalParticipants(value: string): string[] {
  return [...new Set(value.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean))];
}

function documentTimestamp(document: ProjectDocument): string {
  if (isMeetingMinute(document)) {
    const time = document.meetingTime ? ` às ${document.meetingTime}` : "";
    return `${format(parseISO(`${document.meetingDate}T12:00:00`), "dd/MM/yyyy")}${time}`;
  }

  return `Atualizada em ${format(parseISO(document.updatedAt), "dd/MM/yyyy 'às' HH:mm")}`;
}

function documentLifecycle(document: ProjectDocument): string {
  const created = format(parseISO(document.createdAt), "dd/MM/yyyy 'às' HH:mm");
  const updated = format(parseISO(document.updatedAt), "dd/MM/yyyy 'às' HH:mm");
  const changed = document.createdAt !== document.updatedAt;

  return `Criado por ${document.author.name} em ${created}${changed ? ` · Atualizado em ${updated}` : ""}`;
}

export function ProjectDocumentsPanel({
  projectId,
  kind,
  selectedId,
  onSelectedIdChange,
  createRequestVersion
}: ProjectDocumentsPanelProps) {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DocumentDraft>(emptyDraft);
  const [pendingFiles, setPendingFiles] = useState<PendingMarkdownFile[]>([]);
  const [initialDraft, setInitialDraft] = useState<DocumentDraft>(emptyDraft);
  const [conflict, setConflict] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const editorRef = useRef<MarkdownEditorHandle | null>(null);
  const handledCreateRequest = useRef(createRequestVersion);

  const notesQuery = useProjectNotes({ projectId, page, search });
  const minutesQuery = useMeetingMinutes({ projectId, page, search });
  const noteQuery = useProjectNote(kind === "notes" ? selectedId : null);
  const minuteQuery = useMeetingMinute(kind === "meeting-minutes" ? selectedId : null);
  const { data: users = [] } = useUsers();

  const listQuery = kind === "notes" ? notesQuery : minutesQuery;
  const selectedDocument = (kind === "notes" ? noteQuery.data : minuteQuery.data) ?? null;
  const saveNote = useSaveProjectNote(projectId);
  const saveMinute = useSaveMeetingMinute(projectId);
  const deleteDocument = useDeleteProjectDocument(projectId, kind);
  const deleteAttachment = useDeleteAttachment(undefined);

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(initialDraft) || pendingFiles.length > 0,
    [draft, initialDraft, pendingFiles.length]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!selectedDocument || creating) {
      return;
    }
    const nextDraft = draftFromDocument(selectedDocument);
    setDraft(nextDraft);
    setInitialDraft(nextDraft);
    setPendingFiles([]);
    setEditing(false);
    setConflict(false);
  }, [creating, selectedDocument]);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirty || (!editing && !creating)) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [creating, dirty, editing]);

  useEffect(() => {
    if (handledCreateRequest.current === createRequestVersion) {
      return;
    }

    handledCreateRequest.current = createRequestVersion;
    startCreate();
  }, [createRequestVersion]);

  const listItems = listQuery.data?.items ?? [];
  const totalPages = listQuery.data?.totalPages ?? 0;
  const participantOptions = users.map((user) => ({
    value: user.id,
    label: user.name,
    description: user.email,
    avatarUrl: user.avatarUrl
  }));

  function confirmDiscard(): boolean {
    return !dirty || (!editing && !creating) || window.confirm("Descartar alterações não salvas?");
  }

  function selectDocument(id: string) {
    if (!confirmDiscard()) {
      return;
    }
    setCreating(false);
    setEditing(false);
    onSelectedIdChange(id);
  }

  function startCreate() {
    if (!confirmDiscard()) {
      return;
    }
    const nextDraft = draftFromDocument(null);
    setCreating(true);
    setEditing(true);
    setDraft(nextDraft);
    setInitialDraft(nextDraft);
    setPendingFiles([]);
    setConflict(false);
    onSelectedIdChange(null);
  }

  function cancelEdit() {
    if (!confirmDiscard()) {
      return;
    }
    if (creating) {
      setCreating(false);
      setEditing(false);
      setPendingFiles([]);
      return;
    }
    setDraft(initialDraft);
    setPendingFiles([]);
    setEditing(false);
    setConflict(false);
  }

  function backToList() {
    if (!confirmDiscard()) {
      return;
    }
    setCreating(false);
    setEditing(false);
    setPendingFiles([]);
    onSelectedIdChange(null);
  }

  async function saveDocument() {
    const title = draft.title.trim();
    const content = editorRef.current?.getSubmitContent() ?? draft.content.trim();
    if (title.length < 2) {
      toast.error("Informe um título com pelo menos 2 caracteres");
      return;
    }
    if (!content && pendingFiles.length === 0 && (selectedDocument?.attachments.length ?? 0) === 0) {
      toast.error("Informe conteúdo markdown ou adicione pelo menos um anexo");
      return;
    }

    try {
      if (kind === "notes") {
        const saved = await saveNote.mutateAsync({
          noteId: creating ? undefined : selectedId ?? undefined,
          values: {
            title,
            content,
            expectedUpdatedAt: creating ? undefined : selectedDocument?.updatedAt
          },
          files: pendingFiles
        });
        setCreating(false);
        setEditing(false);
        setPendingFiles([]);
        onSelectedIdChange(saved.id);
      } else {
        if (!draft.meetingDate) {
          toast.error("Informe a data da reunião");
          return;
        }
        const saved = await saveMinute.mutateAsync({
          minuteId: creating ? undefined : selectedId ?? undefined,
          values: {
            title,
            content,
            meetingDate: draft.meetingDate,
            meetingTime: draft.meetingTime || null,
            participantUserIds: draft.participantUserIds,
            externalParticipants: normalizedExternalParticipants(draft.externalParticipantsText),
            expectedUpdatedAt: creating ? undefined : selectedDocument?.updatedAt
          },
          files: pendingFiles
        });
        setCreating(false);
        setEditing(false);
        setPendingFiles([]);
        onSelectedIdChange(saved.id);
      }
      setConflict(false);
      toast.success(kind === "notes" ? "Anotação salva" : "Ata salva");
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 409) {
        setConflict(true);
        return;
      }
      const message = isAxiosError(error)
        ? (error.response?.data as { error?: string } | undefined)?.error
        : undefined;
      toast.error(message ?? "Não foi possível salvar o documento");
    }
  }

  async function reloadConflict() {
    if (!selectedId) {
      return;
    }
    await refreshProjectDocument(projectId, kind, selectedId);
    setConflict(false);
    setPendingFiles([]);
  }

  async function confirmDelete() {
    if (!selectedId) {
      return;
    }
    try {
      await deleteDocument.mutateAsync(selectedId);
      setDeleteOpen(false);
      setEditing(false);
      onSelectedIdChange(null);
      toast.success(kind === "notes" ? "Anotação excluída" : "Ata excluída");
    } catch {
      toast.error("Não foi possível excluir o documento");
    }
  }

  async function removeAttachment(attachmentId: string) {
    try {
      await deleteAttachment.mutateAsync(attachmentId);
      if (selectedId) {
        await refreshProjectDocument(projectId, kind, selectedId);
      }
    } catch (error) {
      const message = isAxiosError(error)
        ? (error.response?.data as { error?: string } | undefined)?.error
        : undefined;
      toast.error(message ?? "Não foi possível remover o anexo");
    }
  }

  const isSaving = saveNote.isPending || saveMinute.isPending;
  const showEditor = creating || editing;

  return (
    <section className="min-w-0">
      <div className="grid min-h-[620px] min-w-0 border border-border bg-[--bg-1] lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className={cn("min-w-0 border-r border-border", (selectedDocument || creating) && "hidden lg:block")}>
          <div className="border-b border-border p-3">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true" />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                className="h-9 pl-9"
                placeholder={kind === "notes" ? "Buscar anotações" : "Buscar atas"}
              />
            </label>
          </div>

          <div className="min-h-[500px]">
            {listQuery.isLoading ? (
              <DocumentListSkeleton />
            ) : listItems.length === 0 ? (
              <EmptyState
                icon={kind === "notes" ? <NotebookPen /> : <UsersRound />}
                title={search ? "Nenhum resultado encontrado" : kind === "notes" ? "Nenhuma anotação" : "Nenhuma ata"}
              />
            ) : (
              <div className="divide-y divide-[--color-border-subtle]">
                {listItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectDocument(item.id)}
                    className={cn(
                      "block w-full min-w-0 px-3 py-3 text-left transition-colors hover:bg-[--bg-3]",
                      selectedId === item.id && "bg-[--bg-3]"
                    )}
                  >
                    <span className="block truncate text-[13px] font-semibold text-text-primary">{item.title}</span>
                    <span className="mt-1 block truncate text-[11px] text-text-muted">{documentTimestamp(item)}</span>
                    <span className="mt-1 block truncate text-[11px] text-text-secondary">por {item.author.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {totalPages > 1 ? (
            <Pagination className="border-t border-border p-2">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} />
                </PaginationItem>
                <PaginationItem>
                  <span className="px-2 text-[12px] text-text-muted">
                    {page} / {totalPages}
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)} />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          ) : null}
        </aside>

        <div className={cn("min-w-0 bg-[--bg-0]", !selectedDocument && !creating && "hidden lg:block")}>
          {!selectedDocument && !creating ? (
            <EmptyState
              icon={<FileText />}
              title={kind === "notes" ? "Selecione uma anotação" : "Selecione uma ata"}
            />
          ) : (
            <div className="flex min-h-full min-w-0 flex-col">
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-[--bg-2] px-4 py-4 md:px-6">
                <Button variant="ghost" className="h-8 px-2 lg:hidden" onClick={backToList}>
                  Voltar
                </Button>
                <div className="min-w-0 flex-1">
                  {showEditor ? (
                    <p className="text-[13px] font-semibold text-text-primary">
                      {creating
                        ? kind === "notes"
                          ? "Nova anotação"
                          : "Nova ata de reunião"
                        : kind === "notes"
                          ? "Editar anotação"
                          : "Editar ata de reunião"}
                    </p>
                  ) : selectedDocument ? (
                    <>
                      <h2 className="truncate text-[20px] font-semibold leading-tight text-text-primary">
                        {selectedDocument.title}
                      </h2>
                      <p className="mt-1 text-[11px] text-text-muted">{documentLifecycle(selectedDocument)}</p>
                      {isMeetingMinute(selectedDocument) ? (
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px] text-text-secondary">
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays aria-hidden="true" />
                            {format(parseISO(`${selectedDocument.meetingDate}T12:00:00`), "dd/MM/yyyy")}
                          </span>
                          {selectedDocument.meetingTime ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Clock3 aria-hidden="true" />
                              {selectedDocument.meetingTime}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>
                {!showEditor ? (
                  <div className="flex gap-2">
                    <Button variant="secondary" className="h-8 px-3" onClick={() => setEditing(true)}>
                      Editar
                    </Button>
                    <Button variant="ghost" className="h-8 px-2 text-[--status-late-text]" onClick={() => setDeleteOpen(true)}>
                      <Trash2 aria-hidden="true" />
                      Excluir
                    </Button>
                  </div>
                ) : null}
              </header>

              <div className="min-w-0 flex-1">
                {showEditor ? (
                  <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4 md:p-6">
                    {conflict ? (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[--status-review-text]/30 bg-[--status-review-bg] px-3 py-2">
                        <p className="text-[13px] text-[--status-review-text]">
                          Outra pessoa alterou este documento. Seu conteúdo local foi preservado.
                        </p>
                        <Button variant="secondary" className="h-8 px-3" onClick={() => void reloadConflict()}>
                          Carregar versão atual
                        </Button>
                      </div>
                    ) : null}

                    <label className="flex flex-col gap-1.5">
                      <span className="text-[13px] text-text-secondary">Título</span>
                      <Input
                        value={draft.title}
                        onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                        placeholder={kind === "notes" ? "Título da anotação" : "Título da reunião"}
                        autoFocus
                      />
                    </label>

                    {kind === "meeting-minutes" ? (
                      <>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="flex flex-col gap-1.5">
                            <span className="text-[13px] text-text-secondary">Data da reunião</span>
                            <DatePicker
                              value={draft.meetingDate}
                              onChange={(meetingDate) =>
                                setDraft((current) => ({ ...current, meetingDate: meetingDate ?? "" }))
                              }
                            />
                          </label>
                          <label className="flex flex-col gap-1.5">
                            <span className="text-[13px] text-text-secondary">Horário opcional</span>
                            <Input
                              type="time"
                              value={draft.meetingTime}
                              onChange={(event) =>
                                setDraft((current) => ({ ...current, meetingTime: event.target.value }))
                              }
                              className="[color-scheme:dark]"
                            />
                          </label>
                        </div>
                        <label className="flex flex-col gap-1.5">
                          <span className="text-[13px] text-text-secondary">Participantes internos</span>
                          <SearchableMultiSelect
                            values={draft.participantUserIds}
                            options={participantOptions}
                            onValuesChange={(participantUserIds) =>
                              setDraft((current) => ({ ...current, participantUserIds }))
                            }
                            placeholder="Selecionar usuários"
                            searchPlaceholder="Buscar usuário..."
                            allSelectedLabel="Todos os usuários"
                            partialSelectedLabel={(count) => `${count} participantes`}
                          />
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className="text-[13px] text-text-secondary">Participantes externos</span>
                          <Textarea
                            value={draft.externalParticipantsText}
                            onChange={(event) =>
                              setDraft((current) => ({ ...current, externalParticipantsText: event.target.value }))
                            }
                            placeholder="Um nome por linha ou separado por vírgula"
                            className="min-h-20"
                          />
                        </label>
                      </>
                    ) : null}

                    <div className="flex flex-col gap-1.5">
                      <span className="text-[13px] text-text-secondary">Conteúdo markdown ou anexos</span>
                      <MarkdownEditor
                        ref={editorRef}
                        value={draft.content}
                        onChange={(content) => setDraft((current) => ({ ...current, content }))}
                        onSubmit={() => void saveDocument()}
                        pendingFiles={pendingFiles}
                        onPendingFilesChange={setPendingFiles}
                        submitLabel="Salvar"
                        placeholder="Registre decisões, observações e referências..."
                        minHeightClassName="min-h-[280px]"
                        allowAttachmentOnly
                        disabled={isSaving}
                        footerActions={
                          <div className="flex w-full justify-end gap-2">
                            <Button variant="ghost" className="h-8 px-3" disabled={isSaving} onClick={cancelEdit}>
                              Cancelar
                            </Button>
                            <Button className="h-8 px-3" disabled={isSaving} onClick={() => void saveDocument()}>
                              {isSaving ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                              Salvar
                            </Button>
                          </div>
                        }
                      />
                    </div>

                    {!creating && selectedDocument?.attachments.length ? (
                      <DocumentAttachments
                        document={selectedDocument}
                        onDelete={(attachmentId) => void removeAttachment(attachmentId)}
                        deleting={deleteAttachment.isPending}
                      />
                    ) : null}
                  </div>
                ) : selectedDocument ? (
                  <DocumentViewer document={selectedDocument} />
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir {kind === "notes" ? "anotação" : "ata de reunião"}?</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-text-secondary">
            O documento e todos os seus anexos serão removidos permanentemente.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button variant="danger" disabled={deleteDocument.isPending} onClick={() => void confirmDelete()}>
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function DocumentViewer({ document }: { document: ProjectDocument }) {
  return (
    <article className="mx-auto w-full max-w-5xl px-4 py-2 md:px-8">
      {isMeetingMinute(document) ? <ParticipantsSection document={document} /> : null}
      <DocumentSection title={isMeetingMinute(document) ? "Registro da reunião" : "Conteúdo"}>
        {document.content ? (
          <MarkdownComment content={document.content} className="[&_*]:text-[14px] [&_p]:leading-6" />
        ) : (
          <p className="text-[13px] text-text-muted">Sem conteúdo textual.</p>
        )}
      </DocumentSection>
      <DocumentSection title="Anexos">
        {document.attachments.length ? (
          <DocumentAttachments document={document} hideTitle />
        ) : (
          <p className="text-[13px] text-text-muted">Nenhum anexo.</p>
        )}
      </DocumentSection>
    </article>
  );
}

function ParticipantsSection({ document }: { document: MeetingMinuteDto }) {
  const hasParticipants = document.participants.length > 0 || document.externalParticipants.length > 0;

  return (
    <DocumentSection title="Participantes">
      {hasParticipants ? (
        <div className="flex flex-wrap gap-2">
          {document.participants.map((participant) => (
            <span
              key={participant.id}
              className="inline-flex h-8 min-w-0 items-center gap-2 rounded-md border border-border bg-[--bg-3] px-2.5 text-[12px] font-medium text-text-primary"
            >
              <Avatar
                name={participant.user.name}
                imageUrl={participant.user.avatarUrl}
                className="size-5 shrink-0"
              />
              <span className="max-w-48 truncate">{participant.user.name}</span>
            </span>
          ))}
          {document.externalParticipants.map((participant) => (
            <Badge key={participant} tone="muted" className="h-8 gap-1.5 px-2.5 font-medium">
              <span className="max-w-48 truncate">{participant}</span>
              <span className="text-[10px] uppercase tracking-wide opacity-70">Externo</span>
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-text-muted">Nenhum participante informado.</p>
      )}
    </DocumentSection>
  );
}

function DocumentSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-[--color-border-subtle] py-5 last:border-b-0 md:grid md:grid-cols-[160px_minmax(0,1fr)] md:gap-6">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-text-muted md:mb-0">
        {title}
      </h3>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function DocumentAttachments({
  document,
  onDelete,
  deleting,
  hideTitle = false
}: {
  document: ProjectDocument;
  onDelete?: (attachmentId: string) => void;
  deleting?: boolean;
  hideTitle?: boolean;
}) {
  return (
    <section className="flex flex-col gap-2">
      {!hideTitle ? <h3 className="text-[12px] font-semibold uppercase tracking-wider text-text-muted">Anexos</h3> : null}
      <div className="flex flex-wrap gap-2">
        {document.attachments.map((attachment) => (
          <div key={attachment.id} className="relative">
            <AttachmentPreview attachment={attachment} canDeleteOverride={false} />
            {onDelete ? (
              <button
                type="button"
                disabled={deleting}
                onClick={() => onDelete(attachment.id)}
                className="mt-1 text-[11px] text-[--status-late-text] hover:underline disabled:opacity-50"
              >
                Remover
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function DocumentListSkeleton() {
  return (
    <div className="flex flex-col gap-px">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="border-b border-[--color-border-subtle] p-3">
          <div className="h-4 w-3/4 animate-pulse rounded bg-[--bg-4]" />
          <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-[--bg-4]" />
        </div>
      ))}
    </div>
  );
}
