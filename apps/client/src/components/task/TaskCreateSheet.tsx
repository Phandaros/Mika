import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { format } from "date-fns";
import { CalendarDays, Check, Flag, FolderKanban, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Priority, TaskStatus, type CreateTaskRequest, type Project, type ProjectCustomField } from "shared";
import { useProjects } from "../../hooks/useProjects";
import { useCreateTask } from "../../hooks/useTasks";
import { useUsers } from "../../hooks/useUsers";
import { dateOnlyToLocalDate } from "../../lib/utils";
import { useUiStore } from "../../store/uiStore";
import { Avatar } from "../shared/Avatar";
import { CompletionStatusChip, DisciplineChip, PlatformChip, taskStatusLabels, taskStatusOptions } from "../shared/Chip";
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
  FieldPanel,
  TaskFixedFieldGrid,
  TaskPanelShell
} from "./TaskPanelPrimitives";

type CustomFieldDraft = Record<string, string>;
type OpenCreateField = "assignee" | "priority" | null;

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

  return Boolean(target.closest('[data-mika-popover-content="true"], [data-radix-popper-content-wrapper]'));
}

export function TaskCreateSheet() {
  const open = useUiStore((state) => state.taskCreateOpen);
  const setOpen = useUiStore((state) => state.setTaskCreateOpen);
  const defaults = useUiStore((state) => state.taskCreateDefaults);
  const { data: projects = [] } = useProjects();
  const { data: users = [] } = useUsers();
  const [projectId, setProjectId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("");
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
  const [openField, setOpenField] = useState<OpenCreateField>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const asideRef = useRef<HTMLElement>(null);

  const selectedProject = projects.find((project) => project.id === projectId) ?? null;
  const selectedAssignee = users.find((user) => user.id === assigneeId) ?? null;
  const selectedPriority = priorityOptions.find((option) => option.value === priority) ?? null;
  const globalTaskFields = selectedProject?.taskCustomFields?.filter((field) => field.mikaDetailVisible !== false) ?? [];
  const stageField = globalTaskFields.find((field) => fieldIdentityMatches(field, ["etapa", "stage"])) ?? null;
  const lowerCustomFields = globalTaskFields.filter((field) => !isPromotedTaskField(field));
  const createTask = useCreateTask(projectId, sectionId);

  useEffect(() => {
    if (!open) {
      return;
    }

    setProjectId(defaults.projectId ?? "");
    setSectionId(defaults.sectionId ?? "");
    setTitle("");
    setStatus("");
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
    setOpenField(null);
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
        <Input
          ref={titleInputRef}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Nome da tarefa"
          className="h-auto border-transparent bg-transparent px-0 py-1 text-2xl font-bold leading-tight text-text-primary focus:border-brand-orange focus:bg-brand-black focus:px-2"
          autoFocus
        />

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
                  onValueChange={(value) => setStatus(value === "none" ? "" : value)}
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
              key: "completionStatus",
              label: "Status de Conclusão",
              render: () => <CompletionStatusChip completed={false} />
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
            <button
              type="button"
              onClick={() => setOpenField(openField === "assignee" ? null : "assignee")}
              className="flex min-h-10 w-full items-center gap-2 rounded-md px-2 text-left transition hover:bg-surface-hover"
            >
              {selectedAssignee ? (
                <>
                  <Avatar name={selectedAssignee.name} imageUrl={selectedAssignee.avatarUrl} className="h-7 w-7" />
                  <span className="font-medium text-text-primary">{selectedAssignee.name}</span>
                </>
              ) : (
                <span className="text-text-secondary">Sem responsável</span>
              )}
            </button>
            {openField === "assignee" ? (
              <FieldPanel>
                <button
                  type="button"
                  onClick={() => {
                    setAssigneeId("");
                    setOpenField(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-text-secondary transition hover:bg-surface-hover"
                >
                  Sem responsável
                </button>
                {users.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setAssigneeId(item.id);
                      setOpenField(null);
                    }}
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
              {selectedPriority ? <PriorityBadge priority={selectedPriority.value} /> : <span className="text-text-secondary">Sem prioridade</span>}
            </button>
            {openField === "priority" ? (
              <FieldPanel>
                <button
                  type="button"
                  onClick={() => {
                    setPriority("");
                    setOpenField(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-text-secondary transition hover:bg-surface-hover"
                >
                  Sem prioridade
                </button>
                {priorityOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setPriority(option.value);
                      setOpenField(null);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-text-primary transition hover:bg-surface-hover"
                  >
                    <PriorityBadge priority={option.value} />
                  </button>
                ))}
              </FieldPanel>
            ) : null}
          </DetailRow>

          <DetailRow icon={<CalendarDays size={18} />} label="Prazo">
            <CreateDateRangeField
              startDate={startDate}
              dueDate={dueDate}
              onStartDateChange={setStartDate}
              onDueDateChange={setDueDate}
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
  onChange
}: {
  projects: Project[];
  projectId: string;
  sectionId: string;
  onChange: (projectId: string, sectionId?: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const selectedProject = projects.find((project) => project.id === projectId) ?? null;
  const filteredProjects = useMemo(() => {
    const normalizedQuery = normalizeFieldName(query);

    return [...projects]
      .filter((project) => !normalizedQuery || normalizeFieldName(project.name).includes(normalizedQuery))
      .sort((a, b) => {
        const selectedDelta = Number(b.id === projectId) - Number(a.id === projectId);
        return selectedDelta || a.name.localeCompare(b.name, "pt-BR");
      });
  }, [projectId, projects, query]);

  return (
    <Popover onOpenChange={(open) => !open && setQuery("")}>
      <PopoverTrigger asChild>
        <Button variant="secondary" className={`${compactSelectTriggerClassName} max-w-full`}>
          <span className="min-w-0 truncate text-text-primary">{selectedProject ? selectedProject.name : "Selecionar"}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(420px,calc(100vw-32px))] overflow-x-hidden p-2">
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar projeto..." className="h-9" autoFocus />
        <div className="mt-2 max-h-72 overflow-y-auto overscroll-contain">
          {filteredProjects.length > 0 ? (
            <div className="grid gap-1">
              <button
                type="button"
                onClick={() => onChange("", null)}
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
                      onClick={() => onChange(selected ? "" : project.id, null)}
                      className="flex min-h-7 w-full min-w-0 items-center gap-2 overflow-hidden text-left font-semibold"
                    >
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center">{selected ? <Check size={15} className="text-brand-orange" /> : null}</span>
                      <span className="min-w-0 flex-1 truncate">{project.name}</span>
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

function CreateDateRangeField({
  startDate,
  dueDate,
  onStartDateChange,
  onDueDateChange
}: {
  startDate: string;
  dueDate: string;
  onStartDateChange: (value: string) => void;
  onDueDateChange: (value: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="min-h-10 w-full rounded-md px-2 text-left text-text-primary transition hover:bg-surface-hover">
          <CompletionDateLabel startDate={startDate} dueDate={dueDate} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3">
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <DatePicker value={startDate || null} onValueChange={(value) => onStartDateChange(value ?? "")} placeholder="Início" />
            <DatePicker value={dueDate || null} onValueChange={(value) => onDueDateChange(value ?? "")} placeholder="Entrega" />
          </div>
          <Button
            type="button"
            variant="ghost"
            className="h-8 justify-self-start"
            onClick={() => {
              onStartDateChange("");
              onDueDateChange("");
            }}
          >
            Apagar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
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

function sectionsOf(project: Project | null | undefined) {
  return project?.sections ?? project?.disciplines ?? [];
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
