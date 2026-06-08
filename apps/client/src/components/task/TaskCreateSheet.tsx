import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { CalendarDays, CheckCircle2, Flag, FolderKanban, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Priority, TaskStatus, type CreateTaskRequest, type Project, type ProjectCustomField } from "shared";
import { useProjects } from "../../hooks/useProjects";
import { useCreateTask } from "../../hooks/useTasks";
import { useUsers } from "../../hooks/useUsers";
import { useUiStore } from "../../store/uiStore";
import { PriorityOptionPill, enumColor, priorityColors, taskStatusColors, taskStatusLabels } from "../shared/statusVisuals";
import { writableTaskStatuses } from "../shared/Chip";
import { TaskStatusBadge } from "./TaskStatusBadge";
import { Button } from "../ui/button";
import { DatePicker, DateRangePicker } from "../ui/date-picker";
import { DecimalInput, parseDecimalInput } from "../ui/decimal-input";
import { Input } from "../ui/input";
import { SearchableSelect } from "../ui/searchable-select";
import { Sheet, SheetContent, SheetFooter } from "../ui/sheet";
import { Textarea } from "../ui/textarea";

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

const compactSelectTriggerClassName =
  "h-7 min-h-0 w-auto min-w-[112px] justify-start border-transparent bg-transparent px-1.5 text-left hover:bg-[--bg-3]";
const compactDatePickerClassName =
  "h-7 min-h-0 w-auto min-w-[112px] justify-between border-transparent bg-transparent px-1.5 text-[13px] hover:bg-[--bg-3]";
const compactInputClassName =
  "h-7 min-h-0 w-[112px] border-transparent bg-transparent px-1.5 text-[13px] hover:bg-[--bg-3] focus:bg-[--bg-3]";

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
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  const selectedProject = projects.find((project) => project.id === projectId) ?? null;
  const sections = useMemo(() => (selectedProject ? sectionsOf(selectedProject) : []), [selectedProject]);
  const selectedSection = sections.find((section) => section.id === sectionId) ?? null;
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
  }, [defaults.assigneeId, defaults.dueDate, defaults.projectId, defaults.sectionId, defaults.startDate, open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const frame = window.requestAnimationFrame(() => titleInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const projectSelectOptions = [
    { value: "none", label: "Sem projeto" },
    ...[...projects].sort((a, b) => a.name.localeCompare(b.name)).map((project) => ({
      value: project.id,
      label: project.name,
      description: projectBuilder(project)
    }))
  ];
  const sectionSelectOptions = [
    { value: "none", label: "Sem secao" },
    ...sections.map((section) => ({
      value: section.id,
      label: section.name
    }))
  ];
  const assigneeOptions = [
    { value: "none", label: "Sem responsável" },
    ...users.map((user) => ({ value: user.id, label: user.name, description: user.email, avatarUrl: user.avatarUrl }))
  ];
  const statusSelectOptions = [
    { value: "none", label: "Sem status" },
    ...writableTaskStatuses.map((option) => ({
      value: option,
      label: taskStatusLabels[option],
      color: taskStatusColors[option],
      render: <TaskStatusBadge status={option} />
    }))
  ];
  const prioritySelectOptions = [
    { value: "none", label: "Sem prioridade" },
    ...priorityOptions.map((option) => ({
      value: option.value,
      label: option.label,
      color: priorityColors[option.value],
      render: <PriorityOptionPill priority={option.value} />
    }))
  ];

  function handleProjectChange(nextProjectId: string) {
    const value = nextProjectId === "none" ? "" : nextProjectId;
    setProjectId(value);
    setSectionId("");
    setStage("");
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
      toast.error("Informe uma duracao estimada valida");
      return;
    }

    const parsedConclusionDays = parseDecimalInput(conclusionDays);
    if (parsedConclusionDays !== null && Number.isNaN(parsedConclusionDays)) {
      toast.error("Informe dias de conclusao validos");
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
      stage: stage || selectedSection?.name || null,
      customFieldValues: customFieldValues.length > 0 ? customFieldValues : undefined
    };

    try {
      await createTask.mutateAsync(payload);
      toast.success("Tarefa criada");
      setOpen(false);
    } catch {
      toast.error("Nao foi possivel criar a tarefa");
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        className="flex h-full w-full max-w-2xl flex-col border-l border-border bg-surface p-0 sm:max-w-2xl"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          titleInputRef.current?.focus();
        }}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <CheckCircle2 size={18} />
            <span>Tarefa</span>
          </div>
          <Button variant="ghost" className="h-9 w-9 px-0" onClick={() => setOpen(false)} title="Fechar">
            <X size={18} />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <Input
              ref={titleInputRef}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Nome da tarefa"
              className="h-auto border-transparent bg-transparent px-0 py-1 text-2xl font-bold leading-tight focus:border-brand-orange focus:bg-brand-black focus:px-2"
              autoFocus
            />

            <TaskFixedFieldGrid
              fields={[
                {
                  key: "projects",
                  label: "Projetos",
                  render: () => (
                    <SearchableSelect
                      value={projectId || "none"}
                      options={projectSelectOptions}
                      searchPlaceholder="Buscar projeto..."
                      triggerClassName={compactSelectTriggerClassName}
                      contentClassName="min-w-[260px] max-w-[420px]"
                      onValueChange={handleProjectChange}
                    />
                  )
                },
                {
                  key: "section",
                  label: "Secao",
                  render: () => (
                    <SearchableSelect
                      value={sectionId || "none"}
                      options={sectionSelectOptions}
                      searchPlaceholder="Buscar secao..."
                      triggerClassName={compactSelectTriggerClassName}
                      contentClassName="min-w-[260px] max-w-[420px]"
                      disabled={!projectId}
                      onValueChange={(value) => {
                        const next = value === "none" ? "" : value;
                        setSectionId(next);
                        setStage(sections.find((section) => section.id === next)?.name ?? "");
                      }}
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
                      options={[{ value: "none", label: "Sem plataforma" }, ...platformOptions]}
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
                      options={[{ value: "none", label: "Sem disciplina" }, ...disciplineOptions]}
                      searchPlaceholder="Buscar disciplina..."
                      triggerClassName={compactSelectTriggerClassName}
                      contentClassName="min-w-[220px] max-w-[320px]"
                      onValueChange={(value) => setTaskDiscipline(value === "none" ? "" : value)}
                    />
                  )
                },
                {
                  key: "maxDeadline",
                  label: "Prazo Maximo",
                  render: () => (
                    <DatePicker value={maxDeadline || null} onValueChange={(value) => setMaxDeadline(value ?? "")} placeholder="-" className={compactDatePickerClassName} />
                  )
                },
                {
                  key: "estimatedTime",
                  label: "Dias Estimados",
                  render: () => <DecimalInput value={estimatedDays} onValueChange={setEstimatedDays} placeholder="-" className={compactInputClassName} />
                },
                {
                  key: "conclusionDays",
                  label: "Dias Conclusão",
                  render: () => <DecimalInput value={conclusionDays} onValueChange={setConclusionDays} placeholder="-" className={compactInputClassName} />
                },
                {
                  key: "stage",
                  label: "Etapa",
                  render: () => stageField ? <CreateCustomField field={stageField} value={stage} onChange={setStage} compact /> : <EmptyField />
                }
              ]}
            />

            <div className="mt-6 grid gap-4 text-sm">
              <DetailRow icon={<UserRound size={18} />} label="Responsavel">
                <SearchableSelect
                  value={assigneeId || "none"}
                  options={assigneeOptions}
                  searchPlaceholder="Buscar responsável..."
                  triggerClassName="min-h-10 w-full justify-start border-transparent bg-transparent px-2 text-left hover:bg-surface-hover"
                  contentClassName="min-w-[260px] max-w-[420px]"
                  onValueChange={(value) => setAssigneeId(value === "none" ? "" : value)}
                />
              </DetailRow>

              <DetailRow icon={<Flag size={18} />} label="Prioridade">
                <SearchableSelect
                  value={priority || "none"}
                  options={prioritySelectOptions}
                  searchPlaceholder="Buscar prioridade..."
                  triggerClassName="min-h-10 w-full justify-start border-transparent bg-transparent px-2 text-left hover:bg-surface-hover"
                  contentClassName="min-w-[220px] max-w-[320px]"
                  onValueChange={(value) => setPriority(value === "none" ? "" : value)}
                />
              </DetailRow>

              <DetailRow icon={<CalendarDays size={18} />} label="Prazo">
                <DateRangePicker
                  startDate={startDate}
                  endDate={dueDate}
                  onStartDateChange={(value) => setStartDate(value ?? "")}
                  onEndDateChange={(value) => setDueDate(value ?? "")}
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
              <h3 className="text-sm font-bold text-text-primary">Descricao</h3>
              <div className="mt-3 border-b border-border pb-6">
                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Do que se trata esta tarefa?"
                  className="min-h-28 resize-none overflow-hidden border-transparent bg-transparent focus:border-brand-orange focus:bg-brand-black"
                />
              </div>
            </section>
          </div>

          <SheetFooter className="border-t border-border bg-surface-card px-6 py-4">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createTask.isPending}>
              Criar tarefa
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function TaskFixedFieldGrid({
  fields
}: {
  fields: Array<{
    key: string;
    label: string;
    render: () => ReactNode;
  }>;
}) {
  return (
    <div className="mt-6 grid grid-cols-[140px_1fr] gap-x-4">
      {fields.map((field) => (
        <div key={field.key} className="contents">
          <div className="flex min-h-[32px] items-center border-b border-[--color-border-subtle]">
            <span className="text-[13px] font-normal text-[--color-text-secondary]">{field.label}</span>
          </div>
          <div className="flex min-h-[32px] items-center border-b border-[--color-border-subtle]">{field.render()}</div>
        </div>
      ))}
    </div>
  );
}

function DetailRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="relative grid min-h-10 grid-cols-[136px_minmax(0,1fr)] items-start gap-2">
      <div className="flex min-h-10 items-center gap-2 text-text-secondary">
        <span className="shrink-0">{icon}</span>
        <span className="min-w-0 leading-5">{label}</span>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function EmptyField() {
  return <span className="text-[13px] text-[--color-text-muted]">-</span>;
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
          { value: "none", label: "-" },
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

function sectionsOf(project: Project) {
  return project.sections ?? project.disciplines ?? [];
}

function projectBuilder(project: { builder?: string | null; client?: string | null }) {
  return project.builder ?? project.client ?? undefined;
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
