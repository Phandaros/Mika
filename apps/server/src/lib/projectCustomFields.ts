import { Prisma, type Prisma as PrismaTypes } from "../generated/prisma/client.js";
import { makeLocalAsanaGid } from "./asanaDto.js";
import { AppError } from "../middleware/errorHandler.js";

export type ProjectCustomFieldPatchValue = string | number | string[] | null;

export interface ProjectCustomFieldPatch {
  id?: string;
  customFieldGid?: string;
  mikaKey?: string;
  value: ProjectCustomFieldPatchValue;
}

export const PORTFOLIO_FIELD_LABELS = {
  projectCount: "Número de Projetos",
  disciplineCount: "Número de Disciplinas (n)",
  projectedArea: "Área projetada"
} as const;

const projectCustomFieldValueInclude = {
  customField: {
    include: {
      enumOptions: {
        where: { enabled: true },
        orderBy: [{ sortOrder: "asc" as const }, { name: "asc" as const }]
      }
    }
  }
} satisfies PrismaTypes.ProjectCustomFieldValueInclude;

type ProjectCustomFieldValueRow = PrismaTypes.ProjectCustomFieldValueGetPayload<{ include: typeof projectCustomFieldValueInclude }>;

interface MultiEnumStoredValue {
  gid: string | null;
  name: string;
  color: string | null;
}

export function normalizeProjectFieldName(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function disciplineCountFromMultiEnum(multiEnumValues: unknown): number {
  if (!Array.isArray(multiEnumValues)) {
    return 0;
  }

  return multiEnumValues.filter((entry) => {
    return Boolean(entry && typeof entry === "object" && "name" in entry && typeof entry.name === "string" && entry.name.trim());
  }).length;
}

export function computeDerivedPortfolioFields(
  areaM2: number | null | undefined,
  disciplineCount: number
): { disciplineCount: number; projectedArea: number | null } {
  const count = Math.max(0, disciplineCount);
  const projectedArea = areaM2 == null ? null : areaM2 * count;
  return { disciplineCount: count, projectedArea };
}

export function enrichDerivedPortfolioCustomFieldValues<
  T extends Pick<ProjectCustomFieldValueRow, "customFieldName" | "customField" | "multiEnumValues" | "numberValue" | "displayValue">
>(areaM2: number | null | undefined, values: T[]): T[] {
  const projectCountRow = values.find((row) => isProjectCountField(row));
  const disciplineCount = disciplineCountFromMultiEnum(projectCountRow?.multiEnumValues);
  const derived = computeDerivedPortfolioFields(areaM2, disciplineCount);

  return values.map((row) => {
    if (fieldLabelMatches(row, PORTFOLIO_FIELD_LABELS.disciplineCount)) {
      return {
        ...row,
        numberValue: derived.disciplineCount,
        displayValue: String(derived.disciplineCount)
      };
    }

    if (fieldLabelMatches(row, PORTFOLIO_FIELD_LABELS.projectedArea)) {
      return {
        ...row,
        numberValue: derived.projectedArea,
        displayValue: derived.projectedArea == null ? null : String(derived.projectedArea)
      };
    }

    return row;
  });
}

export function buildMultiEnumStoredValues(
  enumOptions: Array<{ asanaGid: string; name: string; color: string | null }>,
  selectedNames: string[]
): MultiEnumStoredValue[] {
  return selectedNames.map((name) => {
    const match = enumOptions.find((option) => option.name === name || option.asanaGid === name);
    return {
      gid: match?.asanaGid ?? null,
      name: match?.name ?? name,
      color: match?.color ?? null
    };
  });
}

function fieldLabelMatches(row: Pick<ProjectCustomFieldValueRow, "customFieldName" | "customField">, label: string): boolean {
  const target = normalizeProjectFieldName(label);
  const candidates = [row.customFieldName, row.customField?.mikaLabel, row.customField?.name];
  return candidates.some((candidate) => normalizeProjectFieldName(candidate) === target);
}

export function isProjectCountField(row: Pick<ProjectCustomFieldValueRow, "customFieldName" | "customField">): boolean {
  return fieldLabelMatches(row, PORTFOLIO_FIELD_LABELS.projectCount);
}

function numericCustomFieldValue(fieldType: string, value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isNaN(value) ? null : value;
  }

  if (fieldType !== "number" && fieldType !== "integer") {
    return null;
  }

  const parsed = Number(String(value).replace(",", "."));
  return Number.isNaN(parsed) ? null : parsed;
}

function clearProjectCustomFieldData(): PrismaTypes.ProjectCustomFieldValueUpdateInput {
  return {
    displayValue: null,
    textValue: null,
    numberValue: null,
    enumOptionName: null,
    enumOptionId: null,
    enumOptionGid: null,
    enumOptionColor: null,
    multiEnumValues: Prisma.DbNull
  };
}

export async function applyProjectCustomFieldValue(
  tx: PrismaTypes.TransactionClient,
  row: ProjectCustomFieldValueRow,
  value: ProjectCustomFieldPatchValue
): Promise<void> {
  const fieldType = row.customField?.type ?? row.type;
  const enumOptions = row.customField?.enumOptions ?? [];

  if (value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
    await tx.projectCustomFieldValue.update({
      where: { id: row.id },
      data: clearProjectCustomFieldData()
    });
    return;
  }

  if (Array.isArray(value)) {
    const multiValues = buildMultiEnumStoredValues(enumOptions, value);
    await tx.projectCustomFieldValue.update({
      where: { id: row.id },
      data: {
        ...clearProjectCustomFieldData(),
        displayValue: multiValues.map((entry) => entry.name).join(", ") || null,
        multiEnumValues: multiValues
      }
    });
    return;
  }

  if (typeof value === "number") {
    await tx.projectCustomFieldValue.update({
      where: { id: row.id },
      data: {
        ...clearProjectCustomFieldData(),
        numberValue: value,
        displayValue: String(value)
      }
    });
    return;
  }

  const str = String(value).trim();
  const enumMatch = enumOptions.find((option) => option.name === str || option.asanaGid === str);

  if (enumMatch || fieldType === "enum") {
    await tx.projectCustomFieldValue.update({
      where: { id: row.id },
      data: {
        ...clearProjectCustomFieldData(),
        displayValue: enumMatch?.name ?? str,
        enumOptionName: enumMatch?.name ?? null,
        enumOptionId: enumMatch?.id ?? null,
        enumOptionGid: enumMatch?.asanaGid ?? null,
        enumOptionColor: enumMatch?.color ?? null
      }
    });
    return;
  }

  const numberValue = numericCustomFieldValue(fieldType, str);

  await tx.projectCustomFieldValue.update({
    where: { id: row.id },
    data: {
      ...clearProjectCustomFieldData(),
      displayValue: str || null,
      textValue: str || null,
      numberValue
    }
  });
}

async function findProjectCustomFieldRow(
  tx: PrismaTypes.TransactionClient,
  projectId: string,
  patch: Pick<ProjectCustomFieldPatch, "id" | "customFieldGid" | "mikaKey">
): Promise<ProjectCustomFieldValueRow | null> {
  if (patch.id && !patch.id.startsWith("pending:")) {
    const row = await tx.projectCustomFieldValue.findUnique({
      where: { id: patch.id },
      include: projectCustomFieldValueInclude
    });

    if (row && row.projectId === projectId) {
      return row;
    }
  }

  if (patch.customFieldGid) {
    const byDefinitionGid = await tx.projectCustomFieldValue.findUnique({
      where: { projectId_customFieldGid: { projectId, customFieldGid: patch.customFieldGid } },
      include: projectCustomFieldValueInclude
    });

    if (byDefinitionGid) {
      return byDefinitionGid;
    }
  }

  if (patch.mikaKey) {
    const setting = await tx.projectCustomFieldSetting.findFirst({
      where: { projectId, customField: { mikaKey: patch.mikaKey } },
      include: {
        customField: {
          include: projectCustomFieldValueInclude.customField.include
        }
      }
    });

    if (!setting) {
      return null;
    }

    return tx.projectCustomFieldValue.findUnique({
      where: { projectId_customFieldGid: { projectId, customFieldGid: setting.customField.asanaGid } },
      include: projectCustomFieldValueInclude
    });
  }

  if (patch.customFieldGid) {
    const setting = await tx.projectCustomFieldSetting.findFirst({
      where: { projectId, asanaGid: patch.customFieldGid },
      include: {
        customField: {
          include: projectCustomFieldValueInclude.customField.include
        }
      }
    });

    if (!setting) {
      return null;
    }

    return tx.projectCustomFieldValue.findUnique({
      where: { projectId_customFieldGid: { projectId, customFieldGid: setting.customField.asanaGid } },
      include: projectCustomFieldValueInclude
    });
  }

  return null;
}

async function createProjectCustomFieldRow(
  tx: PrismaTypes.TransactionClient,
  projectId: string,
  customField: PrismaTypes.AsanaCustomFieldGetPayload<{ include: typeof projectCustomFieldValueInclude.customField.include }>
): Promise<ProjectCustomFieldValueRow> {
  return tx.projectCustomFieldValue.upsert({
    where: {
      projectId_customFieldGid: {
        projectId,
        customFieldGid: customField.asanaGid
      }
    },
    create: {
      projectId,
      customFieldGid: customField.asanaGid,
      customFieldName: customField.mikaLabel ?? customField.name,
      type: customField.type,
      customFieldId: customField.id
    },
    update: {
      customFieldId: customField.id,
      customFieldName: customField.mikaLabel ?? customField.name,
      type: customField.type
    },
    include: projectCustomFieldValueInclude
  });
}

type PortfolioCustomFieldDefinition = PrismaTypes.AsanaCustomFieldGetPayload<{
  include: typeof projectCustomFieldValueInclude.customField.include;
}>;

async function listPortfolioCustomFieldDefinitions(tx: PrismaTypes.TransactionClient): Promise<PortfolioCustomFieldDefinition[]> {
  return tx.asanaCustomField.findMany({
    where: {
      mikaTaskField: false,
      OR: [{ projectSettings: { some: {} } }, { enumOptions: { some: { enabled: true } } }]
    },
    include: projectCustomFieldValueInclude.customField.include,
    orderBy: [{ mikaSortOrder: "asc" }, { name: "asc" }]
  });
}

async function ensureProjectCustomFieldSetting(
  tx: PrismaTypes.TransactionClient,
  projectId: string,
  customField: PortfolioCustomFieldDefinition
): Promise<void> {
  await tx.projectCustomFieldSetting.upsert({
    where: {
      projectId_customFieldId: {
        projectId,
        customFieldId: customField.id
      }
    },
    create: {
      projectId,
      customFieldId: customField.id,
      asanaGid: makeLocalAsanaGid("cfs"),
      isImportant: false
    },
    update: {}
  });
}

export async function ensurePortfolioCustomFieldSettingsForProject(
  tx: PrismaTypes.TransactionClient,
  projectId: string
): Promise<void> {
  const portfolioFields = await listPortfolioCustomFieldDefinitions(tx);

  for (const customField of portfolioFields) {
    await ensureProjectCustomFieldSetting(tx, projectId, customField);
  }
}

export async function ensurePortfolioCustomFieldSettingsForProjectIfMissing(
  tx: PrismaTypes.TransactionClient,
  projectId: string
): Promise<boolean> {
  const settingsCount = await tx.projectCustomFieldSetting.count({
    where: { projectId }
  });

  if (settingsCount > 0) {
    return false;
  }

  await ensurePortfolioCustomFieldSettingsForProject(tx, projectId);
  return true;
}

async function findPortfolioCustomFieldDefinition(
  tx: PrismaTypes.TransactionClient,
  projectId: string,
  patch: Pick<ProjectCustomFieldPatch, "customFieldGid" | "mikaKey">
): Promise<PortfolioCustomFieldDefinition | null> {
  if (patch.customFieldGid) {
    const byDefinitionGid = await tx.asanaCustomField.findFirst({
      where: { asanaGid: patch.customFieldGid, mikaTaskField: false },
      include: projectCustomFieldValueInclude.customField.include
    });

    if (byDefinitionGid) {
      return byDefinitionGid;
    }

    const setting = await tx.projectCustomFieldSetting.findFirst({
      where: { projectId, asanaGid: patch.customFieldGid },
      include: {
        customField: {
          include: projectCustomFieldValueInclude.customField.include
        }
      }
    });

    return setting?.customField ?? null;
  }

  if (patch.mikaKey) {
    return tx.asanaCustomField.findFirst({
      where: { mikaKey: patch.mikaKey, mikaTaskField: false },
      include: projectCustomFieldValueInclude.customField.include
    });
  }

  return null;
}

async function resolveCustomFieldDefinition(
  tx: PrismaTypes.TransactionClient,
  projectId: string,
  patch: Pick<ProjectCustomFieldPatch, "customFieldGid" | "mikaKey">
) {
  if (patch.customFieldGid) {
    const setting = await tx.projectCustomFieldSetting.findFirst({
      where: { projectId, customField: { asanaGid: patch.customFieldGid } },
      include: {
        customField: {
          include: projectCustomFieldValueInclude.customField.include
        }
      }
    });

    if (setting) {
      return setting.customField;
    }

    return findPortfolioCustomFieldDefinition(tx, projectId, patch);
  }

  if (patch.mikaKey) {
    const setting = await tx.projectCustomFieldSetting.findFirst({
      where: { projectId, customField: { mikaKey: patch.mikaKey } },
      include: {
        customField: {
          include: projectCustomFieldValueInclude.customField.include
        }
      }
    });

    if (setting) {
      return setting.customField;
    }

    return findPortfolioCustomFieldDefinition(tx, projectId, patch);
  }

  return null;
}

export async function upsertProjectCustomFieldValue(
  tx: PrismaTypes.TransactionClient,
  projectId: string,
  patch: ProjectCustomFieldPatch
): Promise<boolean> {
  let row = await findProjectCustomFieldRow(tx, projectId, patch);

  if (!row) {
    const customField = await resolveCustomFieldDefinition(tx, projectId, patch);
    if (!customField) {
      throw new AppError(400, "Campo customizado do projeto não encontrado");
    }

    await ensureProjectCustomFieldSetting(tx, projectId, customField);
    row = await createProjectCustomFieldRow(tx, projectId, customField);
  }

  await applyProjectCustomFieldValue(tx, row, patch.value);

  const updatedRow = await tx.projectCustomFieldValue.findUniqueOrThrow({
    where: { id: row.id },
    include: projectCustomFieldValueInclude
  });

  return isProjectCountField(updatedRow);
}

async function findProjectFieldRowByLabel(
  tx: PrismaTypes.TransactionClient,
  projectId: string,
  label: string
): Promise<ProjectCustomFieldValueRow | null> {
  const rows = await tx.projectCustomFieldValue.findMany({
    where: { projectId },
    include: projectCustomFieldValueInclude
  });

  return rows.find((row) => fieldLabelMatches(row, label)) ?? null;
}

async function ensureProjectFieldRowByLabel(
  tx: PrismaTypes.TransactionClient,
  projectId: string,
  label: string
): Promise<ProjectCustomFieldValueRow | null> {
  const existing = await findProjectFieldRowByLabel(tx, projectId, label);
  if (existing) {
    return existing;
  }

  const settings = await tx.projectCustomFieldSetting.findMany({
    where: { projectId },
    include: {
      customField: {
        include: projectCustomFieldValueInclude.customField.include
      }
    }
  });

  const setting = settings.find((entry) => fieldLabelMatches({ customFieldName: null, customField: entry.customField }, label));
  if (!setting) {
    return null;
  }

  return createProjectCustomFieldRow(tx, projectId, setting.customField);
}

async function upsertCalculatedNumberField(
  tx: PrismaTypes.TransactionClient,
  projectId: string,
  label: string,
  value: number | null
): Promise<void> {
  const row = await ensureProjectFieldRowByLabel(tx, projectId, label);
  if (!row) {
    return;
  }

  await applyProjectCustomFieldValue(tx, row, value);
}

export async function recalculatePortfolioDerivedFields(tx: PrismaTypes.TransactionClient, projectId: string): Promise<void> {
  const project = await tx.project.findUnique({
    where: { id: projectId },
    select: {
      areaM2: true,
      customFieldValues: {
        include: projectCustomFieldValueInclude
      }
    }
  });

  if (!project) {
    return;
  }

  const projectCountRow = project.customFieldValues.find((row) => isProjectCountField(row));
  const disciplineCount = disciplineCountFromMultiEnum(projectCountRow?.multiEnumValues);
  const derived = computeDerivedPortfolioFields(project.areaM2, disciplineCount);

  await upsertCalculatedNumberField(tx, projectId, PORTFOLIO_FIELD_LABELS.disciplineCount, derived.disciplineCount);
  await upsertCalculatedNumberField(tx, projectId, PORTFOLIO_FIELD_LABELS.projectedArea, derived.projectedArea);
}

export async function applyProjectCustomFieldPatches(
  tx: PrismaTypes.TransactionClient,
  projectId: string,
  patches: ProjectCustomFieldPatch[]
): Promise<boolean> {
  let shouldRecalculate = false;

  for (const patch of patches) {
    const updatedProjectCount = await upsertProjectCustomFieldValue(tx, projectId, patch);
    shouldRecalculate = shouldRecalculate || updatedProjectCount;
  }

  return shouldRecalculate;
}
