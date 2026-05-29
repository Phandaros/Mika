import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { CalendarDays, CheckCircle2, Flag, FolderKanban, Layers3, Monitor, UserRound, X } from "lucide-react";
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

export function TaskCreateSheet() {
  const open = useUiStore((state) => state.taskCreateOpen);
  const setOpen = useUiStore((state) => state.setTaskCreateOpen);
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

    setProjectId("");
    setSectionId("");
    setTitle("");
    setStatus("");
    setDescription("");
    setAssigneeId("");
    setPriority("");
    setStartDate("");
    setDueDate("");
    setEstimatedDays("");
    setMaxDeadline("");
    setConclusionDays("");
    setPlatform("");
    setTaskDiscipline("");
    setStage("");
    setCustomFieldDraft({});
  }, [open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const frame = window.requestAnimationFrame(() => titleInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const projectOptions = useMemo(
    () =>
      projects
        .filter((project) => sectionsOf(project).length > 0)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [projects]
  );
  const projectSelectOptions = projectOptions.map((project) => ({
    value: project.id,
    label: project.name,
    description: projectBuilder(project)
  }));
  const sectionSelectOptions = sections.map((section) => ({
    value: section.id,
    label: section.name
  }));
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
    setProjectId(nextProjectId);
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

    if (!selectedProject) {
      toast.error("Selecione um projeto");
      return;
    }

    if (!selectedSection) {
      toast.error("Selecione uma seção");
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
      stage: stage || selectedSection.name,
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

            <div className="mt-7 grid gap-4">
              <FieldRow icon={<CheckCircle2 size={18} />} label="Status">
                <SearchableSelect
                  value={status || "none"}
                  options={statusSelectOptions}
                  searchPlaceholder="Buscar status..."
                  onValueChange={(value) => setStatus(value === "none" ? "" : value)}
                />
              </FieldRow>

              <FieldRow icon={<FolderKanban size={18} />} label="Projeto">
                <SearchableSelect
                  value={projectId}
                  options={projectSelectOptions}
                  placeholder="Selecionar projeto"
                  searchPlaceholder="Buscar projeto..."
                  emptyMessage="Nenhum projeto encontrado"
                  onValueChange={handleProjectChange}
                />
              </FieldRow>

              <FieldRow icon={<Layers3 size={18} />} label="Seção">
                <SearchableSelect
                  value={sectionId}
                  options={sectionSelectOptions}
                  placeholder="Selecionar seção"
                  searchPlaceholder="Buscar seção..."
                  emptyMessage={projectId ? "Nenhuma seção encontrada" : "Selecione um projeto primeiro"}
                  disabled={!projectId}
                  onValueChange={(value) => {
                    setSectionId(value);
                    setStage(sections.find((section) => section.id === value)?.name ?? "");
                  }}
                />
              </FieldRow>

              <FieldRow icon={<Monitor size={18} />} label="Plataforma">
                <SearchableSelect
                  value={platform || "none"}
                  options={[{ value: "none", label: "Sem plataforma" }, ...platformOptions]}
                  searchPlaceholder="Buscar plataforma..."
                  onValueChange={(value) => setPlatform(value === "none" ? "" : value)}
                />
              </FieldRow>

              <FieldRow icon={<FolderKanban size={18} />} label="Disciplina">
                <SearchableSelect
                  value={taskDiscipline || "none"}
                  options={[{ value: "none", label: "Sem disciplina" }, ...disciplineOptions]}
                  searchPlaceholder="Buscar disciplina..."
                  onValueChange={(value) => setTaskDiscipline(value === "none" ? "" : value)}
                />
              </FieldRow>

              <FieldRow icon={<UserRound size={18} />} label="Responsável">
                <SearchableSelect
                  value={assigneeId || "none"}
                  options={assigneeOptions}
                  placeholder="Sem responsável"
                  searchPlaceholder="Buscar responsável..."
                  emptyMessage="Nenhum responsável encontrado"
                  onValueChange={(value) => setAssigneeId(value === "none" ? "" : value)}
                />
              </FieldRow>

              <FieldRow icon={<Flag size={18} />} label="Prioridade">
                <SearchableSelect
                  value={priority || "none"}
                  options={prioritySelectOptions}
                  searchPlaceholder="Buscar prioridade..."
                  onValueChange={(value) => setPriority(value === "none" ? "" : value)}
                />
              </FieldRow>

              <FieldRow icon={<CalendarDays size={18} />} label="Prazo">
                <DateRangePicker
                  startDate={startDate}
                  endDate={dueDate}
                  onStartDateChange={(value) => setStartDate(value ?? "")}
                  onEndDateChange={(value) => setDueDate(value ?? "")}
                />
              </FieldRow>

              <FieldRow icon={<CalendarDays size={18} />} label="Dias Estimados">
                <DecimalInput value={estimatedDays} onValueChange={setEstimatedDays} placeholder="-" />
              </FieldRow>

              <FieldRow icon={<CalendarDays size={18} />} label="Prazo Máximo">
                <DatePicker value={maxDeadline} onValueChange={(value) => setMaxDeadline(value ?? "")} placeholder="-" />
              </FieldRow>

              <FieldRow icon={<CalendarDays size={18} />} label="Dias Conclusão">
                <DecimalInput value={conclusionDays} onValueChange={setConclusionDays} placeholder="-" />
              </FieldRow>

              {stageField ? (
                <FieldRow icon={<Layers3 size={18} />} label="Etapa">
                  <CreateCustomField
                    field={stageField}
                    value={stage}
                    onChange={setStage}
                  />
                </FieldRow>
              ) : null}

              {lowerCustomFields.map((field) => (
                <FieldRow key={field.id} icon={<FolderKanban size={18} />} label={field.mikaLabel ?? field.name}>
                  <CreateCustomField
                    field={field}
                    value={customFieldDraft[field.mikaKey ?? field.id] ?? ""}
                    onChange={(value) => handleCustomFieldChange(field.mikaKey ?? field.id, value)}
                  />
                </FieldRow>
              ))}
            </div>

            <label className="mt-7 grid gap-2 border-t border-border pt-5 text-sm font-semibold text-text-secondary">
              Descrição
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Do que se trata esta tarefa?"
                className="min-h-32 resize-none"
              />
            </label>
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

function FieldRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-center">
      <div className="flex items-center gap-2 text-sm font-semibold text-text-secondary">
        {icon}
        <span>{label}</span>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function CreateCustomField({
  field,
  value,
  onChange
}: {
  field: ProjectCustomField;
  value: string;
  onChange: (value: string) => void;
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
        onValueChange={(next) => onChange(next === "none" ? "" : next)}
      />
    );
  }

  if (type === "number" || type === "integer") {
    return <DecimalInput value={value} onValueChange={onChange} className="h-10" />;
  }

  if (type === "date") {
    return <DatePicker value={value} onValueChange={(nextValue) => onChange(nextValue ?? "")} />;
  }

  return <Input value={value} onChange={(event) => onChange(event.target.value)} className="h-10" />;
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

    return [{ mikaKey: field.mikaKey ?? field.id, value }];
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
