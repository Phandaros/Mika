import { useEffect, useRef, useState, type FormEvent } from "react";
import { DEFAULT_DISCIPLINES, ProjectStatus, type DisciplineType, type Project } from "shared";
import toast from "react-hot-toast";
import { useCreateProject, useUpdateProject } from "../../hooks/useProjects";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { Textarea } from "../ui/textarea";

interface ProjectFormProps {
  project?: Project;
  builderSuggestions?: string[];
  onCancel?: () => void;
  onCreated?: () => void;
  onSaved?: () => void;
}

export function ProjectForm({ project, builderSuggestions = [], onCancel, onCreated, onSaved }: ProjectFormProps) {
  const createProject = useCreateProject();
  const updateProject = useUpdateProject(project?.id ?? "");
  const [name, setName] = useState(project?.name ?? "");
  const [platform, setPlatform] = useState<"CAD" | "BIM" | "">(project?.platform ?? "");
  const [builder, setBuilder] = useState(project?.builder ?? project?.client ?? "");
  const [areaM2, setAreaM2] = useState(project?.areaM2?.toFixed(2) ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? ProjectStatus.ACTIVE);
  const [showDisciplineError, setShowDisciplineError] = useState(false);
  const [selectedDisciplineTypes, setSelectedDisciplineTypes] = useState<DisciplineType[]>(
    project?.disciplines?.map((discipline) => discipline.type) ?? []
  );

  useEffect(() => {
    setName(project?.name ?? "");
    setPlatform(project?.platform ?? "");
    setBuilder(project?.builder ?? project?.client ?? "");
    setAreaM2(project?.areaM2?.toFixed(2) ?? "");
    setDescription(project?.description ?? "");
    setStatus(project?.status ?? ProjectStatus.ACTIVE);
    setSelectedDisciplineTypes(project?.disciplines?.map((discipline) => discipline.type) ?? []);
    setShowDisciplineError(false);
  }, [project]);

  function toggleDiscipline(type: DisciplineType) {
    setShowDisciplineError(false);
    setSelectedDisciplineTypes((currentTypes) =>
      currentTypes.includes(type)
        ? currentTypes.filter((currentType) => currentType !== type)
        : [...currentTypes, type]
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (selectedDisciplineTypes.length === 0) {
      setShowDisciplineError(true);
      toast.error("Selecione pelo menos uma disciplina");
      return;
    }

    const parsedArea = areaM2 ? Number(areaM2.replace(",", ".")) : null;

    if (parsedArea !== null && Number.isNaN(parsedArea)) {
      toast.error("Informe uma area valida");
      return;
    }

    const payload = {
      name,
      client: builder || null,
      platform: platform || null,
      builder: builder || null,
      areaM2: parsedArea === null ? null : Number(parsedArea.toFixed(2)),
      description: description || null,
      status,
      disciplineTypes: selectedDisciplineTypes
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
      setSelectedDisciplineTypes([]);
      onCreated?.();
    } catch {
      toast.error(project ? "Nao foi possivel salvar o projeto" : "Nao foi possivel criar o projeto");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-text-secondary sm:col-span-2">
          Nome do projeto
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome do projeto" required />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-text-secondary sm:col-span-2">
          Construtora
          <BuilderAutocomplete
            value={builder}
            suggestions={builderSuggestions}
            onChange={setBuilder}
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-text-secondary">
          Plataforma
          <Select value={platform} onChange={(event) => setPlatform(event.target.value as "CAD" | "BIM" | "")}>
            <option value="">Selecionar plataforma</option>
            <option value="CAD">CAD</option>
            <option value="BIM">BIM</option>
          </Select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-text-secondary">
          Area (m2)
          <Input
            type="text"
            inputMode="decimal"
            value={areaM2}
            onChange={(event) => setAreaM2(event.target.value)}
            placeholder="0.00"
          />
        </label>
      </div>
      <Textarea
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Descricao"
      />
      <Select value={status} onChange={(event) => setStatus(event.target.value as ProjectStatus)}>
        {Object.values(ProjectStatus).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
      <fieldset className="grid gap-3">
        <legend className="text-sm font-semibold text-text-secondary">Disciplinas do projeto</legend>
        {showDisciplineError ? <p className="text-sm font-semibold text-red-400">Selecione pelo menos uma disciplina.</p> : null}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {DEFAULT_DISCIPLINES.map((discipline) => {
            const checked = selectedDisciplineTypes.includes(discipline.type);

            return (
              <label
                key={discipline.type}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm font-semibold transition",
                  checked
                    ? "border-brand-orange bg-brand-orange/15 text-text-primary"
                    : "border-border bg-brand-black text-text-secondary hover:bg-surface-hover"
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleDiscipline(discipline.type)}
                  className="h-4 w-4 accent-brand-orange"
                />
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: discipline.color }} />
                {discipline.name}
              </label>
            );
          })}
        </div>
      </fieldset>
      <Button type="submit" disabled={createProject.isPending || updateProject.isPending}>
        {project ? "Salvar projeto" : "Criar projeto"}
      </Button>
      {onCancel ? (
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
      ) : null}
    </form>
  );
}

function BuilderAutocomplete({
  value,
  suggestions,
  onChange
}: {
  value: string;
  suggestions: string[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const normalizedValue = value.trim().toLocaleLowerCase();
  const visibleSuggestions = suggestions.filter((suggestion) =>
    normalizedValue ? suggestion.toLocaleLowerCase().includes(normalizedValue) : true
  );

  useEffect(() => {
    function handleMouseDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        placeholder="Construtora"
      />
      {open ? (
        <div className="absolute left-0 right-0 top-11 z-50 max-h-56 overflow-y-auto rounded-md border border-border bg-surface-card p-1 shadow-2xl">
          {visibleSuggestions.length > 0 ? (
            visibleSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  onChange(suggestion);
                  setOpen(false);
                }}
                className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-text-primary transition hover:bg-surface-hover"
              >
                {suggestion}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-text-muted">Nova construtora</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
