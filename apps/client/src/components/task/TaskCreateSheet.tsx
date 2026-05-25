import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { CalendarDays, CheckCircle2, Flag, FolderKanban, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Priority, TaskStatus, type CreateTaskRequest, type Project, type ProjectCustomField } from "shared";
import { useProjects } from "../../hooks/useProjects";
import { useCreateTask } from "../../hooks/useTasks";
import { useUsers } from "../../hooks/useUsers";
import { useUiStore } from "../../store/uiStore";
import {
  enumColor,
  PriorityOptionPill,
  priorityColors
} from "../shared/statusVisuals";
import { Button } from "../ui/button";
import { DatePicker, DateRangePicker } from "../ui/date-picker";
import { DecimalInput, parseDecimalInput } from "../ui/decimal-input";
import { Input } from "../ui/input";
import { SearchableSelect } from "../ui/searchable-select";
import { Separator } from "../ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from "../ui/sheet";
import { Textarea } from "../ui/textarea";

type CustomFieldDraft = Record<string, string>;

const priorityOptions: Array<{ value: Priority; label: string }> = [
  { value: Priority.LOW, label: "Baixa" },
  { value: Priority.MEDIUM, label: "Média" },
  { value: Priority.HIGH, label: "Alta" },
  { value: Priority.URGENT, label: "Urgente" }
];

const promotedTaskFieldKeys = new Set(["status", "dias-estimados", "estimated-time"]);

export function TaskCreateSheet() {
  const open = useUiStore((state) => state.taskCreateOpen);
  const defaults = useUiStore((state) => state.taskCreateDefaults);
  const setOpen = useUiStore((state) => state.setTaskCreateOpen);
  const { data: projects = [] } = useProjects();
  const { data: users = [] } = useUsers();
  const [projectId, setProjectId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState<Priority>(Priority.MEDIUM);
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [estimatedDays, setEstimatedDays] = useState("");
  const [customFieldDraft, setCustomFieldDraft] = useState<CustomFieldDraft>({});

  const selectedProject = projects.find((project) => project.id === projectId) ?? null;
  const sections = useMemo(() => (selectedProject ? sectionsOf(selectedProject) : []), [selectedProject]);
  const selectedSection = sections.find((section) => section.id === sectionId) ?? null;
  const globalTaskFields = selectedProject?.taskCustomFields?.filter((field) => field.mikaDetailVisible !== false) ?? [];
  const statusField = globalTaskFields.find((field) => field.mikaKey === "status") ?? null;
  const lowerCustomFields = globalTaskFields.filter((field) => !isPromotedTaskField(field));
  const createTask = useCreateTask(projectId, sectionId);

  useEffect(() => {
    if (!open) {
      return;
    }

    setProjectId(defaults.projectId ?? "");
    setSectionId(defaults.sectionId ?? "");
    setTitle("");
    setDescription("");
    setAssigneeId("");
    setPriority(Priority.MEDIUM);
    setStartDate("");
    setDueDate("");
    setEstimatedDays("");
    setCustomFieldDraft({});
  }, [defaults.projectId, defaults.sectionId, open]);

  useEffect(() => {
    if (!open || !selectedProject) {
      return;
    }

    if (sectionId && sections.some((section) => section.id === sectionId)) {
      return;
    }

    setSectionId(sections[0]?.id ?? "");
  }, [open, sectionId, sections, selectedProject]);

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
  const assigneeOptions = [
    { value: "none", label: "Sem responsável" },
    ...users.map((user) => ({ value: user.id, label: user.name, description: user.email, avatarUrl: user.avatarUrl }))
  ];
  const prioritySelectOptions = priorityOptions.map((option) => ({
    value: option.value,
    label: option.label,
    color: priorityColors[option.value],
    render: <PriorityOptionPill priority={option.value} />
  }));
  const statusSelectOptions = statusField
    ? [
        { value: "none", label: "-" },
        ...statusField.enumOptions
          .filter((option) => option.enabled)
          .map((option) => ({
            value: option.name,
            label: option.name,
            color: enumColor(option.name, option.color)
          }))
      ]
    : [];

  function handleProjectChange(nextProjectId: string) {
    const nextProject = projects.find((project) => project.id === nextProjectId) ?? null;
    setProjectId(nextProjectId);
    setSectionId(nextProject ? (sectionsOf(nextProject)[0]?.id ?? "") : "");
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

    if (!selectedProject || !selectedSection) {
      toast.error("Selecione um projeto com seção disponível");
      return;
    }

    const parsedDays = parseDecimalInput(estimatedDays);
    if (parsedDays !== null && Number.isNaN(parsedDays)) {
      toast.error("Informe uma duração estimada válida");
      return;
    }

    const customFieldValues = buildCustomFieldPayload(globalTaskFields, customFieldDraft);
    const payload: CreateTaskRequest = {
      title: trimmedTitle,
      description: description.trim() || null,
      status: TaskStatus.TODO,
      priority,
      assigneeId: assigneeId || null,
      startDate: startDate || null,
      dueDate: dueDate || null,
      estimatedDays: parsedDays,
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
      >
        <SheetHeader className="border-b border-border px-6 py-5">
          <SheetTitle>Nova tarefa</SheetTitle>
          <SheetDescription>Defina projeto e campos principais antes de criar.</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Nome da tarefa"
              className="h-auto border-transparent bg-transparent px-0 py-2 text-2xl font-bold leading-tight focus:border-brand-orange focus:bg-brand-black focus:px-3"
              autoFocus
            />

            <div className="mt-6 grid gap-4">
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

              {statusField ? (
                <FieldRow icon={<CheckCircle2 size={18} />} label="Status">
                  <SearchableSelect
                    value={customFieldDraft[statusField.mikaKey ?? statusField.id] || "none"}
                    options={statusSelectOptions}
                    searchPlaceholder="Buscar Status..."
                    onValueChange={(value) => handleCustomFieldChange(statusField.mikaKey ?? statusField.id, value === "none" ? "" : value)}
                  />
                </FieldRow>
              ) : null}

              <FieldRow icon={<Flag size={18} />} label="Prioridade">
                <SearchableSelect
                  value={priority}
                  options={prioritySelectOptions}
                  searchPlaceholder="Buscar prioridade..."
                  onValueChange={(value) => setPriority(value as Priority)}
                />
              </FieldRow>

              <FieldRow icon={<CalendarDays size={18} />} label="Datas">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <DateRangePicker
                      startDate={startDate}
                      endDate={dueDate}
                      onStartDateChange={(value) => setStartDate(value ?? "")}
                      onEndDateChange={(value) => setDueDate(value ?? "")}
                    />
                  </div>
                  <DecimalInput
                    value={estimatedDays}
                    onValueChange={setEstimatedDays}
                    placeholder="Dias estimados"
                  />
                </div>
              </FieldRow>

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

            <Separator className="my-6" />

            <label className="grid gap-2 text-sm font-semibold text-text-secondary">
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
    <div className="grid gap-2 sm:grid-cols-[128px_minmax(0,1fr)] sm:items-center">
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
          triggerClassName="h-9"
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
    if (!rawValue) {
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

function isPromotedTaskField(field: Pick<ProjectCustomField, "mikaKey">): boolean {
  return Boolean(field.mikaKey && promotedTaskFieldKeys.has(field.mikaKey));
}

function sectionsOf(project: Project) {
  return project.sections ?? project.disciplines ?? [];
}

function projectBuilder(project: { builder?: string | null; client?: string | null }) {
  return project.builder ?? project.client ?? undefined;
}
