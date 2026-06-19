import { Prisma, type Prisma as PrismaTypes } from "../generated/prisma/client.js";
import { AppError } from "../middleware/errorHandler.js";
import {
  findPortfolioCatalogField,
  isDisciplinasCatalogField,
  isPortfolioCatalogGid,
  normalizePortfolioFieldName,
  portfolioCatalogGid,
  type PortfolioCatalogField
} from "./portfolioCatalog.js";

export type ProjectCustomFieldPatchValue = string | number | string[] | null;

export interface ProjectCustomFieldPatch {
  id?: string;
  customFieldGid?: string;
  mikaKey?: string;
  value: ProjectCustomFieldPatchValue;
}

export {
  computeDerivedPortfolioFields,
  disciplineCountFromMultiEnum,
  normalizePortfolioFieldName
} from "./portfolioCatalog.js";

export { PORTFOLIO_DERIVED_LABELS as PORTFOLIO_FIELD_LABELS } from "./portfolioCatalog.js";

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

function clearProjectCustomFieldData(): Prisma.ProjectCustomFieldValueUncheckedUpdateInput {
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
  value: ProjectCustomFieldPatchValue,
  catalogField?: PortfolioCatalogField
): Promise<void> {
  const fieldType = catalogField?.type ?? row.customField?.type ?? row.type;
  const persistedEnumOptions = row.customField?.enumOptions ?? [];
  const catalogEnumOptions = catalogField?.enumOptions ?? [];

  if (value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
    await tx.projectCustomFieldValue.update({
      where: { id: row.id },
      data: clearProjectCustomFieldData()
    });
    return;
  }

  if (Array.isArray(value)) {
    const multiEnumOptions =
      catalogField != null
        ? catalogEnumOptions.map((option) => ({
            asanaGid: `catalog:${catalogField.key}:${normalizePortfolioFieldName(option.name)}`,
            name: option.name,
            color: option.color
          }))
        : persistedEnumOptions;
    const multiValues = buildMultiEnumStoredValues(multiEnumOptions, value);
    await tx.projectCustomFieldValue.update({
      where: { id: row.id },
      data: {
        ...clearProjectCustomFieldData(),
        displayValue: multiValues.map((entry) => entry.name).join(", ") || null,
        multiEnumValues: multiValues as unknown as Prisma.InputJsonValue
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
  const persistedEnumMatch = persistedEnumOptions.find(
    (option) => option.name === str || option.asanaGid === str
  );
  const catalogEnumMatch = catalogEnumOptions.find((option) => option.name === str);

  if (persistedEnumMatch || catalogEnumMatch || fieldType === "enum") {
    await tx.projectCustomFieldValue.update({
      where: { id: row.id },
      data: {
        ...clearProjectCustomFieldData(),
        displayValue: persistedEnumMatch?.name ?? catalogEnumMatch?.name ?? str,
        enumOptionName: persistedEnumMatch?.name ?? catalogEnumMatch?.name ?? null,
        enumOptionId: persistedEnumMatch?.id ?? null,
        enumOptionGid: persistedEnumMatch?.asanaGid ?? null,
        enumOptionColor: persistedEnumMatch?.color ?? catalogEnumMatch?.color ?? null
      }
    });
    return;
  }

  await tx.projectCustomFieldValue.update({
    where: { id: row.id },
    data: {
      ...clearProjectCustomFieldData(),
      displayValue: str || null,
      textValue: str || null
    }
  });
}

function resolvePatchCatalogField(patch: Pick<ProjectCustomFieldPatch, "customFieldGid" | "mikaKey">): PortfolioCatalogField | null {
  return findPortfolioCatalogField(patch) ?? null;
}

async function findLinkedCustomFieldId(
  tx: PrismaTypes.TransactionClient,
  catalogField: PortfolioCatalogField
): Promise<string | null> {
  const byKey = await tx.asanaCustomField.findFirst({
    where: { mikaKey: catalogField.key, mikaTaskField: false },
    select: { id: true }
  });

  if (byKey) {
    return byKey.id;
  }

  const byGid = await tx.asanaCustomField.findFirst({
    where: { asanaGid: portfolioCatalogGid(catalogField.key) },
    select: { id: true }
  });

  return byGid?.id ?? null;
}

async function findProjectCustomFieldRow(
  tx: PrismaTypes.TransactionClient,
  projectId: string,
  patch: Pick<ProjectCustomFieldPatch, "id" | "customFieldGid" | "mikaKey">
): Promise<ProjectCustomFieldValueRow | null> {
  const catalogField = resolvePatchCatalogField(patch);
  const canonicalGid = catalogField ? portfolioCatalogGid(catalogField.key) : null;

  if (patch.id && !patch.id.startsWith("pending:")) {
    const row = await tx.projectCustomFieldValue.findUnique({
      where: { id: patch.id },
      include: projectCustomFieldValueInclude
    });

    if (row && row.projectId === projectId) {
      return row;
    }
  }

  if (canonicalGid) {
    const byCanonical = await tx.projectCustomFieldValue.findUnique({
      where: { projectId_customFieldGid: { projectId, customFieldGid: canonicalGid } },
      include: projectCustomFieldValueInclude
    });

    if (byCanonical) {
      return byCanonical;
    }
  }

  if (patch.customFieldGid && !isPortfolioCatalogGid(patch.customFieldGid)) {
    const byLegacyGid = await tx.projectCustomFieldValue.findUnique({
      where: { projectId_customFieldGid: { projectId, customFieldGid: patch.customFieldGid } },
      include: projectCustomFieldValueInclude
    });

    if (byLegacyGid) {
      return byLegacyGid;
    }
  }

  if (catalogField) {
    const rows = await tx.projectCustomFieldValue.findMany({
      where: { projectId },
      include: projectCustomFieldValueInclude
    });

    const normalizedLabel = normalizePortfolioFieldName(catalogField.label);
    const legacyLabels = new Set([
      normalizedLabel,
      ...catalogField.legacyLabels.map((label) => normalizePortfolioFieldName(label))
    ]);

    return (
      rows.find((row) => {
        const candidates = [row.customFieldName, row.customField?.mikaLabel, row.customField?.name];
        return candidates.some((candidate) => legacyLabels.has(normalizePortfolioFieldName(candidate)));
      }) ?? null
    );
  }

  return null;
}

async function createProjectCustomFieldRow(
  tx: PrismaTypes.TransactionClient,
  projectId: string,
  catalogField: PortfolioCatalogField
): Promise<ProjectCustomFieldValueRow> {
  const canonicalGid = portfolioCatalogGid(catalogField.key);
  const customFieldId = await findLinkedCustomFieldId(tx, catalogField);

  return tx.projectCustomFieldValue.upsert({
    where: {
      projectId_customFieldGid: {
        projectId,
        customFieldGid: canonicalGid
      }
    },
    create: {
      projectId,
      customFieldGid: canonicalGid,
      customFieldName: catalogField.label,
      type: catalogField.type,
      customFieldId
    },
    update: {
      customFieldId,
      customFieldName: catalogField.label,
      type: catalogField.type
    },
    include: projectCustomFieldValueInclude
  });
}

export async function upsertProjectCustomFieldValue(
  tx: PrismaTypes.TransactionClient,
  projectId: string,
  patch: ProjectCustomFieldPatch
): Promise<boolean> {
  const catalogField = resolvePatchCatalogField(patch);
  if (!catalogField) {
    throw new AppError(400, "Campo de portfólio não encontrado");
  }

  let row = await findProjectCustomFieldRow(tx, projectId, patch);

  if (!row) {
    row = await createProjectCustomFieldRow(tx, projectId, catalogField);
  } else if (row.customFieldGid !== portfolioCatalogGid(catalogField.key)) {
    const canonicalGid = portfolioCatalogGid(catalogField.key);
    const existingCanonical = await tx.projectCustomFieldValue.findUnique({
      where: { projectId_customFieldGid: { projectId, customFieldGid: canonicalGid } },
      include: projectCustomFieldValueInclude
    });

    if (existingCanonical) {
      row = existingCanonical;
    } else {
      await tx.projectCustomFieldValue.update({
        where: { id: row.id },
        data: {
          customFieldGid: canonicalGid,
          customFieldName: catalogField.label,
          type: catalogField.type
        }
      });
      row = await tx.projectCustomFieldValue.findUniqueOrThrow({
        where: { id: row.id },
        include: projectCustomFieldValueInclude
      });
    }
  }

  await applyProjectCustomFieldValue(tx, row, patch.value, catalogField);

  return isDisciplinasCatalogField(catalogField);
}

export async function applyProjectCustomFieldPatches(
  tx: PrismaTypes.TransactionClient,
  projectId: string,
  patches: ProjectCustomFieldPatch[]
): Promise<void> {
  for (const patch of patches) {
    await upsertProjectCustomFieldValue(tx, projectId, patch);
  }
}
