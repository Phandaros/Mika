import { useEffect, useState, type FormEvent } from "react";
import { ProjectStatus, type Project } from "shared";
import { toast } from "sonner";
import { useCreateProject, useUpdateProject } from "../../hooks/useProjects";
import { projectStatusLabels } from "../../lib/projectLabels";
import { Button } from "../ui/button";
import { DecimalInput, parseDecimalInput } from "../ui/decimal-input";
import { Input } from "../ui/input";
import { SearchableSelect } from "../ui/searchable-select";
import { Textarea } from "../ui/textarea";
import { BuilderCombobox } from "./BuilderCombobox";

interface ProjectFormProps {
  project?: Project;
  builderSuggestions?: string[];
  onCancel?: () => void;
  onCreated?: () => void;
  onSaved?: () => void;
}

type ProjectPlatform = "CAD" | "BIM" | "";

export function ProjectForm({ project, builderSuggestions = [], onCancel, onCreated, onSaved }: ProjectFormProps) {
  const createProject = useCreateProject();
  const updateProject = useUpdateProject(project?.id ?? "");
  const [name, setName] = useState(project?.name ?? "");
  const [platform, setPlatform] = useState<ProjectPlatform>(project?.platform ?? "");
  const [builder, setBuilder] = useState(project?.builder ?? "");
  const [areaM2, setAreaM2] = useState(project?.areaM2 != null ? formatAreaDraft(project.areaM2) : "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? ProjectStatus.ACTIVE);

  useEffect(() => {
    setName(project?.name ?? "");
    setPlatform(project?.platform ?? "");
    setBuilder(project?.builder ?? "");
    setAreaM2(project?.areaM2 != null ? formatAreaDraft(project.areaM2) : "");
    setDescription(project?.description ?? "");
    setStatus(project?.status ?? ProjectStatus.ACTIVE);
  }, [project]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedArea = parseDecimalInput(areaM2);
    if (parsedArea !== null && (Number.isNaN(parsedArea) || parsedArea < 0)) {
      toast.error("Informe uma área válida");
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Informe o nome do projeto");
      return;
    }

    const payload = {
      name: trimmedName,
      client: builder.trim() || null,
      platform: platform || null,
      builder: builder.trim() || null,
      areaM2: parsedArea === null ? null : Number(parsedArea.toFixed(2)),
      description: description.trim() || null,
      status
    };

    try {
      if (project) {
        await updateProject.mutateAsync(payload);
        onSaved?.();
        return;
      }

      await createProject.mutateAsync(payload);
      setName("");
      setPlatform("");
      setBuilder("");
      setAreaM2("");
      setDescription("");
      setStatus(ProjectStatus.ACTIVE);
      onCreated?.();
    } catch {
      toast.error(project ? "Não foi possível salvar o projeto" : "Não foi possível criar o projeto");
    }
  }

  function handleAreaBlur() {
    const parsed = parseDecimalInput(areaM2);
    if (parsed === null) {
      setAreaM2("");
      return;
    }

    if (Number.isNaN(parsed) || parsed < 0) {
      toast.error("Informe uma área válida");
      return;
    }

    setAreaM2(formatAreaDraft(parsed));
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-[13px] font-medium text-[--color-text-secondary] sm:col-span-2">
          Nome do projeto
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome do projeto" required />
        </label>

        <label className="grid gap-2 text-[13px] font-medium text-[--color-text-secondary] sm:col-span-2">
          Construtora
          <BuilderCombobox value={builder} suggestions={builderSuggestions} onChange={setBuilder} />
        </label>

        <label className="grid gap-2 text-[13px] font-medium text-[--color-text-secondary]">
          Plataforma
          <SearchableSelect
            value={platform || "none"}
            options={[
              { value: "none", label: "Sem plataforma", render: <span className="text-text-muted">—</span> },
              { value: "CAD", label: "CAD" },
              { value: "BIM", label: "BIM" }
            ]}
            searchPlaceholder="Buscar plataforma..."
            contentClassName="min-w-[220px] max-w-[320px]"
            onValueChange={(value) => setPlatform(value === "none" ? "" : (value as ProjectPlatform))}
          />
        </label>

        <label className="grid gap-2 text-[13px] font-medium text-[--color-text-secondary]">
          Área
          <span className="relative">
            <DecimalInput
              value={areaM2}
              onValueChange={(value) => setAreaM2(sanitizeDecimalInput(value))}
              onBlur={handleAreaBlur}
              placeholder="0,00"
              className="pr-10"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-[--color-text-muted]">
              m²
            </span>
          </span>
        </label>

        <label className="grid gap-2 text-[13px] font-medium text-[--color-text-secondary] sm:col-span-2">
          Status
          <SearchableSelect
            value={status}
            options={Object.values(ProjectStatus).map((option) => ({
              value: option,
              label: projectStatusLabels[option]
            }))}
            searchPlaceholder="Buscar status..."
            contentClassName="min-w-[220px] max-w-[320px]"
            onValueChange={(value) => setStatus(value as ProjectStatus)}
          />
        </label>

        <label className="grid gap-2 text-[13px] font-medium text-[--color-text-secondary] sm:col-span-2">
          Descrição
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Descrição do projeto"
          />
        </label>
      </div>

      {project?.customFields?.length ? (
        <section className="grid gap-3 rounded-md border border-border bg-brand-black p-4">
          <div>
            <h3 className="text-sm font-bold text-text-primary">Campos customizados do Asana</h3>
            <p className="mt-1 text-xs text-text-muted">Campos importados e disponíveis nas tarefas deste projeto.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {project.customFields.map((field) => (
              <div key={field.id} className="rounded-md border border-border bg-surface-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{field.name}</p>
                    <p className="mt-1 text-xs text-text-muted">{field.type}</p>
                  </div>
                  {field.isImportant ? <span className="rounded-md bg-brand-orange/15 px-2 py-1 text-xs font-semibold text-brand-orange">Importante</span> : null}
                </div>
                {field.enumOptions.length ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {field.enumOptions.filter((option) => option.enabled).map((option) => (
                      <span key={option.id} className="rounded-md border border-border px-2 py-1 text-xs text-text-secondary">
                        {option.name}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel ? (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
        <Button type="submit" disabled={createProject.isPending || updateProject.isPending}>
          {project ? "Salvar projeto" : "Criar projeto"}
        </Button>
      </div>
    </form>
  );
}

function sanitizeDecimalInput(value: string): string {
  const cleaned = value.replace(/[^\d,.]/g, "");
  const firstSeparator = cleaned.search(/[,.]/);
  if (firstSeparator === -1) {
    return cleaned;
  }

  const before = cleaned.slice(0, firstSeparator + 1);
  const after = cleaned.slice(firstSeparator + 1).replace(/[,.]/g, "");
  return `${before}${after}`;
}

function formatAreaDraft(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false
  });
}
