import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
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
import { CalendarDays, Check, ChevronLeft, ChevronRight, Flag, FolderKanban, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Priority, TaskStatus, type CreateTaskRequest, type Project, type ProjectOption, type ProjectCustomField, type User } from "shared";
import { useProject, useProjectOptions } from "../../hooks/useProjects";
import { useCreateTask } from "../../hooks/useTasks";
import { useUsers } from "../../hooks/useUsers";
import { isTargetInsidePanelPortal } from "../../lib/panelOutsideClick";
import { cn, dateOnlyToLocalDate, localDateToDateOnly } from "../../lib/utils";
import { useUiStore } from "../../store/uiStore";
import { Avatar } from "../shared/Avatar";
import { DisciplineChip, PlatformChip, taskStatusLabels, taskStatusOptions } from "../shared/Chip";
import { PriorityBadge } from "../shared/PriorityBadge";
import { enumColor } from "../shared/statusVisuals";
import { Button } from "../ui/button";
import { DatePicker } from "../ui/date-picker";
import { DecimalInput, parseDecimalInput } from "../ui/decimal-input";
import { Input } from "../ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { SearchableSelect } from "../ui/searchable-select";
import { Textarea } from "../ui/textarea";
import { TaskStatusBadge } from "./TaskStatusBadge";
import {
  compactDatePickerClassName,
  compactInputClassName,
  compactSelectTriggerClassName,
  DetailRow,
  EmptyField,
  TaskFixedFieldGrid,
  TaskPanelShell
} from "./TaskPanelPrimitives";

type CustomFieldDraft = Record<string, string>;

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

const promotedTaskFieldKeys = new Set([
  "status",
  "dias-estimados",
  "dias-conclusao",
  "estimated-time",
  "prazo-maximo",
  "maximum-deadline",
  "etapa",
  "stage",
  "plataforma",
  "platform",
  "disciplina",
  "discipline"
]);

function isTargetInsidePanelShell(target: Element, aside: HTMLElement | null): boolean {
  if (aside?.contains(target)) {
    return true;
  }

  return isTargetInsidePanelPortal(target);
}

export function TaskCreateSheet() {
  const open = useUiStore((state) => state.taskCreateOpen);
  const setOpen = useUiStore((state) => state.setTaskCreateOpen);
  const defaults = useUiStore((state) => state.taskCreateDefaults);
  const { data: projects = [] } = useProjectOptions();
  const { data: users = [] } = useUsers();
  const [projectId, setProjectId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<TaskStatus | "">(TaskStatus.TODO);
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [estimatedDays, setEstimatedDays] = useState("");
  const [maxDeadline, setMaxDeadline] = useState("");
  const [conclusionDays, setConclusionDays] = useState("");
  const [platform, setPlatform] = useState("");
  const [taskDiscipline, setTaskDiscipline] = useState("");
  const [stage, setStage] = useState("");
  const [customFieldDraft, setCustomFieldDraft] = useState<CustomFieldDraft>({});
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const asideRef = useRef<HTMLElement>(null);

  const { data: projectDetail } = useProject(projectId || undefined);
  const selectedProject = projects.find((project) => project.id === projectId) ?? null;
  const globalTaskFields = projectDetail?.taskCustomFields?.filter((field) => field.mikaDetailVisible !== false) ?? [];
  const stageField = globalTaskFields.find((field) => fieldIdentityMatches(field, ["etapa", "stage"])) ?? null;
  const lowerCustomFields = globalTaskFields.filter((field) => !isPromotedTaskField(field));
  const createTask = useCreateTask(projectId, sectionId);

  useEffect(() => {
    if (!open || !projectId || sectionId) {
      return;
    }

    const nextSectionId = defaultSectionId(sectionsOf(selectedProject), defaults.sectionScope);
    if (nextSectionId) {
      setSectionId(nextSectionId);
      setStage(sectionsOf(selectedProject).find((section) => section.id === nextSectionId)?.name ?? "");
    }
  }, [defaults.sectionScope, open, projectId, sectionId, selectedProject]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setProjectId(defaults.projectId ?? "");
    setSectionId(defaults.sectionId ?? "");
    setTitle("");
    setStatus(TaskStatus.TODO);
    setDescription("");
    setAssigneeId(defaults.assigneeId ?? "");
    setPriority("");
    setStartDate(defaults.startDate ?? "");
    setDueDate(defaults.dueDate ?? defaults.startDate ?? "");
    setEstimatedDays("");
    setMaxDeadline("");
    setConclusionDays("");
    setPlatform("");
    setTaskDiscipline("");
    setStage("");
    setCustomFieldDraft({});
  }, [defaults.assigneeId, defaults.dueDate, defaults.projectId, defaults.sectionId, defaults.startDate, open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const frame = window.requestAnimationFrame(() => titleInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    }

    function handlePointerDown(event: PointerEvent) {
      if (!(event.target instanceof Element)) {
        return;
      }

      if (isTargetInsidePanelShell(event.target, asideRef.current)) {
        return;
      }

      setOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [open, setOpen]);

  const statusSelectOptions = [
    { value: "none", label: "Sem status", render: <EmptyField /> },
    ...taskStatusOptions.map((option) => ({
      value: option,
      label: taskStatusLabels[option],
      disabled: option === TaskStatus.OVERDUE,
      render: <TaskStatusBadge status={option} />
    }))
  ];

  function handleProjectChange(nextProjectId: string, nextSectionId: string | null = null) {
    setProjectId(nextProjectId);
    setSectionId(nextSectionId ?? "");
    setStage(nextSectionId ? sectionsOf(projects.find((project) => project.id === nextProjectId)).find((section) => section.id === nextSectionId)?.name ?? "" : "");
    setCustomFieldDraft({});
  }

  function handleDateRangeChange(nextStartDate: string, nextDueDate: string) {
    setStartDate(nextStartDate);
    setDueDate(nextDueDate);
    setStatus(statusFromDateRange(nextStartDate, nextDueDate));
  }

  function handleCustomFieldChange(settingId: string, value: string) {
    setCustomFieldDraft((current) => ({ ...current, [settingId]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      toast.error("Informe o nome da tarefa");
      return;
    }

    const parsedDays = parseDecimalInput(estimatedDays);
    if (parsedDays !== null && Number.isNaN(parsedDays)) {
      toast.error("Informe uma duração estimada válida");
      return;
    }

    const parsedConclusionDays = parseDecimalInput(conclusionDays);
    if (parsedConclusionDays !== null && Number.isNaN(parsedConclusionDays)) {
      toast.error("Informe dias de conclusão válidos");
      return;
    }

    const customFieldValues = buildCustomFieldPayload(globalTaskFields, customFieldDraft);
    const payload: CreateTaskRequest = {
      title: trimmedTitle,
      description: description.trim() || null,
      projectId: projectId || null,
      sectionId: sectionId || null,
      ...(status ? { status: status as TaskStatus } : {}),
      ...(priority ? { priority: priority as Priority } : {}),
      assigneeId: assigneeId || null,
      startDate: startDate || null,
      dueDate: dueDate || null,
      estimatedDays: parsedDays,
      estimatedTime: parsedDays,
      maxDeadline: maxDeadline || null,
      conclusionDays: parsedConclusionDays,
      platform: platform || null,
      taskDiscipline: taskDiscipline || null,
      stage: stage || null,
      customFieldValues: customFieldValues.length > 0 ? customFieldValues : undefined
    };

    try {
      await createTask.mutateAsync(payload);
      toast.success("Tarefa criada");
      setOpen(false);
    } catch {
      toast.error("Não foi possível criar a tarefa");
    }
  }

  if (!open) {
    return null;
  }

  return (
    <TaskPanelShell
      isOpen={open}
      asideRef={asideRef}
      onClose={() => setOpen(false)}
      headerContent={
        <Input
          ref={titleInputRef}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Nome da tarefa"
          className="h-auto min-w-0 border-transparent bg-transparent px-0 py-1 text-[16px] font-semibold leading-tight text-text-primary focus:border-brand-orange focus:bg-[--bg-3] focus:px-2"
          autoFocus
        />
      }
      footer={
        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-card px-6 py-4">
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="task-create-form" disabled={createTask.isPending}>
            Criar tarefa
          </Button>
        </div>
      }
    >
      <form id="task-create-form" onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <TaskFixedFieldGrid
          fields={[
            {
              key: "projects",
              label: "Projetos",
              render: () => (
                <CreateProjectsField
                  projects={projects}
                  projectId={projectId}
                  sectionId={sectionId}
                  sectionScope={defaults.sectionScope}
                  onChange={handleProjectChange}
                />
              )
            },
            {
              key: "status",
              label: "Status",
              render: () => (
                <SearchableSelect
                  value={status || "none"}
                  options={statusSelectOptions}
                  searchPlaceholder="Buscar status..."
                  triggerClassName={compactSelectTriggerClassName}
                  contentClassName="min-w-[220px] max-w-[320px]"
                  showSelectionIndicator={false}
                  onValueChange={(value) => setStatus(value === "none" ? "" : (value as TaskStatus))}
                />
              )
            },
            {
              key: "platform",
              label: "Plataforma",
              render: () => (
                <SearchableSelect
                  value={platform || "none"}
                  options={[
                    { value: "none", label: "Sem plataforma", render: <EmptyField /> },
                    ...platformOptions.map((option) => ({ ...option, render: <PlatformChip platform={option.value} /> }))
                  ]}
                  searchPlaceholder="Buscar plataforma..."
                  triggerClassName={compactSelectTriggerClassName}
                  contentClassName="min-w-[220px] max-w-[320px]"
                  onValueChange={(value) => setPlatform(value === "none" ? "" : value)}
                />
              )
            },
            {
              key: "discipline",
              label: "Disciplina",
              render: () => (
                <SearchableSelect
                  value={taskDiscipline || "none"}
                  options={[
                    { value: "none", label: "Sem disciplina", render: <EmptyField /> },
                    ...disciplineOptions.map((option) => ({ ...option, render: <DisciplineChip discipline={option.value} /> }))
                  ]}
                  searchPlaceholder="Buscar disciplina..."
                  triggerClassName={compactSelectTriggerClassName}
                  contentClassName="min-w-[220px] max-w-[320px]"
                  onValueChange={(value) => setTaskDiscipline(value === "none" ? "" : value)}
                />
              )
            },
            {
              key: "maxDeadline",
              label: "Prazo Máximo",
              render: () => (
                <DatePicker
                  value={maxDeadline || null}
                  onValueChange={(value) => setMaxDeadline(value ?? "")}
                  placeholder="—"
                  className={compactDatePickerClassName}
                />
              )
            },
            {
              key: "estimatedTime",
              label: "Dias Estimados",
              render: () => (
                <DecimalInput
                  value={estimatedDays}
                  onValueChange={setEstimatedDays}
                  placeholder="—"
                  className={`${compactInputClassName} font-mono text-[12px]`}
                />
              )
            },
            {
              key: "conclusionDays",
              label: "Dias Conclusão",
              render: () => (
                <DecimalInput
                  value={conclusionDays}
                  onValueChange={setConclusionDays}
                  placeholder="—"
                  className={`${compactInputClassName} font-mono text-[12px]`}
                />
              )
            },
            {
              key: "stage",
              label: "Etapa",
              render: () => (
                <CreateStageField
                  field={stageField}
                  value={stage}
                  onChange={setStage}
                />
              )
            }
          ]}
        />

        <div className="mt-6 grid gap-4 text-sm">
          <DetailRow icon={<UserRound size={18} />} label="Responsável">
            <CreateAssigneeField users={users} assigneeId={assigneeId} onChange={setAssigneeId} />
          </DetailRow>

          <DetailRow icon={<Flag size={18} />} label="Prioridade">
            <SearchableSelect
              value={priority || "none"}
              options={[
                { value: "none", label: "Sem prioridade", render: <span className="text-text-muted">Sem prioridade</span> },
                ...priorityOptions.map((option) => ({
                  value: option.value,
                  label: option.label,
                  render: <PriorityBadge priority={option.value} />
                }))
              ]}
              placeholder="Sem prioridade"
              searchPlaceholder="Buscar prioridade..."
              contentClassName="min-w-[220px] max-w-[320px]"
              showSelectionIndicator={false}
              renderValue={(option) =>
                option.value === "none" ? <span className="text-text-secondary">Sem prioridade</span> : <PriorityBadge priority={option.value as Priority} />
              }
              onValueChange={(value) => setPriority(value === "none" ? "" : value)}
            />
          </DetailRow>

          <DetailRow icon={<CalendarDays size={18} />} label="Datas">
            <CreateDateRangeField
              startDate={startDate}
              dueDate={dueDate}
              onDateRangeChange={handleDateRangeChange}
            />
          </DetailRow>

          {lowerCustomFields.map((field) => (
            <DetailRow key={field.id} icon={<FolderKanban size={18} />} label={field.mikaLabel ?? field.name}>
              <CreateCustomField
                field={field}
                value={customFieldDraft[field.mikaKey ?? field.id] ?? ""}
                onChange={(value) => handleCustomFieldChange(field.mikaKey ?? field.id, value)}
              />
            </DetailRow>
          ))}
        </div>

        <section className="mt-8">
          <h3 className="text-sm font-bold text-text-primary">Descrição</h3>
          <div className="mt-3 border-b border-border pb-6">
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Do que se trata esta tarefa?"
              className="min-h-28 resize-none overflow-hidden border-transparent bg-transparent focus:border-brand-orange focus:bg-brand-black"
            />
          </div>
        </section>
      </form>
    </TaskPanelShell>
  );
}

function CreateProjectsField({
  projects,
  projectId,
  sectionId,
  sectionScope,
  onChange
}: {
  projects: ProjectOption[];
  projectId: string;
  sectionId: string;
  sectionScope?: "civil" | "electrical" | "general";
  onChange: (projectId: string, sectionId?: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selectedProject = projects.find((project) => project.id === projectId) ?? null;
  const filteredProjects = useMemo(() => {
    const normalizedQuery = normalizeFieldName(query);

    return [...projects]
      .filter((project) => !normalizedQuery || normalizeFieldName(projectSearchLabel(project)).includes(normalizedQuery))
      .sort((a, b) => {
        const selectedDelta = Number(b.id === projectId) - Number(a.id === projectId);
        return selectedDelta || a.name.localeCompare(b.name, "pt-BR");
      });
  }, [projectId, projects, query]);

  function selectProject(nextProjectId: string, nextSectionId: string | null = null) {
    onChange(nextProjectId, nextSectionId);
    setOpen(false);
    setQuery("");
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setQuery("");
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="secondary" className={`${compactSelectTriggerClassName} max-w-full`}>
          <span className="min-w-0 truncate text-text-primary">
            {selectedProject ? projectMembershipLabel(selectedProject, sectionId) : "Selecionar"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(420px,calc(100vw-32px))] overflow-x-hidden p-2">
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar projeto..." className="h-9" autoFocus />
        <div className="mt-2 max-h-72 overflow-y-auto overscroll-contain">
          {filteredProjects.length > 0 ? (
            <div className="grid gap-1">
              <button
                type="button"
                onClick={() => selectProject("", null)}
                className="flex min-h-9 w-full min-w-0 items-center gap-2 overflow-hidden rounded-md px-2 py-1.5 text-left text-sm text-text-secondary transition hover:bg-surface-hover"
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">{!projectId ? <Check size={15} className="text-brand-orange" /> : null}</span>
                <span className="min-w-0 flex-1 truncate">Sem projeto</span>
              </button>
              {filteredProjects.map((project) => {
                const selected = project.id === projectId;
                const sections = sectionsOf(project);

                return (
                  <div
                    key={project.id}
                    className={`grid min-w-0 gap-2 rounded-md border border-transparent px-2 py-1.5 text-sm text-text-primary transition hover:bg-surface-hover ${selected ? "bg-surface-hover" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => selectProject(selected ? "" : project.id, selected ? null : defaultSectionId(sections, sectionScope))}
                      className="flex min-h-7 w-full min-w-0 items-center gap-2 overflow-hidden text-left font-semibold"
                    >
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center">{selected ? <Check size={15} className="text-brand-orange" /> : null}</span>
                      <ProjectSectionLabel project={project} sectionId={selected ? sectionId : defaultSectionId(sections, sectionScope)} />
                    </button>
                    {selected ? (
                      <SearchableSelect
                        value={sectionId || "none"}
                        options={[
                          { value: "none", label: "Sem seção", render: <EmptyField /> },
                          ...sections.map((section) => ({ value: section.id, label: section.name }))
                        ]}
                        triggerClassName="h-8 min-w-0 text-xs"
                        searchPlaceholder="Buscar seção..."
                        onValueChange={(value) => onChange(project.id, value === "none" ? null : value)}
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

function CreateAssigneeField({ users, assigneeId, onChange }: { users: User[]; assigneeId: string; onChange: (value: string) => void }) {
  return (
    <SearchableSelect
      value={assigneeId || "none"}
      options={[
        { value: "none", label: "Sem responsável", render: <span className="text-text-muted">Sem responsável</span> },
        ...users.map((item) => ({
          value: item.id,
          label: item.name,
          avatarUrl: item.avatarUrl
        }))
      ]}
      placeholder="Sem responsável"
      searchPlaceholder="Buscar responsável..."
      contentClassName="min-w-[240px] max-w-[320px]"
      renderValue={(option) =>
        option.value === "none" ? (
          <span className="text-text-secondary">Sem responsável</span>
        ) : (
          <span className="flex min-w-0 items-center gap-2">
            <Avatar name={option.label} imageUrl={option.avatarUrl} className="h-7 w-7 shrink-0" />
            <span className="min-w-0 truncate font-medium text-text-primary">{option.label}</span>
          </span>
        )
      }
      onValueChange={(value) => onChange(value === "none" ? "" : value)}
    />
  );
}

function CreateDateRangeField({
  startDate,
  dueDate,
  onDateRangeChange
}: {
  startDate: string;
  dueDate: string;
  onDateRangeChange: (startDate: string, dueDate: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftStart, setDraftStart] = useState<Date | null>(null);
  const [draftEnd, setDraftEnd] = useState<Date | null>(null);

  function openPicker() {
    setDraftStart(dateOnlyToLocalDate(startDate));
    setDraftEnd(dateOnlyToLocalDate(dueDate));
    setOpen(true);
  }

  function saveDates() {
    const normalized = normalizeDateDraft(draftStart, draftEnd);
    onDateRangeChange(localDateToDateOnly(normalized.startDate) ?? "", localDateToDateOnly(normalized.dueDate) ?? "");
    setOpen(false);
  }

  function clearDates() {
    setDraftStart(null);
    setDraftEnd(null);
    onDateRangeChange("", "");
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          openPicker();
          return;
        }

        setOpen(false);
      }}
    >
      <PopoverTrigger asChild>
        <button type="button" className="min-h-10 w-full rounded-md px-2 text-left text-text-primary transition hover:bg-surface-hover">
          <CompletionDateLabel startDate={startDate} dueDate={dueDate} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" collisionPadding={16} className="w-80 p-0">
        <CreateDateRangePanel
          startDate={draftStart}
          endDate={draftEnd}
          onStartDateChange={setDraftStart}
          onEndDateChange={setDraftEnd}
          onSave={saveDates}
          onClear={clearDates}
        />
      </PopoverContent>
    </Popover>
  );
}

function CreateDateRangePanel({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onSave,
  onClear
}: {
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
    const date = dateOnlyToLocalDate(value);
    onStartDateChange(date);

    if (date) {
      setMonth(date);
    }
  }

  function handleEndInputChange(value: string) {
    const date = dateOnlyToLocalDate(value);
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
    <div className="w-80 rounded-md border border-border bg-surface-card shadow-2xl">
      <div className="grid gap-3 p-3">
        <div className="grid grid-cols-2 gap-3">
          <DatePicker value={localDateToDateOnly(startDate)} onValueChange={(value) => handleStartInputChange(value ?? "")} placeholder="Início" />
          <DatePicker value={localDateToDateOnly(endDate)} onValueChange={(value) => handleEndInputChange(value ?? "")} placeholder="Entrega" />
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

function CompletionDateLabel({ startDate, dueDate }: { startDate: string | null; dueDate: string | null }) {
  if (startDate && dueDate) {
    return <span>{formatDisplayDate(startDate)} - {formatDisplayDate(dueDate)}</span>;
  }

  if (startDate) {
    return <span>Início {formatDisplayDate(startDate)}</span>;
  }

  if (dueDate) {
    return <span>Entrega {formatDisplayDate(dueDate)}</span>;
  }

  return <span className="text-text-secondary">Sem data</span>;
}

function formatDisplayDate(value: string): string {
  const date = dateOnlyToLocalDate(value);
  return date ? format(date, "dd/MM/yyyy") : "";
}

function CreateStageField({
  field,
  value,
  onChange
}: {
  field: ProjectCustomField | null;
  value: string;
  onChange: (value: string) => void;
}) {
  return field ? (
    <CreateCustomField field={field} value={value} onChange={onChange} compact />
  ) : (
    <Input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`${compactInputClassName} w-[220px]`}
      placeholder="—"
    />
  );
}

function CreateCustomField({
  field,
  value,
  onChange,
  compact = false
}: {
  field: ProjectCustomField;
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  const type = field.type.toLowerCase();
  const enabledOptions = field.enumOptions.filter((option) => option.enabled);

  if (enabledOptions.length > 0) {
    return (
      <SearchableSelect
        value={value || "none"}
        options={[
          { value: "none", label: "—", render: <EmptyField /> },
          ...enabledOptions.map((option) => ({
            value: option.name,
            label: option.name,
            color: enumColor(option.name, option.color)
          }))
        ]}
        searchPlaceholder={`Buscar ${field.name}...`}
        triggerClassName={compact ? compactSelectTriggerClassName : undefined}
        contentClassName="min-w-[220px] max-w-[320px]"
        onValueChange={(next) => onChange(next === "none" ? "" : next)}
      />
    );
  }

  if (type === "number" || type === "integer") {
    return <DecimalInput value={value} onValueChange={onChange} className={compact ? compactInputClassName : "h-10"} />;
  }

  if (type === "date") {
    return <DatePicker value={value} onValueChange={(nextValue) => onChange(nextValue ?? "")} className={compact ? compactDatePickerClassName : undefined} />;
  }

  return <Input value={value} onChange={(event) => onChange(event.target.value)} className={compact ? compactInputClassName : "h-10"} />;
}

function buildCustomFieldPayload(fields: ProjectCustomField[], draft: CustomFieldDraft): NonNullable<CreateTaskRequest["customFieldValues"]> {
  return fields.flatMap((field) => {
    const rawValue = draft[field.mikaKey ?? field.id]?.trim();
    if (!rawValue || isPromotedTaskField(field)) {
      return [];
    }

    const type = field.type.toLowerCase();
    const value = type === "number" || type === "integer" ? Number(rawValue.replace(",", ".")) : rawValue;
    if (typeof value === "number" && Number.isNaN(value)) {
      return [];
    }

    return [{ settingId: field.id, mikaKey: field.mikaKey ?? undefined, value }];
  });
}

function isPromotedTaskField(field: Pick<ProjectCustomField, "mikaKey" | "mikaLabel" | "name">): boolean {
  if (field.mikaKey && promotedTaskFieldKeys.has(field.mikaKey)) {
    return true;
  }

  return fieldIdentityMatches(field, [
    "status",
    "dias estimados",
    "dias conclusao",
    "estimated time",
    "estimated days",
    "prazo maximo",
    "maximum deadline",
    "etapa",
    "stage",
    "plataforma",
    "platform",
    "disciplina",
    "discipline"
  ]);
}

function sectionsOf(project: Pick<Project, "sections" | "disciplines"> | null | undefined) {
  return project?.sections ?? project?.disciplines ?? [];
}

function defaultSectionId(sections: Array<{ id: string; name: string }>, scope: "civil" | "electrical" | "general" | undefined): string {
  if (scope === "electrical") {
    return (
      sections.find((section) => {
        const normalized = normalizeFieldName(section.name);
        return normalized === "eletrico" || normalized === "eletrica";
      })?.id ??
      sections.find((section) => normalizeFieldName(section.name) === "civil")?.id ??
      sections[0]?.id ??
      ""
    );
  }

  return sections.find((section) => normalizeFieldName(section.name) === "civil")?.id ?? sections[0]?.id ?? "";
}

function normalizeDateDraft(startDate: Date | null, endDate: Date | null): { startDate: Date | null; dueDate: Date | null } {
  if (startDate && endDate) {
    return isBefore(endDate, startDate)
      ? { startDate: endDate, dueDate: startDate }
      : { startDate, dueDate: endDate };
  }

  return { startDate: null, dueDate: startDate ?? endDate };
}

function statusFromDateRange(startDate: string, dueDate: string): TaskStatus {
  if (!startDate && !dueDate) {
    return TaskStatus.TODO;
  }

  const start = dateOnlyToLocalDate(startDate);
  const end = dateOnlyToLocalDate(dueDate);
  const today = startOfDay(new Date());

  if (start && end) {
    const normalized = normalizeDateDraft(start, end);
    const normalizedStart = normalized.startDate ? startOfDay(normalized.startDate) : null;
    const normalizedEnd = normalized.dueDate ? startOfDay(normalized.dueDate) : null;

    if (normalizedStart && normalizedEnd && isWithinInterval(today, { start: normalizedStart, end: normalizedEnd })) {
      return TaskStatus.IN_PROGRESS;
    }
  }

  return TaskStatus.ON_SCHEDULE;
}

function projectMembershipLabel(project: Pick<Project, "name" | "sections" | "disciplines">, sectionId: string | null | undefined): string {
  const sections = sectionsOf(project);
  const section = sections.find((item) => item.id === sectionId);
  const suffix = section ? sectionAbbreviation(section.name) : null;
  return suffix ? `${project.name} / ${suffix}` : project.name;
}

function projectSearchLabel(project: Pick<Project, "name" | "sections" | "disciplines">): string {
  const sections = sectionsOf(project);
  return [project.name, ...sections.map((section) => section.name), ...sections.map((section) => sectionAbbreviation(section.name))].join(" ");
}

function sectionAbbreviation(name: string): string {
  const normalized = normalizeFieldName(name);

  if (normalized === "eletrico" || normalized === "eletrica") {
    return "ELE";
  }

  if (normalized === "civil") {
    return "CIV";
  }

  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 3)
    .toUpperCase();
}

function ProjectSectionLabel({
  project,
  sectionId
}: {
  project: Pick<Project, "name" | "sections" | "disciplines">;
  sectionId: string | null | undefined;
}) {
  const section = sectionsOf(project).find((item) => item.id === sectionId);
  const suffix = section ? sectionAbbreviation(section.name) : null;

  return (
    <span className="flex min-w-0 flex-1 items-center gap-1.5">
      <span className="min-w-0 truncate">{project.name}</span>
      {suffix ? <span className="shrink-0 text-text-muted">/ {suffix}</span> : null}
    </span>
  );
}

function formatMonthLabel(date: Date): string {
  const label = format(date, "MMMM 'de' yyyy", { locale: ptBR });
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

function fieldIdentityMatches(field: Pick<ProjectCustomField, "mikaKey" | "mikaLabel" | "name">, normalizedMatches: string[]): boolean {
  return [field.mikaKey, field.mikaLabel, field.name].some((value) => Boolean(value && normalizedMatches.includes(normalizeFieldName(value))));
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
