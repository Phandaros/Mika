import type { Project, ProjectCustomField, ProjectCustomFieldValue, UpdateProjectRequest } from "shared";
import {
  computeDerivedPortfolioFields,
  disciplineCountFromMultiEnum,
  normalizeProjectFieldName,
  PORTFOLIO_FIELD_LABELS
} from "./portfolioFieldLabels";
import { formatProjectAreaValue } from "./projectLabels";

export {
  computeDerivedPortfolioFields,
  disciplineCountFromMultiEnum,
  normalizeProjectFieldName,
  PORTFOLIO_FIELD_LABELS
};

export const portfolioFieldLabels = {
  finance: "Financeiro",
  disciplinas: PORTFOLIO_FIELD_LABELS.disciplinas,
  /** @deprecated use disciplinas */
  projectCount: PORTFOLIO_FIELD_LABELS.disciplinas,
  disciplineCount: PORTFOLIO_FIELD_LABELS.disciplineCount,
  projectedArea: PORTFOLIO_FIELD_LABELS.projectedArea,
  ppciGas: "PPCI / GÁS",
  eleApproval: "ELE APROV.",
  hidApproval: "HID APROV.",
  eleExecution: "ELE EXEC.",
  hidExecution: "HID EXEC."
} as const;

export function isSyntheticProjectCustomFieldId(id: string | undefined): boolean {
  return Boolean(id?.startsWith("pending:"));
}

function projectCustomFieldDefinitionGid(definition: ProjectCustomField): string | undefined {
  return definition.customFieldDefinitionGid?.trim() || undefined;
}

function definitionToSyntheticValue(definition: ProjectCustomField): ProjectCustomFieldValue | null {
  const definitionGid = projectCustomFieldDefinitionGid(definition);
  if (!definitionGid) {
    return null;
  }

  return {
    id: `pending:${definitionGid}`,
    customFieldId: definition.customFieldDefinitionId,
    customFieldGid: definitionGid,
    customFieldName: definition.mikaLabel ?? definition.name,
    mikaKey: definition.mikaKey,
    mikaLabel: definition.mikaLabel ?? definition.name,
    mikaSortOrder: definition.mikaSortOrder,
    type: definition.type,
    displayValue: null,
    textValue: null,
    numberValue: null,
    enumOptionName: null,
    enumOptionColor: null,
    enumOptions: (definition.enumOptions ?? []).map((option) => ({
      id: option.id,
      name: option.name,
      color: option.color
    }))
  };
}

function findProjectCustomFieldDefinition(project: Project, name: string): ProjectCustomField | undefined {
  const target = normalizeProjectFieldName(name);
  return project.customFields?.find(
    (field) =>
      field.mikaKey === name ||
      normalizeProjectFieldName(field.mikaLabel ?? field.name) === target
  );
}

function findRawProjectCustomField(project: Project, nameOrKey: string): ProjectCustomFieldValue | undefined {
  const target = normalizeProjectFieldName(nameOrKey);
  const existing = project.customFieldValues?.find(
    (field) =>
      field.mikaKey === nameOrKey ||
      normalizeProjectFieldName(field.customFieldName ?? field.mikaLabel) === target
  );

  if (existing) {
    return existing;
  }

  const definition = findProjectCustomFieldDefinition(project, nameOrKey);
  return definition ? definitionToSyntheticValue(definition) ?? undefined : undefined;
}

function isDerivedPortfolioFieldName(name: string): boolean {
  const normalized = normalizeProjectFieldName(name);
  return (
    normalized === normalizeProjectFieldName(portfolioFieldLabels.disciplineCount) ||
    normalized === normalizeProjectFieldName(portfolioFieldLabels.projectedArea)
  );
}

function applyDerivedPortfolioFieldValue(
  project: Project,
  field: ProjectCustomFieldValue,
  name: string
): ProjectCustomFieldValue {
  const projectCountField = findRawProjectCustomField(project, portfolioFieldLabels.disciplinas);
  const disciplineCount = disciplineCountFromMultiEnum(projectCountField?.multiEnumValues);
  const derived = computeDerivedPortfolioFields(project.areaM2, disciplineCount);
  const normalized = normalizeProjectFieldName(name);

  if (normalized === normalizeProjectFieldName(portfolioFieldLabels.disciplineCount)) {
    return {
      ...field,
      numberValue: derived.disciplineCount,
      displayValue: String(derived.disciplineCount)
    };
  }

  return {
    ...field,
    numberValue: derived.projectedArea,
    displayValue: derived.projectedArea == null ? null : String(derived.projectedArea)
  };
}

export function projectCustomField(project: Project, name: string): ProjectCustomFieldValue | undefined {
  const field = findRawProjectCustomField(project, name);
  if (!field) {
    return undefined;
  }

  if (isDerivedPortfolioFieldName(name)) {
    return applyDerivedPortfolioFieldValue(project, field, name);
  }

  return field;
}

export function fieldMultiValues(field: ProjectCustomFieldValue | undefined): Array<{ name: string; color: string | null }> {
  if (field?.multiEnumValues?.length) {
    return field.multiEnumValues;
  }

  return (field?.displayValue ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((name) => ({ name, color: null }));
}

export function compactFinanceLabel(value: string): string {
  return value
    .replace("Parcela - ", "P - ")
    .replace("Estudo Preliminar + ART", "Estudo + ART")
    .replace("Projeto Executivo", "Executivo")
    .replace("Liberado Obra", "Obra");
}

export function formatPortfolioNumber(value: number): string {
  return formatProjectAreaValue(value);
}

type ProjectCustomFieldPatchValue = string | number | string[] | null;

function applyCustomFieldPatchValue(field: ProjectCustomFieldValue, value: ProjectCustomFieldPatchValue): ProjectCustomFieldValue {
  if (value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
    return {
      ...field,
      displayValue: null,
      textValue: null,
      numberValue: null,
      enumOptionName: null,
      enumOptionColor: null,
      multiEnumValues: undefined
    };
  }

  if (Array.isArray(value)) {
    const enumOptions = field.enumOptions ?? [];
    const multiEnumValues = value.map((name) => {
      const match = enumOptions.find((option) => option.name === name);
      return { gid: null, name, color: match?.color ?? null };
    });

    return {
      ...field,
      displayValue: multiEnumValues.map((entry) => entry.name).join(", "),
      multiEnumValues,
      enumOptionName: null,
      enumOptionColor: null,
      numberValue: null
    };
  }

  if (typeof value === "number") {
    return {
      ...field,
      numberValue: value,
      displayValue: String(value),
      enumOptionName: null,
      enumOptionColor: null,
      multiEnumValues: undefined
    };
  }

  const enumMatch = field.enumOptions?.find((option) => option.name === value);
  return {
    ...field,
    displayValue: value,
    enumOptionName: enumMatch?.name ?? value,
    enumOptionColor: enumMatch?.color ?? null,
    numberValue: null,
    multiEnumValues: undefined
  };
}

function recalculateDerivedCustomFields(project: Project): ProjectCustomFieldValue[] {
  const projectCountField = findRawProjectCustomField(project, portfolioFieldLabels.disciplinas);
  const disciplineCount = disciplineCountFromMultiEnum(projectCountField?.multiEnumValues);
  const derived = computeDerivedPortfolioFields(project.areaM2, disciplineCount);
  const values = [...(project.customFieldValues ?? [])];
  const derivedFields = [
    {
      label: portfolioFieldLabels.disciplineCount,
      numberValue: derived.disciplineCount,
      displayValue: String(derived.disciplineCount)
    },
    {
      label: portfolioFieldLabels.projectedArea,
      numberValue: derived.projectedArea,
      displayValue: derived.projectedArea == null ? null : String(derived.projectedArea)
    }
  ] as const;

  for (const derivedField of derivedFields) {
    const target = normalizeProjectFieldName(derivedField.label);
    const index = values.findIndex(
      (field) => normalizeProjectFieldName(field.customFieldName ?? field.mikaLabel) === target
    );

    if (index !== -1) {
      const currentField = values[index];
      if (currentField) {
        values[index] = {
          ...currentField,
          numberValue: derivedField.numberValue,
          displayValue: derivedField.displayValue
        };
      }
      continue;
    }

    const synthetic = findRawProjectCustomField(project, derivedField.label);
    if (synthetic) {
      values.push({
        ...synthetic,
        numberValue: derivedField.numberValue,
        displayValue: derivedField.displayValue
      });
    }
  }

  return values;
}

export function buildProjectCustomFieldPatch(
  project: Project,
  field: ProjectCustomFieldValue,
  value: string | number | string[] | null
): NonNullable<UpdateProjectRequest["customFieldValues"]>[number] {
  const definition = project.customFields?.find((candidate) => {
    if (field.customFieldGid) {
      return (
        candidate.customFieldDefinitionGid === field.customFieldGid ||
        candidate.asanaGid === field.customFieldGid
      );
    }

    if (field.mikaKey) {
      return candidate.mikaKey === field.mikaKey;
    }

    const fieldLabel = normalizeProjectFieldName(field.customFieldName ?? field.mikaLabel);
    return normalizeProjectFieldName(candidate.mikaLabel ?? candidate.name) === fieldLabel;
  });

  const definitionGid =
    definition?.customFieldDefinitionGid?.trim() ||
    (field.customFieldGid?.startsWith("local:cfs:") ? undefined : field.customFieldGid?.trim()) ||
    undefined;
  const mikaKey = field.mikaKey ?? definition?.mikaKey ?? undefined;
  const persistedId = field.id && !isSyntheticProjectCustomFieldId(field.id) ? field.id : undefined;

  return {
    ...(persistedId ? { id: persistedId } : {}),
    ...(definitionGid ? { customFieldGid: definitionGid } : {}),
    ...(mikaKey ? { mikaKey } : {}),
    value
  };
}

export function isProjectCustomFieldPatchValid(
  patch: NonNullable<UpdateProjectRequest["customFieldValues"]>[number]
): boolean {
  return Boolean(patch.id?.trim() || patch.customFieldGid?.trim() || patch.mikaKey?.trim());
}

function dedupeProjectCustomFieldValues(values: ProjectCustomFieldValue[]): ProjectCustomFieldValue[] {
  const merged = new Map<string, ProjectCustomFieldValue>();

  for (const field of values) {
    const key =
      (field.customFieldGid ? `gid:${field.customFieldGid}` : null) ??
      (field.mikaKey ? `mika:${field.mikaKey}` : null) ??
      (field.customFieldName ?? field.mikaLabel
        ? `label:${normalizeProjectFieldName(field.customFieldName ?? field.mikaLabel)}`
        : null) ??
      (field.id && !isSyntheticProjectCustomFieldId(field.id) ? `id:${field.id}` : field.id);

    if (!key) {
      continue;
    }

    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, field);
      continue;
    }

    const preferIncoming =
      !isSyntheticProjectCustomFieldId(field.id) && isSyntheticProjectCustomFieldId(existing.id);
    merged.set(key, preferIncoming ? field : existing);
  }

  return Array.from(merged.values());
}

function findCustomFieldValueIndex(
  project: Project,
  customFieldValues: ProjectCustomFieldValue[],
  patch: NonNullable<UpdateProjectRequest["customFieldValues"]>[number]
): number {
  const matchers: Array<(field: ProjectCustomFieldValue) => boolean> = [];

  if (patch.id && !isSyntheticProjectCustomFieldId(patch.id)) {
    matchers.push((field) => field.id === patch.id);
  }

  if (patch.customFieldGid) {
    matchers.push(
      (field) =>
        field.customFieldGid === patch.customFieldGid ||
        project.customFields?.some(
          (definition) =>
            definition.asanaGid === patch.customFieldGid &&
            (field.customFieldGid === definition.customFieldDefinitionGid || field.mikaKey === definition.mikaKey)
        ) === true
    );
  }

  if (patch.mikaKey) {
    matchers.push((field) => field.mikaKey === patch.mikaKey);
  }

  if (patch.id) {
    matchers.push((field) => field.id === patch.id);
  }

  for (const matches of matchers) {
    const index = customFieldValues.findIndex(matches);
    if (index !== -1) {
      return index;
    }
  }

  return -1;
}

export function applyProjectCustomFieldPatchesLocally(
  project: Project,
  patches: NonNullable<UpdateProjectRequest["customFieldValues"]>
): Project {
  let nextProject: Project = { ...project };

  if (patches.length === 0) {
    return nextProject;
  }

  const customFieldValues = [...(project.customFieldValues ?? [])];
  let shouldRecalculate = false;

  for (const patch of patches) {
    let index = findCustomFieldValueIndex(project, customFieldValues, patch);

    if (index === -1 && (patch.customFieldGid || patch.mikaKey)) {
      const definition = project.customFields?.find((field) => {
        if (patch.customFieldGid) {
          return (
            field.customFieldDefinitionGid === patch.customFieldGid ||
            field.asanaGid === patch.customFieldGid
          );
        }

        return field.mikaKey === patch.mikaKey;
      });

      if (definition) {
        const synthetic = definitionToSyntheticValue(definition);
        if (!synthetic) {
          continue;
        }

        customFieldValues.push(synthetic);
        index = customFieldValues.length - 1;
      }
    }

    if (index === -1) {
      continue;
    }

    const currentField = customFieldValues[index];
    if (!currentField) {
      continue;
    }

    customFieldValues[index] = applyCustomFieldPatchValue(currentField, patch.value);

    if (normalizeProjectFieldName(currentField.customFieldName ?? currentField.mikaLabel ?? currentField.mikaKey) === normalizeProjectFieldName(portfolioFieldLabels.disciplinas)) {
      shouldRecalculate = true;
    }
  }

  nextProject = { ...nextProject, customFieldValues: dedupeProjectCustomFieldValues(customFieldValues) };

  if (shouldRecalculate) {
    nextProject = { ...nextProject, customFieldValues: recalculateDerivedCustomFields(nextProject) };
  }

  return nextProject;
}

export function applyDerivedPortfolioFieldsLocally(project: Project): Project {
  return {
    ...project,
    customFieldValues: recalculateDerivedCustomFields(project)
  };
}
