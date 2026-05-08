import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  startOfMonth,
  startOfWeek
} from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Flag, FolderKanban, MessageSquare, Send, UserRound, X } from "lucide-react";
import { Priority, TaskStatus, type Task, type UpdateTaskRequest } from "shared";
import { useAuth } from "../../hooks/useAuth";
import { useComments, useCreateComment } from "../../hooks/useComments";
import { useUpdateTask, useUpdateTaskStatus } from "../../hooks/useTasks";
import { useUsers } from "../../hooks/useUsers";
import { cn } from "../../lib/utils";
import { Avatar } from "../shared/Avatar";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";

interface TaskDetailProps {
  task: Task | null;
  onClose: () => void;
}

type EditableField = "assignee" | "status" | "priority" | "completionDate" | null;

const statusOptions: Array<{ value: TaskStatus; label: string; color: string }> = [
  { value: TaskStatus.BACKLOG, label: "Backlog", color: "var(--color-status-backlog)" },
  { value: TaskStatus.TODO, label: "A fazer", color: "var(--color-status-todo)" },
  { value: TaskStatus.IN_PROGRESS, label: "Em andamento", color: "var(--color-status-in-progress)" },
  { value: TaskStatus.IN_REVIEW, label: "Em revisão", color: "var(--color-status-in-review)" },
  { value: TaskStatus.DONE, label: "Concluído", color: "var(--color-status-done)" }
];

const priorityOptions: Array<{ value: Priority; label: string; color: string }> = [
  { value: Priority.LOW, label: "Baixa", color: "var(--color-priority-low)" },
  { value: Priority.MEDIUM, label: "Media", color: "var(--color-priority-medium)" },
  { value: Priority.HIGH, label: "Alta", color: "var(--color-priority-high)" },
  { value: Priority.URGENT, label: "Urgente", color: "var(--color-priority-urgent)" }
];

export function TaskDetail({ task, onClose }: TaskDetailProps) {
  const { user } = useAuth();
  const [visibleTask, setVisibleTask] = useState<Task | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [openField, setOpenField] = useState<EditableField>(null);
  const [dateDraftStart, setDateDraftStart] = useState<Date | null>(null);
  const [dateDraftEnd, setDateDraftEnd] = useState<Date | null>(null);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [comment, setComment] = useState("");
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);
  const completionDateTriggerRef = useRef<HTMLButtonElement | null>(null);
  const completionDatePanelRef = useRef<HTMLDivElement | null>(null);
  const projectId = visibleTask?.discipline?.projectId ?? "";
  const { data: users = [] } = useUsers();
  const updateTask = useUpdateTask(projectId);
  const updateTaskStatus = useUpdateTaskStatus(projectId);
  const { data: comments = visibleTask?.comments ?? [] } = useComments(visibleTask?.id);
  const createComment = useCreateComment(visibleTask?.id);

  useEffect(() => {
    if (task) {
      setVisibleTask(task);
      setOpenField(null);
      setDateDraftStart(task.startDate ? new Date(task.startDate) : null);
      setDateDraftEnd(task.dueDate ? new Date(task.dueDate) : null);
      setIsEditingDescription(false);
      setIsEditingTitle(false);
      setDescriptionDraft(task.description ?? "");
      setTitleDraft(task.title);
      window.requestAnimationFrame(() => setIsOpen(true));
      return;
    }

    setIsOpen(false);
    const timeoutId = window.setTimeout(() => setVisibleTask(null), 180);
    return () => window.clearTimeout(timeoutId);
  }, [task]);

  useEffect(() => {
    if (!isEditingDescription || !descriptionRef.current) {
      return;
    }

    descriptionRef.current.style.height = "auto";
    descriptionRef.current.style.height = `${descriptionRef.current.scrollHeight}px`;
  }, [descriptionDraft, isEditingDescription]);

  useEffect(() => {
    if (openField !== "completionDate") {
      return;
    }

    function handleDocumentMouseDown(event: MouseEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (completionDatePanelRef.current?.contains(target) || completionDateTriggerRef.current?.contains(target)) {
        return;
      }

      void saveCompletionDate();
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        void saveCompletionDate();
      }
    }

    document.addEventListener("mousedown", handleDocumentMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dateDraftEnd, dateDraftStart, openField]);

  if (!visibleTask) {
    return null;
  }

  function requestClose() {
    setIsOpen(false);
    window.setTimeout(onClose, 180);
  }

  async function patchTask(payload: UpdateTaskRequest) {
    const currentTask = visibleTask;

    if (!currentTask) {
      return;
    }

    const updatedTask = await updateTask.mutateAsync({ id: currentTask.id, payload });
    setVisibleTask((current) => (current?.id === updatedTask.id ? { ...current, ...updatedTask } : current));
    setOpenField(null);
  }

  async function patchTaskStatus(status: TaskStatus) {
    const currentTask = visibleTask;

    if (!currentTask) {
      return;
    }

    const updatedTask = await updateTaskStatus.mutateAsync({ id: currentTask.id, status });
    setVisibleTask((current) => (current?.id === updatedTask.id ? { ...current, ...updatedTask } : current));
    setOpenField(null);
  }

  async function handleDescriptionSave() {
    await patchTask({ description: descriptionDraft.trim() || null });
    setIsEditingDescription(false);
  }

  async function handleTitleSave() {
    const title = titleDraft.trim();

    if (!title) {
      setTitleDraft(visibleTask?.title ?? "");
      setIsEditingTitle(false);
      return;
    }

    await patchTask({ title });
    setIsEditingTitle(false);
  }

  async function handleCustomFieldSave(fieldId: string, value: string) {
    await patchTask({ customFieldValues: [{ id: fieldId, value: value.trim() || null }] });
  }

  function openCompletionDate() {
    const currentTask = visibleTask;

    if (!currentTask) {
      return;
    }

    setDateDraftStart(currentTask.startDate ? new Date(currentTask.startDate) : null);
    setDateDraftEnd(currentTask.dueDate ? new Date(currentTask.dueDate) : null);
    setOpenField(openField === "completionDate" ? null : "completionDate");
  }

  async function saveCompletionDate() {
    await patchTask({
      startDate: dateDraftStart ? dateDraftStart.toISOString() : null,
      dueDate: dateDraftEnd ? dateDraftEnd.toISOString() : null
    });
  }

  async function clearCompletionDate() {
    setDateDraftStart(null);
    setDateDraftEnd(null);
    await patchTask({ startDate: null, dueDate: null });
  }

  function handleDescriptionKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const currentTask = visibleTask;

    if (event.key !== "Escape") {
      return;
    }

    setDescriptionDraft(currentTask?.description ?? "");
    setIsEditingDescription(false);
  }

  async function handleCommentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!comment.trim()) {
      return;
    }

    await createComment.mutateAsync({ content: comment.trim() });
    setComment("");
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-40 bg-brand-black/60 transition-opacity duration-200",
        isOpen ? "opacity-100" : "opacity-0"
      )}
      onMouseDown={requestClose}
    >
      <aside
        className={cn(
          "fixed inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l border-border bg-surface shadow-2xl transition-transform duration-200",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <CheckCircle2 size={18} />
            <span>Tarefa</span>
          </div>
          <Button variant="ghost" className="h-9 w-9 px-0" onClick={requestClose} title="Fechar">
            <X size={18} />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <Input
            value={isEditingTitle ? titleDraft : visibleTask.title}
            onFocus={() => {
              setTitleDraft(visibleTask.title);
              setIsEditingTitle(true);
            }}
            onChange={(event) => setTitleDraft(event.target.value)}
            onBlur={() => void handleTitleSave()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleTitleSave();
              }

              if (event.key === "Escape") {
                setTitleDraft(visibleTask.title);
                setIsEditingTitle(false);
              }
            }}
            className="h-auto border-transparent bg-transparent px-0 py-1 text-2xl font-bold leading-tight focus:border-brand-orange focus:bg-brand-black focus:px-2"
          />

          <div className="mt-6 grid gap-4 text-sm">
            <DetailRow icon={<UserRound size={18} />} label="Responsável">
              <button
                type="button"
                onClick={() => setOpenField(openField === "assignee" ? null : "assignee")}
                className="flex min-h-10 w-full items-center gap-2 rounded-md px-2 text-left transition hover:bg-surface-hover"
              >
                {visibleTask.assignee ? (
                  <>
                    <Avatar name={visibleTask.assignee.name} imageUrl={visibleTask.assignee.avatarUrl} className="h-7 w-7" />
                    <span className="font-medium text-text-primary">{visibleTask.assignee.name}</span>
                  </>
                ) : (
                  <span className="text-text-secondary">Sem responsavel</span>
                )}
              </button>
              {openField === "assignee" ? (
                <FieldPanel>
                  <button
                    type="button"
                    onClick={() => void patchTask({ assigneeId: null })}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-text-secondary transition hover:bg-surface-hover"
                  >
                    Sem responsavel
                  </button>
                  {users.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => void patchTask({ assigneeId: item.id })}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition hover:bg-surface-hover"
                    >
                      <Avatar name={item.name} imageUrl={item.avatarUrl} className="h-7 w-7" />
                      <span className="font-medium text-text-primary">{item.name}</span>
                    </button>
                  ))}
                </FieldPanel>
              ) : null}
            </DetailRow>

            <DetailRow icon={<CheckCircle2 size={18} />} label="Status">
              <button
                type="button"
                onClick={() => setOpenField(openField === "status" ? null : "status")}
                className="flex min-h-10 w-full items-center rounded-md px-2 text-left transition hover:bg-surface-hover"
              >
                <StatusPill status={visibleTask.status} />
              </button>
              {openField === "status" ? (
                <FieldPanel>
                  {statusOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => void patchTaskStatus(option.value)}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-text-primary transition hover:bg-surface-hover"
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: option.color }} />
                      {option.label}
                    </button>
                  ))}
                </FieldPanel>
              ) : null}
            </DetailRow>

            <DetailRow icon={<Flag size={18} />} label="Prioridade">
              <button
                type="button"
                onClick={() => setOpenField(openField === "priority" ? null : "priority")}
                className="flex min-h-10 w-full items-center rounded-md px-2 text-left transition hover:bg-surface-hover"
              >
                <PriorityPill priority={visibleTask.priority} />
              </button>
              {openField === "priority" ? (
                <FieldPanel>
                  {priorityOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => void patchTask({ priority: option.value })}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-text-primary transition hover:bg-surface-hover"
                    >
                      <Flag size={15} style={{ color: option.color }} />
                      {option.label}
                    </button>
                  ))}
                </FieldPanel>
              ) : null}
            </DetailRow>

            <DetailRow icon={<CalendarDays size={18} />} label="Data de conclusao">
              <button
                ref={completionDateTriggerRef}
                type="button"
                onClick={openCompletionDate}
                className="min-h-10 w-full rounded-md px-2 text-left text-text-primary transition hover:bg-surface-hover"
              >
                <CompletionDateLabel
                  startDate={openField === "completionDate" ? dateDraftStart : visibleTask.startDate}
                  dueDate={openField === "completionDate" ? dateDraftEnd : visibleTask.dueDate}
                />
              </button>
              {openField === "completionDate" ? (
                <DateRangePanel
                  panelRef={completionDatePanelRef}
                  startDate={dateDraftStart}
                  endDate={dateDraftEnd}
                  onStartDateChange={setDateDraftStart}
                  onEndDateChange={setDateDraftEnd}
                  onSave={() => void saveCompletionDate()}
                  onClear={() => void clearCompletionDate()}
                />
              ) : null}
            </DetailRow>

            <DetailRow icon={<FolderKanban size={18} />} label="Disciplina">
              <span className="text-text-primary">{visibleTask.discipline?.name ?? "Sem disciplina"}</span>
            </DetailRow>
          </div>

          {visibleTask.customFieldValues?.length ? (
            <section className="mt-8">
              <h3 className="text-sm font-bold text-text-primary">Campos</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {visibleTask.customFieldValues.map((field) => (
                  <EditableCustomField
                    key={field.id}
                    field={field}
                    onSave={(value) => void handleCustomFieldSave(field.id, value)}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {visibleTask.tags?.length ? (
            <section className="mt-8">
              <h3 className="text-sm font-bold text-text-primary">Tags</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {visibleTask.tags.map((tag) => (
                  <span key={tag.id} className="rounded-md border border-border bg-surface-card px-2 py-1 text-xs font-semibold text-text-secondary">
                    {tag.name}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-8">
            <h3 className="text-sm font-bold text-text-primary">Descrição</h3>
            <div className="mt-3 border-b border-border pb-6">
              <Textarea
                ref={descriptionRef}
                value={isEditingDescription ? descriptionDraft : visibleTask.description ?? ""}
                onFocus={() => {
                  setDescriptionDraft(visibleTask.description ?? "");
                  setIsEditingDescription(true);
                }}
                onChange={(event) => setDescriptionDraft(event.target.value)}
                onBlur={() => {
                  if (isEditingDescription) {
                    void handleDescriptionSave();
                  }
                }}
                onKeyDown={handleDescriptionKeyDown}
                placeholder="Do que se trata esta tarefa?"
                className="min-h-28 resize-none overflow-hidden border-transparent bg-transparent focus:border-brand-orange focus:bg-brand-black"
              />
            </div>
          </section>

          <section className="mt-8">
            <div className="flex items-center gap-2">
              <MessageSquare size={18} className="text-text-secondary" />
              <h3 className="text-sm font-bold text-text-primary">Comentários</h3>
              <span className="rounded-md bg-surface-card px-2 py-1 text-xs text-text-secondary">{comments.length}</span>
            </div>
            <div className="mt-4 grid gap-4">
              {comments.map((item) => (
                <div key={item.id} className="flex gap-3">
                  <Avatar name={item.author?.name ?? "Usuário"} imageUrl={item.author?.avatarUrl} className="h-8 w-8" />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-text-primary">{item.author?.name ?? "Usuário"}</span>
                      <span className="text-xs text-text-muted">{format(new Date(item.createdAt), "dd/MM/yyyy HH:mm")}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-text-secondary">{item.content}</p>
                  </div>
                </div>
              ))}
              {comments.length === 0 ? <p className="text-sm text-text-muted">Nenhum comentário ainda.</p> : null}
            </div>
          </section>
        </div>

        <form onSubmit={handleCommentSubmit} className="flex gap-3 border-t border-border p-5">
          {user ? <Avatar name={user.name} imageUrl={user.avatarUrl} className="h-9 w-9" /> : null}
          <Textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Adicionar um comentário"
            className="min-h-20"
          />
          <Button type="submit" className="h-10 w-10 px-0" disabled={createComment.isPending || !comment.trim()} title="Enviar">
            <Send size={16} />
          </Button>
        </form>
      </aside>
    </div>
  );
}

function DetailRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="relative grid grid-cols-[128px_minmax(0,1fr)] items-center gap-3">
      <div className="flex items-center gap-2 text-text-secondary">
        {icon}
        <span>{label}</span>
      </div>
      <div>{children}</div>
    </div>
  );
}

function FieldPanel({ children }: { children: ReactNode }) {
  return <div className="absolute left-32 top-11 z-50 grid max-h-72 w-64 gap-1 overflow-y-auto rounded-md border border-border bg-surface-card p-2 shadow-2xl">{children}</div>;
}

function EditableCustomField({
  field,
  onSave
}: {
  field: NonNullable<Task["customFieldValues"]>[number];
  onSave: (value: string) => void;
}) {
  const [value, setValue] = useState(String(field.displayValue ?? field.enumOptionName ?? field.numberValue ?? ""));

  useEffect(() => {
    setValue(String(field.displayValue ?? field.enumOptionName ?? field.numberValue ?? ""));
  }, [field.displayValue, field.enumOptionName, field.numberValue]);

  return (
    <label className="grid gap-2 rounded-md border border-border bg-surface-card p-3 text-sm font-semibold text-text-secondary">
      <span className="text-xs uppercase text-text-muted">{field.customFieldName ?? "Campo"}</span>
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => onSave(value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}

function CompletionDateLabel({ startDate, dueDate }: { startDate: string | Date | null; dueDate: string | Date | null }) {
  if (startDate && dueDate) {
    return (
      <span>
        {formatDisplayDate(startDate)} - {formatDisplayDate(dueDate)}
      </span>
    );
  }

  if (startDate) {
    return <span>Inicio {formatDisplayDate(startDate)}</span>;
  }

  if (dueDate) {
    return <span>Entrega {formatDisplayDate(dueDate)}</span>;
  }

  return <span className="text-text-secondary">Sem data</span>;
}

function DateRangePanel({
  panelRef,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onSave,
  onClear
}: {
  panelRef: RefObject<HTMLDivElement>;
  startDate: Date | null;
  endDate: Date | null;
  onStartDateChange: (date: Date | null) => void;
  onEndDateChange: (date: Date | null) => void;
  onSave: () => void;
  onClear: () => void;
}) {
  const [month, setMonth] = useState(() => new Date());
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month)),
    end: endOfWeek(endOfMonth(month))
  });

  function handleStartInputChange(value: string) {
    const date = inputDateValue(value);
    onStartDateChange(date);

    if (date) {
      setMonth(date);
    }
  }

  function handleEndInputChange(value: string) {
    const date = inputDateValue(value);
    onEndDateChange(date);

    if (date) {
      setMonth(date);
    }
  }

  function handleDaySelect(day: Date) {
    if (!startDate || (startDate && endDate)) {
      onStartDateChange(day);
      onEndDateChange(null);
      return;
    }

    if (isBefore(day, startDate)) {
      onStartDateChange(day);
      onEndDateChange(startDate);
      return;
    }

    onEndDateChange(day);
  }

  return (
    <div ref={panelRef} className="absolute left-32 top-11 z-50 w-80 rounded-md border border-border bg-surface-card shadow-2xl">
      <div className="grid gap-3 p-3">
        <div className="grid grid-cols-2 gap-3">
          <Input
            type="date"
            value={dateInputValue(startDate)}
            onChange={(event) => handleStartInputChange(event.target.value)}
          />
          <Input
            type="date"
            value={dateInputValue(endDate)}
            onChange={(event) => handleEndInputChange(event.target.value)}
          />
        </div>
        <div className="flex items-center justify-between">
          <Button variant="ghost" className="h-8 w-8 px-0" onClick={() => setMonth((current) => addMonths(current, -1))} title="Mês anterior">
            <ChevronLeft size={16} />
          </Button>
          <span className="text-sm font-semibold text-text-primary">{formatMonthLabel(month)}</span>
          <Button variant="ghost" className="h-8 w-8 px-0" onClick={() => setMonth((current) => addMonths(current, 1))} title="Próximo mês">
            <ChevronRight size={16} />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-text-muted">
          {["D", "S", "T", "Q", "Q", "S", "S"].map((day, index) => (
            <span key={`${day}-${index}`} className="py-1">
              {day}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1 overflow-hidden rounded-md">
          {days.map((day) => {
            const inRange = isDateInRange(day, startDate, endDate);
            const selectedStart = startDate ? isSameDay(day, startDate) : false;
            const selectedEnd = endDate ? isSameDay(day, endDate) : false;

            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => handleDaySelect(day)}
                className={cn(
                  "flex h-8 items-center justify-center text-sm transition hover:bg-surface-hover",
                  isSameMonth(day, month) ? "text-text-primary" : "text-text-muted",
                  inRange ? "bg-brand-orange/30 text-text-primary hover:bg-brand-orange/40" : "",
                  inRange && !selectedStart && !selectedEnd ? "rounded-none" : "rounded-md",
                  selectedStart || selectedEnd ? "bg-brand-orange font-bold text-brand-white hover:bg-brand-orange" : ""
                )}
              >
                {format(day, "d")}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-border p-3">
        <Button variant="ghost" onClick={onClear}>
          Apagar
        </Button>
        <Button onClick={onSave}>Salvar</Button>
      </div>
    </div>
  );
}

function dateInputValue(date: Date | null): string {
  return date ? format(date, "yyyy-MM-dd") : "";
}

function inputDateValue(value: string): Date | null {
  return value ? new Date(`${value}T00:00:00`) : null;
}

function formatDisplayDate(date: string | Date): string {
  return format(typeof date === "string" ? new Date(date) : date, "dd/MM/yyyy");
}

function formatMonthLabel(date: Date): string {
  const label = format(date, "MMMM 'de' yyyy", { locale: ptBR });
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

function isDateInRange(day: Date, startDate: Date | null, endDate: Date | null): boolean {
  if (!startDate || !endDate || isAfter(startDate, endDate)) {
    return false;
  }

  return isWithinInterval(day, { start: startDate, end: endDate });
}

function StatusPill({ status }: { status: TaskStatus }) {
  const option = statusOptions.find((item) => item.value === status) ?? statusOptions[0];

  return (
    <span className="inline-flex h-7 items-center gap-2 rounded-md border border-border px-2 text-xs font-semibold text-text-primary">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: option.color }} />
      {option.label}
    </span>
  );
}

function PriorityPill({ priority }: { priority: Priority }) {
  const option = priorityOptions.find((item) => item.value === priority) ?? priorityOptions[1];

  return (
    <span className="inline-flex h-7 items-center gap-2 rounded-md border border-border px-2 text-xs font-semibold text-text-primary">
      <Flag size={14} style={{ color: option.color }} />
      {option.label}
    </span>
  );
}
