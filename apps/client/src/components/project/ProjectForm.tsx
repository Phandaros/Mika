import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ProjectStatus, type Project, type ProjectCustomFieldValue, type UpdateProjectRequest } from "shared";
import { toast } from "sonner";
import { useCreateProject, useUpdateProject } from "../../hooks/useProjects";
import { resolveMutationErrorMessage } from "../../lib/mutationErrors";
import {
  buildProjectCustomFieldPatch,
  computeDerivedPortfolioFields,
  disciplineCountFromMultiEnum,
  fieldMultiValues,
  isProjectCustomFieldPatchValid,
  portfolioFieldLabels,
  projectCustomField
} from "../../lib/portfolioFields";
import { formatProjectArea, formatProjectAreaValue, projectStatusLabels } from "../../lib/projectLabels";
import { Button } from "../ui/button";
import { DecimalInput, parseDecimalInput } from "../ui/decimal-input";
import { Input } from "../ui/input";
import { SearchableSelect } from "../ui/searchable-select";
import { Textarea } from "../ui/textarea";
import { EmptyField } from "../task/TaskPanelPrimitives";
import {
  EditableProjectEnumField,
  EditableProjectMultiEnumField
} from "./ProjectInlineFields";
import { BuilderCombobox } from "./BuilderCombobox";

interface ProjectFormProps {
  project?: Project;
  builderSuggestions?: string[];
  onCancel?: () => void;
  onCreated?: () => void;
  onSaved?: () => void;
}

type ProjectPlatform = "CAD" | "BIM" | "";

type PortfolioDraft = Record<string, string | number | string[] | null>;

function portfolioFieldByKey(project: Project | undefined, mikaKey: string): ProjectCustomFieldValue | undefined {
  if (!project) {
    return undefined;
  }

  return (
    project.customFieldValues?.find((field) => field.mikaKey === mikaKey) ??
    projectCustomField(project, portfolioFieldLabels[mikaKey as keyof typeof portfolioFieldLabels] ?? mikaKey)
  );
}

function readPortfolioDraft(project: Project | undefined): PortfolioDraft {
  const financeField = portfolioFieldByKey(project, "financeiro");
  const disciplinasField = portfolioFieldByKey(project, "disciplinas");

  return {
    financeiro: fieldMultiValues(financeField).map((value) => value.name),
    disciplinas: fieldMultiValues(disciplinasField).map((value) => value.name),
    ppciGas: portfolioFieldByKey(project, "ppciGas")?.enumOptionName ?? portfolioFieldByKey(project, "ppciGas")?.displayValue ?? null,
    eleAprov: portfolioFieldByKey(project, "eleAprov")?.enumOptionName ?? portfolioFieldByKey(project, "eleAprov")?.displayValue ?? null,
    hidAprov: portfolioFieldByKey(project, "hidAprov")?.enumOptionName ?? portfolioFieldByKey(project, "hidAprov")?.displayValue ?? null,
    eleExec: portfolioFieldByKey(project, "eleExec")?.enumOptionName ?? portfolioFieldByKey(project, "eleExec")?.displayValue ?? null,
    hidExec: portfolioFieldByKey(project, "hidExec")?.enumOptionName ?? portfolioFieldByKey(project, "hidExec")?.displayValue ?? null
  };
}

function buildPortfolioPatches(project: Project, draft: PortfolioDraft): NonNullable<UpdateProjectRequest["customFieldValues"]> {
  const entries: Array<[string, string | number | string[] | null]> = [
    ["financeiro", draft.financeiro ?? []],
    ["disciplinas", draft.disciplinas ?? []],
    ["ppciGas", draft.ppciGas ?? null],
    ["eleAprov", draft.eleAprov ?? null],
    ["hidAprov", draft.hidAprov ?? null],
    ["eleExec", draft.eleExec ?? null],
    ["hidExec", draft.hidExec ?? null]
  ];

  const patches: NonNullable<UpdateProjectRequest["customFieldValues"]> = [];

  for (const [mikaKey, value] of entries) {
    const field = portfolioFieldByKey(project, mikaKey);
    if (!field) {
      continue;
    }

    const patch = buildProjectCustomFieldPatch(project, field, value);
    if (isProjectCustomFieldPatchValid(patch)) {
      patches.push(patch);
    }
  }

  return patches;
}

export function ProjectForm({ project, builderSuggestions = [], onCancel, onCreated, onSaved }: ProjectFormProps) {
  const createProject = useCreateProject();
  const updateProject = useUpdateProject(project?.id ?? "");
  const [name, setName] = useState(project?.name ?? "");
  const [platform, setPlatform] = useState<ProjectPlatform>(project?.platform ?? "");
  const [builder, setBuilder] = useState(project?.builder ?? "");
  const [areaM2, setAreaM2] = useState(project?.areaM2 != null ? formatAreaDraft(project.areaM2) : "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? ProjectStatus.ACTIVE);
  const [portfolioDraft, setPortfolioDraft] = useState<PortfolioDraft>(() => readPortfolioDraft(project));

  useEffect(() => {
    setName(project?.name ?? "");
    setPlatform(project?.platform ?? "");
    setBuilder(project?.builder ?? "");
    setAreaM2(project?.areaM2 != null ? formatAreaDraft(project.areaM2) : "");
    setDescription(project?.description ?? "");
    setStatus(project?.status ?? ProjectStatus.ACTIVE);
    setPortfolioDraft(readPortfolioDraft(project));
  }, [project]);

  const parsedAreaDraft = useMemo(() => {
    const parsed = parseDecimalInput(areaM2);
    if (parsed === null || Number.isNaN(parsed)) {
      return null;
    }

    return Number(parsed.toFixed(2));
  }, [areaM2]);

  const projectedArea = useMemo(() => {
    const disciplineCount = disciplineCountFromMultiEnum(
      (portfolioDraft.disciplinas as string[] | undefined)?.map((name) => ({ name })) ?? []
    );
    return computeDerivedPortfolioFields(parsedAreaDraft, disciplineCount).projectedArea;
  }, [parsedAreaDraft, portfolioDraft.disciplinas]);

  function updatePortfolioDraft(key: keyof PortfolioDraft, value: string | number | string[] | null) {
    setPortfolioDraft((current) => ({ ...current, [key]: value }));
  }

  function portfolioFieldDraftValue(projectRef: Project | undefined, mikaKey: string, draftValue: string | number | string[] | null) {
    const base = portfolioFieldByKey(projectRef, mikaKey);
    if (!base) {
      return undefined;
    }

    if (Array.isArray(draftValue)) {
      return {
        ...base,
        multiEnumValues: draftValue.map((name) => ({ gid: null, name, color: null })),
        displayValue: draftValue.join(", ") || null
      };
    }

    if (typeof draftValue === "string") {
      return {
        ...base,
        enumOptionName: draftValue,
        displayValue: draftValue
      };
    }

    return base;
  }

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

    const payload: UpdateProjectRequest = {
      name: trimmedName,
      client: builder.trim() || null,
      platform: platform || null,
      builder: builder.trim() || null,
      areaM2: parsedArea === null ? null : Number(parsedArea.toFixed(2)),
      description: description.trim() || null,
      status
    };

    if (project) {
      payload.customFieldValues = buildPortfolioPatches(project, portfolioDraft);
    }

    try {
      if (project) {
        await updateProject.mutateAsync(payload);
        onSaved?.();
        return;
      }

      await createProject.mutateAsync({
        name: trimmedName,
        client: builder.trim() || null,
        platform: platform || null,
        builder: builder.trim() || null,
        areaM2: parsedArea === null ? null : Number(parsedArea.toFixed(2)),
        description: description.trim() || null,
        status
      });
      setName("");
      setPlatform("");
      setBuilder("");
      setAreaM2("");
      setDescription("");
      setStatus(ProjectStatus.ACTIVE);
      setPortfolioDraft(readPortfolioDraft(undefined));
      onCreated?.();
    } catch (error) {
      console.error("[projects] Falha ao salvar formulário do projeto", error);
      toast.error(
        resolveMutationErrorMessage(
          error,
          project ? "Não foi possível salvar o projeto" : "Não foi possível criar o projeto"
        )
      );
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

      {project ? (
        <section className="grid gap-4 rounded-md border border-[--color-border] bg-[--bg-1] p-4">
          <div>
            <h3 className="text-sm font-semibold text-[--color-text-primary]">Campos do projeto</h3>
            <p className="mt-1 text-xs text-[--color-text-muted]">Colunas do portfólio deste projeto.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-[13px] font-medium text-[--color-text-secondary] sm:col-span-2">
              Financeiro
              <EditableProjectMultiEnumField
                field={portfolioFieldDraftValue(project, "financeiro", portfolioDraft.financeiro ?? [])}
                variant="detail"
                compactLabels
                onSave={(value) => updatePortfolioDraft("financeiro", value)}
              />
            </label>

            <label className="grid gap-2 text-[13px] font-medium text-[--color-text-secondary] sm:col-span-2">
              Disciplinas
              <EditableProjectMultiEnumField
                field={portfolioFieldDraftValue(project, "disciplinas", portfolioDraft.disciplinas ?? [])}
                variant="detail"
                onSave={(value) => updatePortfolioDraft("disciplinas", value)}
              />
            </label>

            <label className="grid gap-2 text-[13px] font-medium text-[--color-text-secondary]">
              Área projetada
              <span className="flex min-h-8 items-center font-mono text-[12px] text-[--color-text-secondary]">
                {projectedArea == null ? <EmptyField /> : formatProjectArea(projectedArea)}
              </span>
            </label>

            <label className="grid gap-2 text-[13px] font-medium text-[--color-text-secondary]">
              PPCI / GÁS
              <EditableProjectEnumField
                field={portfolioFieldDraftValue(project, "ppciGas", portfolioDraft.ppciGas ?? null)}
                variant="detail"
                onSave={(value) => updatePortfolioDraft("ppciGas", value)}
              />
            </label>

            <label className="grid gap-2 text-[13px] font-medium text-[--color-text-secondary]">
              ELE APROV.
              <EditableProjectEnumField
                field={portfolioFieldDraftValue(project, "eleAprov", portfolioDraft.eleAprov ?? null)}
                variant="detail"
                onSave={(value) => updatePortfolioDraft("eleAprov", value)}
              />
            </label>

            <label className="grid gap-2 text-[13px] font-medium text-[--color-text-secondary]">
              HID APROV.
              <EditableProjectEnumField
                field={portfolioFieldDraftValue(project, "hidAprov", portfolioDraft.hidAprov ?? null)}
                variant="detail"
                onSave={(value) => updatePortfolioDraft("hidAprov", value)}
              />
            </label>

            <label className="grid gap-2 text-[13px] font-medium text-[--color-text-secondary]">
              ELE EXEC.
              <EditableProjectEnumField
                field={portfolioFieldDraftValue(project, "eleExec", portfolioDraft.eleExec ?? null)}
                variant="detail"
                onSave={(value) => updatePortfolioDraft("eleExec", value)}
              />
            </label>

            <label className="grid gap-2 text-[13px] font-medium text-[--color-text-secondary]">
              HID EXEC.
              <EditableProjectEnumField
                field={portfolioFieldDraftValue(project, "hidExec", portfolioDraft.hidExec ?? null)}
                variant="detail"
                onSave={(value) => updatePortfolioDraft("hidExec", value)}
              />
            </label>
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
  return value.replace(/[^\d,.]/g, "");
}

function formatAreaDraft(value: number): string {
  return formatProjectAreaValue(value);
}
