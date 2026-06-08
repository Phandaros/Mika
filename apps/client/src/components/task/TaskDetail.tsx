import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type RefObject } from "react";
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
  startOfDay,
  startOfMonth,
  startOfWeek
} from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Flag, FolderKanban, MessageSquare, Send, UserRound } from "lucide-react";
import { Priority, TaskStatus, type Project, type Task, type UpdateTaskRequest } from "shared";
import { useAuth } from "../../hooks/useAuth";
import { useComments, useCreateComment } from "../../hooks/useComments";
import { useProjects } from "../../hooks/useProjects";
import { useUpdateTask, useUpdateTaskCompletion } from "../../hooks/useTasks";
import { useUsers } from "../../hooks/useUsers";
import { cn, dateOnlyToLocalDate, localDateToDateOnly, toDateOnly } from "../../lib/utils";
import { Avatar } from "../shared/Avatar";
import { CompletionStatusChip, DisciplineChip, PlatformChip, editableTaskStatusOptions, taskStatusLabels } from "../shared/Chip";
import { PriorityBadge } from "../shared/PriorityBadge";
import { enumColor } from "../shared/statusVisuals";
import { TaskStatusBadge } from "./TaskStatusBadge";
import { Button } from "../ui/button";
import { DatePicker } from "../ui/date-picker";
import { DecimalInput, parseDecimalInput } from "../ui/decimal-input";
import { Input } from "../ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { SearchableSelect } from "../ui/searchable-select";
import { Textarea } from "../ui/textarea";
import {
  compactDatePickerClassName,
  compactInputClassName,
  compactSelectTriggerClassName,
  DetailRow,
  EmptyField,
  FieldPanel,
  formatDecimal,
  TaskFixedFieldGrid,
  TaskPanelShell
} from "./TaskPanelPrimitives";

interface TaskDetailProps {
  task: Task | null;
  onClose: () => void;
  openVersion?: number;
}

type EditableField = "assignee" | "priority" | "completionDate" | null;
type TaskCustomField = NonNullable<Task["customFieldValues"]>[number];

const priorityOptions: Array<{ value: Priority; label: string }> = [
  { value: Priority.LOW, label: "Baixa" },
  { value: Priority.MEDIUM, label: "Média" },
  { value: Priority.HIGH, label: "Alta" },
  { value: Priority.URGENT, label: "Urgente" }
];

const platformOptions = [
  { value: "CAD", label: "CAD" },
  { value: "REVIT", label: "REVIT" },
  { value: "COORD", label: "COORD" }
];

const disciplineOptions = [
  { value: "ELE", label: "ELE" },
  { value: "SPDA", label: "SPDA" },
  { value: "TEL", label: "TEL" },
  { value: "HID", label: "HID" },
  { value: "PPCI", label: "PPCI" },
  { value: "HVAC", label: "HVAC" },
  { value: "COORD", label: "COORD" },
  { value: "EP", label: "EP" }
];

const promotedTaskFieldKeys = new Set(["status", "dias-estimados", "dias-conclusao", "estimated-time"]);
function isTargetInsidePanelShell(target: Element, asideRef: RefObject<HTMLElement>): boolean {
  const asideEl = asideRef.current;
  if (asideEl?.contains(target)) {
    return true;
  }

  return Boolean(target.closest('[data-mika-popover-content="true"], [data-radix-popper-content-wrapper]'));
}

function isPointInsideOpenPopover(clientX: number, clientY: number): boolean {
  const popovers = document.querySelectorAll('[data-mika-popover-content="true"], [data-radix-popper-content-wrapper]');

  for (const popover of popovers) {
    const rect = popover.getBoundingClientRect();
    if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
      return true;
    }
  }

  return false;
}

export function TaskDetail({ task, onClose, openVersion = 0 }: TaskDetailProps) {
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
  const asideRef = useRef<HTMLElement>(null);
  const closePanelTimeoutRef = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const projectId = visibleTask?.discipline?.projectId ?? "";
  const { data: projects = [] } = useProjects();
  const { data: users = [] } = useUsers();
  const updateTask = useUpdateTask(projectId);
  const updateTaskCompletion = useUpdateTaskCompletion(projectId);
  const { data: comments = visibleTask?.comments ?? [] } = useComments(visibleTask?.id);
  const createComment = useCreateComment(visibleTask?.id);

  const previousTaskIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!task) {
      previousTaskIdRef.current = null;
      setIsOpen(false);
      if (closePanelTimeoutRef.current != null) {
        window.clearTimeout(closePanelTimeoutRef.current);
        closePanelTimeoutRef.current = null;
      }
      const timeoutId = window.setTimeout(() => setVisibleTask(null), 480);
      return () => window.clearTimeout(timeoutId);
    }

    const previousId = previousTaskIdRef.current;
    previousTaskIdRef.current = task.id;

    if (closePanelTimeoutRef.current != null) {
      window.clearTimeout(closePanelTimeoutRef.current);
      closePanelTimeoutRef.current = null;
    }

    setVisibleTask(task);

    if (previousId === task.id) {
      setIsOpen(true);
      return undefined;
    }

    setOpenField(null);
    setDateDraftStart(dateOnlyToLocalDate(task.startDate));
    setDateDraftEnd(dateOnlyToLocalDate(task.dueDate));
    setIsEditingDescription(false);
    setIsEditingTitle(false);
    setDescriptionDraft(task.description ?? "");
    setTitleDraft(task.title);
    setIsOpen(false);
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setIsOpen(true));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [openVersion, task]);

  useEffect(() => {
    if (!isEditingDescription || !descriptionRef.current) {
      return;
    }

    descriptionRef.current.style.height = "auto";
    descriptionRef.current.style.height = `${descriptionRef.current.scrollHeight}px`;
  }, [descriptionDraft, isEditingDescription]);

  async function patchTask(payload: UpdateTaskRequest) {
    const currentTask = visibleTask;

    if (!currentTask) {
      return;
    }

    const updatedTask = await updateTask.mutateAsync({ id: currentTask.id, payload });
    setVisibleTask((current) => (current?.id === updatedTask.id ? { ...current, ...updatedTask } : current));
    setOpenField(null);
  }

  async function patchTaskCompletion(completed: boolean) {
    const currentTask = visibleTask;

    if (!currentTask) {
      return;
    }

    const updatedTask = await updateTaskCompletion.mutateAsync({ id: currentTask.id, completed });
    setVisibleTask((current) => (current?.id === updatedTask.id ? { ...current, ...updatedTask } : current));
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

  async function handleCustomFieldSave(field: NonNullable<Task["customFieldValues"]>[number], value: string | number | null) {
    const normalized =
      value === null || value === ""
        ? null
        : typeof value === "number"
          ? value
          : String(value).trim() || null;
    await patchTask({ customFieldValues: [{ id: field.id, mikaKey: field.mikaKey ?? undefined, value: normalized }] });
  }

  function openCompletionDate() {
    const currentTask = visibleTask;

    if (!currentTask) {
      return;
    }

    setDateDraftStart(dateOnlyToLocalDate(currentTask.startDate));
    setDateDraftEnd(dateOnlyToLocalDate(currentTask.dueDate));
    setOpenField(openField === "completionDate" ? null : "completionDate");
  }

  async function saveCompletionDate() {
    await patchTask({
      startDate: localDateToDateOnly(dateDraftStart),
      dueDate: localDateToDateOnly(dateDraftEnd)
    });
  }

  async function clearCompletionDate() {
    setDateDraftStart(null);
    setDateDraftEnd(null);
    await patchTask({ startDate: null, dueDate: null });
  }

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
        setDateDraftStart(dateOnlyToLocalDate(visibleTask?.startDate));
        setDateDraftEnd(dateOnlyToLocalDate(visibleTask?.dueDate));
        setOpenField(null);
      }
    }

    document.addEventListener("mousedown", handleDocumentMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dateDraftEnd, dateDraftStart, openField, visibleTask?.dueDate, visibleTask?.id, visibleTask?.startDate]);

  useEffect(() => {
    if (!visibleTask || !isOpen) {
      return undefined;
    }

    const currentTask = visibleTask;

    function handleTaskPanelEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) {
        return;
      }

      if (openField) {
        event.preventDefault();
        setOpenField(null);
        return;
      }

      if (isEditingTitle) {
        event.preventDefault();
        setTitleDraft(currentTask.title);
        setIsEditingTitle(false);
        return;
      }

      if (isEditingDescription) {
        event.preventDefault();
        setDescriptionDraft(currentTask.description ?? "");
        setIsEditingDescription(false);
        return;
      }

      event.preventDefault();
      requestClose();
    }

    document.addEventListener("keydown", handleTaskPanelEscape);
    return () => document.removeEventListener("keydown", handleTaskPanelEscape);
  }, [isEditingDescription, isEditingTitle, isOpen, openField, visibleTask]);

  useEffect(() => {
    if (!visibleTask || !isOpen) {
      return undefined;
    }

    function handlePointerDownCapture(event: PointerEvent) {
      if (!(event.target instanceof Element)) {
        return;
      }

      if (isTargetInsidePanelShell(event.target, asideRef) || isPointInsideOpenPopover(event.clientX, event.clientY)) {
        return;
      }

      setIsOpen(false);
      if (closePanelTimeoutRef.current != null) {
        return;
      }
      closePanelTimeoutRef.current = window.setTimeout(() => {
        closePanelTimeoutRef.current = null;
        onCloseRef.current();
      }, 480);
    }

    document.addEventListener("pointerdown", handlePointerDownCapture, true);
    return () => document.removeEventListener("pointerdown", handlePointerDownCapture, true);
  }, [isOpen, visibleTask]);

  if (!visibleTask) {
    return null;
  }

  const visibleCustomFields = visibleTask.customFieldValues?.filter((field) => field.mikaDetailVisible !== false) ?? [];
  const stageField = visibleCustomFields.find(isStageField) ?? null;
  const completionDaysField = visibleCustomFields.find(isCompletionDaysField) ?? null;
  const maximumDeadlineField = visibleCustomFields.find(isMaximumDeadlineField) ?? null;
  const lowerCustomFields = visibleCustomFields
    .filter(
      (field) =>
        !isPromotedTaskField(field) &&
        !isPlatformField(field) &&
        !isStageField(field) &&
        !isDisciplineField(field) &&
        !isCompletionStatusField(field) &&
        !isEstimatedTimeField(field) &&
        !isCompletionDaysField(field) &&
        !isMaximumDeadlineField(field)
    )
    .sort(compareTaskDetailFields);
  const fixedMaxDeadline = visibleTask.maxDeadline ?? fieldDisplayValue(maximumDeadlineField);
  const fixedEstimatedTime = visibleTask.estimatedTime ?? visibleTask.estimatedDays ?? fieldNumberValue(visibleCustomFields.find(isEstimatedTimeField));
  const fixedConclusionDays = visibleTask.conclusionDays ?? fieldNumberValue(completionDaysField);
  const fixedStage = visibleTask.stage ?? fieldDisplayValue(stageField);
  function requestClose() {
    setIsOpen(false);
    if (closePanelTimeoutRef.current != null) {
      return;
    }
    closePanelTimeoutRef.current = window.setTimeout(() => {
      closePanelTimeoutRef.current = null;
      onCloseRef.current();
    }, 480);
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
    <TaskPanelShell
      isOpen={isOpen}
      asideRef={asideRef}
      onClose={requestClose}
      footer={
        <form onSubmit={handleCommentSubmit} className="flex items-start gap-3 border-t border-border p-5">
          {user ? <Avatar name={user.name} imageUrl={user.avatarUrl} className="mt-1.5 h-9 w-9 shrink-0" /> : null}
          <Textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Adicionar um comentário"
            className="min-h-20 flex-1 resize-none"
          />
          <Button type="submit" className="mt-1.5 h-10 w-10 shrink-0 px-0" disabled={createComment.isPending || !comment.trim()} title="Enviar">
            <Send size={16} />
          </Button>
        </form>
      }
    >
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
            className={cn(
              "h-auto border-transparent bg-transparent px-0 py-1 text-2xl font-bold leading-tight focus:border-brand-orange focus:bg-brand-black focus:px-2",
              visibleTask.completed ? "text-text-muted" : "text-text-primary"
            )}
          />

          <TaskFixedFieldGrid
            fields={[
              {
                key: "projects",
                label: "Projetos",
                render: () => (
                  <EditableProjectsField
                    projects={projects}
                    selectedMemberships={visibleTask.projects?.flatMap((project) =>
                      project.sectionId ? [{ projectId: project.id, sectionId: project.sectionId }] : []
                    ) ?? []}
                    onSave={(projectMemberships) => void patchTask({ projectMemberships })}
                  />
                )
              },
              {
                key: "status",
                label: "Status",
                render: () => (
                  <EditableStatusField
                    task={visibleTask}
                    onSave={(status) => void patchTask({ status })}
                  />
                )
              },
              {
                key: "platform",
                label: "Plataforma",
                render: () => (
                  <EditablePlatformField
                    value={visibleTask.platform}
                    onSave={(platform) => void patchTask({ platform })}
                  />
                )
              },
              {
                key: "discipline",
                label: "Disciplina",
                render: () => (
                  <EditableDisciplineField
                    value={visibleTask.taskDiscipline}
                    onSave={(taskDiscipline) => void patchTask({ taskDiscipline })}
                  />
                )
              },
              {
                key: "completionStatus",
                label: "Status de Conclusão",
                render: () => (
                  <EditableCompletionStatusField
                    completed={visibleTask.completed}
                    onSave={(completed) => void patchTaskCompletion(completed)}
                  />
                )
              },
              {
                key: "maxDeadline",
                label: "Prazo Máximo",
                render: () => (
                  <DatePicker
                    value={fixedMaxDeadline ?? null}
                    onValueChange={(maxDeadline) => void patchTask({ maxDeadline })}
                    placeholder="—"
                    className={compactDatePickerClassName}
                  />
                )
              },
              {
                key: "estimatedTime",
                label: "Dias Estimados",
                render: () => (
                  <EditableDecimalField
                    value={fixedEstimatedTime}
                    onSave={(estimatedTime) => void patchTask({ estimatedTime, estimatedDays: estimatedTime })}
                  />
                )
              },
              {
                key: "conclusionDays",
                label: "Dias Conclusão",
                render: () => (
                  <EditableDecimalField
                    value={fixedConclusionDays}
                    onSave={(conclusionDays) => void patchTask({ conclusionDays })}
                  />
                )
              },
              {
                key: "stage",
                label: "Etapa",
                render: () => (
                  <EditableStageField
                    value={fixedStage}
                    stageField={stageField}
                    onSave={(stage) => void patchTask({ stage })}
                  />
                )
              }
            ]}
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
                  <span className="text-text-secondary">Sem responsável</span>
                )}
              </button>
              {openField === "assignee" ? (
                <FieldPanel>
                  <button
                    type="button"
                    onClick={() => void patchTask({ assigneeId: null })}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-text-secondary transition hover:bg-surface-hover"
                  >
                    Sem responsável
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
                      <PriorityBadge priority={option.value} />
                    </button>
                  ))}
                </FieldPanel>
              ) : null}
            </DetailRow>

            <DetailRow icon={<CalendarDays size={18} />} label="Prazo">
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

            {lowerCustomFields.map((field) => (
              <DetailRow key={field.mikaKey ?? field.id} icon={<FolderKanban size={18} />} label={taskFieldDisplayLabel(field)}>
                <EditableCustomField
                  field={field}
                  onSave={(value) => void handleCustomFieldSave(field, value)}
                />
              </DetailRow>
            ))}
          </div>
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
              <MessageSquare size={18} className="shrink-0 text-text-secondary" />
              <h3 className="text-sm font-bold text-text-primary">Comentários</h3>
              <span className="rounded-md bg-surface-card px-2 py-1 text-xs text-text-secondary">{comments.length}</span>
            </div>
            <div className="mt-4 flex flex-col gap-4">
              {comments.map((item) => (
                <div key={item.id} className="flex gap-3">
                  <Avatar
                    name={item.author?.name ?? "Usuário"}
                    imageUrl={item.author?.avatarUrl}
                    className="mt-0.5 h-8 w-8 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-sm font-semibold leading-5 text-text-primary">{item.author?.name ?? "Usuário"}</span>
                      <span className="text-xs tabular-nums text-text-muted">
                        {format(new Date(item.createdAt), "dd/MM/yyyy HH:mm")}
                      </span>
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">{item.content}</p>
                  </div>
                </div>
              ))}
              {comments.length === 0 ? <p className="text-sm text-text-muted">Nenhum comentário ainda.</p> : null}
            </div>
          </section>
        </div>
    </TaskPanelShell>
  );
}

function EditableProjectsField({
  projects,
  selectedMemberships,
  onSave
}: {
  projects: Project[];
  selectedMemberships: NonNullable<UpdateTaskRequest["projectMemberships"]>;
  onSave: (value: NonNullable<UpdateTaskRequest["projectMemberships"]>) => void;
}) {
  const [query, setQuery] = useState("");
  const selectedByProjectId = useMemo(
    () => new Map(selectedMemberships.map((membership) => [membership.projectId, membership])),
    [selectedMemberships]
  );
  const selectedIds = useMemo(() => new Set(selectedByProjectId.keys()), [selectedByProjectId]);
  const selectedNames = projects.filter((project) => selectedIds.has(project.id)).map((project) => project.name);
  const filteredProjects = useMemo(() => {
    const normalizedQuery = normalizeFieldName(query);

    return projects
      .filter((project) => !normalizedQuery || normalizeFieldName(project.name).includes(normalizedQuery))
      .sort((a, b) => {
        const selectedDelta = Number(selectedIds.has(b.id)) - Number(selectedIds.has(a.id));
        return selectedDelta || a.name.localeCompare(b.name, "pt-BR");
      });
  }, [projects, query, selectedIds]);

  function toggleProject(projectId: string) {
    const current = selectedByProjectId.get(projectId);
    const next = selectedMemberships.filter((membership) => membership.projectId !== projectId);

    if (!current) {
      const project = projects.find((item) => item.id === projectId);
      const sectionId = project ? defaultSectionId(project.sections ?? project.disciplines ?? []) : "";
      if (sectionId) {
        next.push({ projectId, sectionId });
      }
    }

    onSave(next);
  }

  function updateProjectSection(projectId: string, sectionId: string) {
    const exists = selectedByProjectId.has(projectId);
    const next = selectedMemberships.map((membership) =>
      membership.projectId === projectId ? { ...membership, sectionId } : membership
    );

    if (!exists) {
      next.push({ projectId, sectionId });
    }

    onSave(next);
  }

  return (
    <Popover onOpenChange={(open) => !open && setQuery("")}>
      <PopoverTrigger asChild>
        <Button variant="secondary" className={cn(compactSelectTriggerClassName, "max-w-full")}>
          <span className="min-w-0 truncate text-text-primary">
            {selectedNames.length > 0 ? selectedNames.join(", ") : "Selecionar"}
          </span>
          {selectedNames.length > 1 ? (
            <span className="ml-2 shrink-0 rounded bg-bg-3 px-1.5 py-0.5 text-[10px] font-semibold text-text-muted">
              {selectedNames.length}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(420px,calc(100vw-32px))] overflow-x-hidden p-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar projeto..."
          className="h-9"
          autoFocus
        />
        <div className="mt-2 max-h-72 overflow-y-auto overscroll-contain">
          {filteredProjects.length > 0 ? (
            <div className="grid gap-1">
              {filteredProjects.map((project) => {
                const selected = selectedIds.has(project.id);
                const sections = project.sections ?? project.disciplines ?? [];
                const membership = selectedByProjectId.get(project.id);

                return (
                  <div
                    key={project.id}
                    className={cn(
                      "grid min-w-0 gap-2 rounded-md border border-transparent px-2 py-1.5 text-sm text-text-primary transition hover:bg-surface-hover",
                      selected && "bg-surface-hover"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggleProject(project.id)}
                      className="flex min-h-7 w-full min-w-0 items-center gap-2 overflow-hidden text-left font-semibold"
                    >
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                        {selected ? <Check size={15} className="text-brand-orange" /> : null}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{project.name}</span>
                    </button>
                    {selected ? (
                      <SearchableSelect
                        value={membership?.sectionId ?? defaultSectionId(sections)}
                        options={sections.map((section) => ({ value: section.id, label: section.name }))}
                        triggerClassName="h-8 min-w-0 text-xs"
                        searchPlaceholder="Buscar seção..."
                        disabled={sections.length === 0}
                        onValueChange={(value) => updateProjectSection(project.id, value)}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-3 py-6 text-center text-sm text-text-muted">Nenhum projeto encontrado</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function EditableStatusField({ task, onSave }: { task: Task; onSave: (value: TaskStatus) => void }) {
  return (
    <SearchableSelect
      value={task.status}
      options={editableTaskStatusOptions(task).map((status) => ({
        value: status,
        label: taskStatusLabels[status],
        render: <TaskStatusBadge status={status} />
      }))}
      searchPlaceholder="Buscar status..."
      triggerClassName={compactSelectTriggerClassName}
      contentClassName="min-w-[220px] max-w-[320px]"
      showSelectionIndicator={false}
      onValueChange={(nextValue) => onSave(nextValue as TaskStatus)}
    />
  );
}

function EditableCompletionStatusField({ completed, onSave }: { completed: boolean; onSave: (value: boolean) => void }) {
  return (
    <SearchableSelect
      value={completed ? "completed" : "open"}
      options={[
        { value: "open", label: "Aberta", render: <CompletionStatusChip completed={false} /> },
        { value: "completed", label: "Concluída", render: <CompletionStatusChip completed /> }
      ]}
      searchPlaceholder="Buscar conclusão..."
      triggerClassName={compactSelectTriggerClassName}
      contentClassName="min-w-[220px] max-w-[320px]"
      onValueChange={(nextValue) => onSave(nextValue === "completed")}
    />
  );
}

function EditablePlatformField({ value, onSave }: { value: string | null | undefined; onSave: (value: string | null) => void }) {
  return (
    <SearchableSelect
      value={value ?? "none"}
      options={[
        { value: "none", label: "Sem plataforma", render: <EmptyField /> },
        ...platformOptions.map((option) => ({
          ...option,
          render: <PlatformChip platform={option.value} />
        }))
      ]}
      searchPlaceholder="Buscar plataforma..."
      triggerClassName={compactSelectTriggerClassName}
      contentClassName="min-w-[220px] max-w-[320px]"
      onValueChange={(nextValue) => onSave(nextValue === "none" ? null : nextValue)}
    />
  );
}

function EditableDisciplineField({ value, onSave }: { value: string | null | undefined; onSave: (value: string | null) => void }) {
  return (
    <SearchableSelect
      value={value ?? "none"}
      options={[
        { value: "none", label: "Sem disciplina", render: <EmptyField /> },
        ...disciplineOptions.map((option) => ({
          ...option,
          render: <DisciplineChip discipline={option.value} />
        }))
      ]}
      searchPlaceholder="Buscar disciplina..."
      triggerClassName={compactSelectTriggerClassName}
      contentClassName="min-w-[220px] max-w-[320px]"
      onValueChange={(nextValue) => onSave(nextValue === "none" ? null : nextValue)}
    />
  );
}

function EditableDecimalField({ value, onSave }: { value: number | null | undefined; onSave: (value: number | null) => void }) {
  const initialValue = value == null ? "" : formatDecimal(value);
  const [draft, setDraft] = useState(initialValue);

  useEffect(() => {
    setDraft(initialValue);
  }, [initialValue]);

  return (
    <DecimalInput
      value={draft}
      onValueChange={setDraft}
      onBlur={() => {
        const parsed = parseDecimalInput(draft);
        const nextValue = parsed === null || Number.isNaN(parsed) ? null : parsed;
        if (nextValue !== (value ?? null)) {
          onSave(nextValue);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
      className={cn(compactInputClassName, "font-mono text-[12px]")}
      placeholder="—"
    />
  );
}

function EditableStageField({
  value,
  stageField,
  onSave
}: {
  value: string | null | undefined;
  stageField: TaskCustomField | null;
  onSave: (value: string | null) => void;
}) {
  const enumOptions = stageField?.enumOptions?.filter((option) => option.name) ?? [];
  const [draft, setDraft] = useState(value ?? "");

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  if (enumOptions.length > 0) {
    return (
      <SearchableSelect
        value={value ?? "none"}
        options={[
          { value: "none", label: "Sem etapa", render: <EmptyField /> },
          ...enumOptions.map((option) => ({
            value: option.name,
            label: option.name,
            color: enumColor(option.name, option.color)
          }))
        ]}
        searchPlaceholder="Buscar etapa..."
        triggerClassName={compactSelectTriggerClassName}
        contentClassName="min-w-[220px] max-w-[320px]"
        onValueChange={(nextValue) => onSave(nextValue === "none" ? null : nextValue)}
      />
    );
  }

  return (
    <Input
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        const nextValue = draft.trim() || null;
        if (nextValue !== (value ?? null)) {
          onSave(nextValue);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
      className={cn(compactInputClassName, "w-[220px]")}
      placeholder="—"
    />
  );
}

function EditableCustomField({
  field,
  onSave
}: {
  field: NonNullable<Task["customFieldValues"]>[number];
  onSave: (value: string | number | null) => void;
}) {
  const asanaType = (field.type ?? "").toLowerCase();
  const label = field.mikaLabel ?? field.customFieldName ?? "Campo";
  const nameLower = label.toLowerCase();
  const isPlatform = nameLower.includes("plataforma") || nameLower.includes("platform");

  const normalizedEnumOptions =
    field.enumOptions && field.enumOptions.length > 0
      ? field.enumOptions
      : isPlatform
        ? [
            { id: "cad", name: "CAD", color: null as string | null },
            { id: "bim", name: "BIM", color: null as string | null }
          ]
        : [];

  const showEnumSelect = normalizedEnumOptions.length > 0;

  const [enumValue, setEnumValue] = useState(() => String(field.enumOptionName ?? field.displayValue ?? ""));
  const [textValue, setTextValue] = useState(() => String(field.displayValue ?? field.enumOptionName ?? ""));
  const [numValue, setNumValue] = useState(() => (field.numberValue != null ? String(field.numberValue) : ""));
  const [dateValue, setDateValue] = useState(() => {
    const raw = field.displayValue ?? "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return raw;
    }
    return "";
  });

  useEffect(() => {
    setEnumValue(String(field.enumOptionName ?? field.displayValue ?? ""));
    setTextValue(String(field.displayValue ?? field.enumOptionName ?? ""));
    setNumValue(field.numberValue != null ? String(field.numberValue) : "");
    const raw = field.displayValue ?? "";
    setDateValue(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "");
  }, [field.displayValue, field.enumOptionName, field.numberValue, field.id]);

  if (asanaType === "number" || asanaType === "integer") {
    return (
      <DecimalInput
        value={numValue}
        onValueChange={setNumValue}
        onBlur={() => {
          const parsed = parseDecimalInput(numValue);
          void onSave(parsed === null || Number.isNaN(parsed) ? null : parsed);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
      />
    );
  }

  if (asanaType === "date") {
    return (
      <DatePicker
        value={dateValue}
        onValueChange={(nextValue) => {
          const value = nextValue ?? "";
          setDateValue(value);
          void onSave(value || null);
        }}
      />
    );
  }

  if (showEnumSelect) {
    return (
      <SearchableSelect
        value={enumValue || "none"}
        options={[
          { value: "none", label: "?" },
          ...normalizedEnumOptions.map((option) => ({
            value: option.name,
            label: option.name,
            color: enumColor(option.name, option.color)
          }))
        ]}
        searchPlaceholder={"Buscar " + label + "..."}
        onValueChange={(next) => {
          setEnumValue(next === "none" ? "" : next);
          void onSave(next === "none" ? null : next);
        }}
      />
    );
  }

  return (
    <Input
      value={textValue}
      onChange={(event) => setTextValue(event.target.value)}
      onBlur={() => onSave(textValue)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
    />
  );
}

function compareTaskDetailFields(a: TaskCustomField, b: TaskCustomField): number {
  const byKnownOrder = taskDetailFieldOrder(a) - taskDetailFieldOrder(b);
  if (byKnownOrder !== 0) {
    return byKnownOrder;
  }

  return (a.mikaSortOrder ?? Number.MAX_SAFE_INTEGER) - (b.mikaSortOrder ?? Number.MAX_SAFE_INTEGER);
}

function taskDetailFieldOrder(field: TaskCustomField): number {
  if (isPlatformField(field)) {
    return 10;
  }

  if (isCompletionStatusField(field)) {
    return 20;
  }

  return 50;
}

function taskFieldDisplayLabel(field: TaskCustomField): string {
  if (isPlatformField(field)) {
    return "Plataforma";
  }

  if (isMaximumDeadlineField(field)) {
    return "Prazo Máximo";
  }

  if (isCompletionDaysField(field)) {
    return "Dias Conclusão";
  }

  return field.mikaLabel ?? field.customFieldName ?? "Campo";
}

function isPromotedTaskField(field: Pick<TaskCustomField, "mikaKey">): boolean {
  return Boolean(field.mikaKey && promotedTaskFieldKeys.has(field.mikaKey));
}

function isStageField(field: Pick<TaskCustomField, "mikaKey" | "mikaLabel" | "customFieldName">): boolean {
  return fieldIdentityMatches(field.mikaKey, field.mikaLabel, field.customFieldName, ["etapa", "stage"]);
}

function isDisciplineField(field: Pick<TaskCustomField, "mikaKey" | "mikaLabel" | "customFieldName">): boolean {
  return fieldIdentityMatches(field.mikaKey, field.mikaLabel, field.customFieldName, ["disciplina", "discipline"]);
}

function isPlatformField(field: Pick<TaskCustomField, "mikaKey" | "mikaLabel" | "customFieldName">): boolean {
  return fieldIdentityMatches(field.mikaKey, field.mikaLabel, field.customFieldName, ["plataforma", "platform"]);
}

function isCompletionStatusField(field: Pick<TaskCustomField, "mikaKey" | "mikaLabel" | "customFieldName">): boolean {
  return fieldIdentityMatches(field.mikaKey, field.mikaLabel, field.customFieldName, ["status de conclusao", "completion status"]);
}

function isMaximumDeadlineField(field: Pick<TaskCustomField, "mikaKey" | "mikaLabel" | "customFieldName">): boolean {
  return fieldIdentityMatches(field.mikaKey, field.mikaLabel, field.customFieldName, ["prazo maximo", "maximum deadline"]);
}

function isCompletionDaysField(field: Pick<TaskCustomField, "mikaKey" | "mikaLabel" | "customFieldName">): boolean {
  return fieldIdentityMatches(field.mikaKey, field.mikaLabel, field.customFieldName, ["dias conclusao", "completion days"]);
}

function isEstimatedTimeField(field: Pick<TaskCustomField, "mikaKey" | "mikaLabel" | "customFieldName">): boolean {
  return fieldIdentityMatches(field.mikaKey, field.mikaLabel, field.customFieldName, ["dias estimados", "estimated time", "estimated days"]);
}

function fieldDisplayValue(field: TaskCustomField | null | undefined): string | null {
  return field?.displayValue ?? field?.enumOptionName ?? (field?.numberValue != null ? String(field.numberValue) : null);
}

function fieldNumberValue(field: TaskCustomField | null | undefined): number | null {
  if (!field) {
    return null;
  }

  if (field.numberValue != null) {
    return field.numberValue;
  }

  const value = field.displayValue ?? field.enumOptionName;
  if (!value) {
    return null;
  }

  const parsed = Number(value.replace(",", "."));
  return Number.isNaN(parsed) ? null : parsed;
}

function fieldIdentityMatches(
  mikaKey: string | null | undefined,
  mikaLabel: string | null | undefined,
  name: string | null | undefined,
  normalizedMatches: string[]
): boolean {
  return [mikaKey, mikaLabel, name].some((value) => Boolean(value && normalizedMatches.includes(normalizeFieldName(value))));
}

function defaultSectionId(sections: Array<{ id: string; name: string }>): string {
  return sections.find((section) => normalizeFieldName(section.name) === "civil")?.id ?? sections[0]?.id ?? "";
}

function normalizeFieldName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
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
    return <span>Início {formatDisplayDate(startDate)}</span>;
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
          <DatePicker
            value={dateInputValue(startDate)}
            onValueChange={(value) => handleStartInputChange(value ?? "")}
            placeholder="Início"
          />
          <DatePicker
            value={dateInputValue(endDate)}
            onValueChange={(value) => handleEndInputChange(value ?? "")}
            placeholder="Entrega"
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
        <div className="grid grid-cols-7 gap-0 overflow-hidden rounded-md border border-border bg-border">
          {days.map((day) => {
            const s0 = startDate ? startOfDay(startDate) : null;
            const e0 = endDate ? startOfDay(endDate) : null;
            const d0 = startOfDay(day);
            const rangeOk = Boolean(s0 && e0 && !isAfter(s0, e0));
            const inClosedRange = rangeOk && s0 && e0 ? isWithinInterval(d0, { start: s0, end: e0 }) : false;
            const isStart = Boolean(startDate && isSameDay(day, startDate));
            const isEnd = Boolean(endDate && isSameDay(day, endDate));
            const isMiddle = inClosedRange && !isStart && !isEnd;

            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => handleDaySelect(day)}
                className={cn(
                  "flex h-8 items-center justify-center border border-transparent text-sm font-semibold transition outline-none",
                  isSameMonth(day, month) ? "text-text-primary" : "text-text-muted",
                  isMiddle && "bg-brand-orange/45 text-text-primary hover:bg-brand-orange/60",
                  (isStart || isEnd) && "z-[1] bg-brand-orange font-bold text-brand-white hover:bg-brand-orange",
                  !isMiddle && !isStart && !isEnd && "bg-surface-card hover:bg-surface-hover"
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
  return localDateToDateOnly(date) ?? "";
}

function inputDateValue(value: string): Date | null {
  return dateOnlyToLocalDate(value);
}

function formatDisplayDate(date: string | Date): string {
  if (typeof date === "string") {
    const dateOnly = toDateOnly(date);
    const parsed = dateOnlyToLocalDate(dateOnly);
    return parsed ? format(parsed, "dd/MM/yyyy") : "";
  }

  return format(date, "dd/MM/yyyy");
}

function formatMonthLabel(date: Date): string {
  const label = format(date, "MMMM 'de' yyyy", { locale: ptBR });
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

function PriorityPill({ priority }: { priority: Priority }) {
  const fallback = priorityOptions[1] ?? priorityOptions[0];
  const option = priorityOptions.find((item) => item.value === priority) ?? fallback;
  if (!option) {
    return null;
  }

  return <PriorityBadge priority={option.value} />;
}
