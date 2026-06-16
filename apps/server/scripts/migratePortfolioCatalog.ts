import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma.js";
import {
  isDerivedPortfolioLabel,
  normalizePortfolioFieldName,
  PORTFOLIO_CATALOG,
  portfolioCatalogGid
} from "../src/lib/portfolioCatalog.js";

function newId(): string {
  return randomUUID().replace(/-/g, "").slice(0, 25);
}

function rowHasValue(row: {
  displayValue: string | null;
  textValue: string | null;
  numberValue: number | null;
  enumOptionName: string | null;
  multiEnumValues: unknown;
}): boolean {
  if (row.displayValue || row.textValue || row.enumOptionName || row.numberValue != null) {
    return true;
  }

  return Array.isArray(row.multiEnumValues) && row.multiEnumValues.length > 0;
}

async function normalizeCatalogDefinitions(): Promise<void> {
  for (const field of PORTFOLIO_CATALOG) {
    const canonicalGid = portfolioCatalogGid(field.key);
    const labelsToMatch = [field.label, ...field.legacyLabels];
    const keysToMatch = [field.key, ...field.legacyMikaKeys];

    const definitions = await prisma.asanaCustomField.findMany({
      where: {
        mikaTaskField: false,
        OR: [
          { mikaKey: { in: keysToMatch } },
          { name: { in: labelsToMatch } },
          { mikaLabel: { in: labelsToMatch } }
        ]
      }
    });

    let primary = definitions.find((definition) => definition.asanaGid === canonicalGid) ?? definitions[0];

    if (!primary) {
      primary = await prisma.asanaCustomField.create({
        data: {
          asanaGid: canonicalGid,
          name: field.label,
          type: field.type,
          mikaKey: field.key,
          mikaLabel: field.label,
          mikaTaskField: false,
          mikaSortOrder: field.sortOrder,
          mikaListVisible: true,
          mikaDetailVisible: true
        }
      });
    } else {
      primary = await prisma.asanaCustomField.update({
        where: { id: primary.id },
        data: {
          asanaGid: canonicalGid,
          name: field.label,
          type: field.type,
          mikaKey: field.key,
          mikaLabel: field.label,
          mikaSortOrder: field.sortOrder,
          mikaTaskField: false,
          mikaListVisible: true,
          mikaDetailVisible: true
        }
      });
    }

    for (const definition of definitions) {
      if (definition.id === primary.id) {
        continue;
      }

      await prisma.projectCustomFieldValue.updateMany({
        where: { customFieldId: definition.id },
        data: { customFieldId: primary.id }
      });

      await prisma.asanaCustomField.delete({ where: { id: definition.id } });
    }

    for (const [index, option] of field.enumOptions.entries()) {
      const optionGid = `catalog:${field.key}:${index}`;
      await prisma.asanaCustomFieldEnumOption.upsert({
        where: { asanaGid: optionGid },
        create: {
          asanaGid: optionGid,
          customFieldId: primary.id,
          name: option.name,
          color: option.color,
          enabled: true,
          sortOrder: index
        },
        update: {
          customFieldId: primary.id,
          name: option.name,
          color: option.color,
          enabled: true,
          sortOrder: index
        }
      });
    }
  }
}

async function deleteDerivedAndVestigialValues(): Promise<void> {
  const rows = await prisma.projectCustomFieldValue.findMany({
    select: {
      id: true,
      customFieldName: true,
      customField: { select: { name: true, mikaLabel: true, mikaKey: true } }
    }
  });

  const portfolioKeys = new Set(PORTFOLIO_CATALOG.map((field) => field.key));
  const portfolioLabels = new Set(
    PORTFOLIO_CATALOG.flatMap((field) => [field.label, ...field.legacyLabels]).map((label) =>
      normalizePortfolioFieldName(label)
    )
  );

  const idsToDelete: string[] = [];

  for (const row of rows) {
    const labels = [row.customFieldName, row.customField?.mikaLabel, row.customField?.name];
    const normalizedLabels = labels.map((label) => normalizePortfolioFieldName(label));

    if (normalizedLabels.some((label) => isDerivedPortfolioLabel(label))) {
      idsToDelete.push(row.id);
      continue;
    }

    const mikaKey = row.customField?.mikaKey;
    if (mikaKey && portfolioKeys.has(mikaKey)) {
      continue;
    }

    if (normalizedLabels.some((label) => portfolioLabels.has(label))) {
      continue;
    }

    if (row.customFieldGid?.startsWith("mika:portfolio:")) {
      continue;
    }

    idsToDelete.push(row.id);
  }

  if (idsToDelete.length) {
    await prisma.projectCustomFieldValue.deleteMany({ where: { id: { in: idsToDelete } } });
  }
}

async function canonicalizeProjectValues(): Promise<void> {
  const projects = await prisma.project.findMany({ select: { id: true } });

  for (const project of projects) {
    const values = await prisma.projectCustomFieldValue.findMany({ where: { projectId: project.id } });

    for (const field of PORTFOLIO_CATALOG) {
      const canonicalGid = portfolioCatalogGid(field.key);
      const legacyLabels = new Set([
        normalizePortfolioFieldName(field.label),
        ...field.legacyLabels.map((label) => normalizePortfolioFieldName(label))
      ]);

      const matches = values.filter((row) => {
        if (row.customFieldGid === canonicalGid) {
          return true;
        }

        const candidates = [row.customFieldName];
        return candidates.some((candidate) => legacyLabels.has(normalizePortfolioFieldName(candidate)));
      });

      if (matches.length === 0) {
        continue;
      }

      const preferred =
        matches.find((row) => row.customFieldGid === canonicalGid && rowHasValue(row)) ??
        matches.find((row) => row.customFieldGid === canonicalGid) ??
        matches.find((row) => rowHasValue(row)) ??
        matches[0];

      if (!preferred) {
        continue;
      }

      await prisma.projectCustomFieldValue.update({
        where: { id: preferred.id },
        data: {
          customFieldGid: canonicalGid,
          customFieldName: field.label,
          type: field.type
        }
      });

      const duplicates = matches.filter((row) => row.id !== preferred.id);
      for (const duplicate of duplicates) {
        if (!rowHasValue(preferred) && rowHasValue(duplicate)) {
          await prisma.projectCustomFieldValue.update({
            where: { id: preferred.id },
            data: {
              displayValue: duplicate.displayValue,
              textValue: duplicate.textValue,
              numberValue: duplicate.numberValue,
              enumOptionName: duplicate.enumOptionName,
              enumOptionGid: duplicate.enumOptionGid,
              enumOptionColor: duplicate.enumOptionColor,
              enumOptionId: duplicate.enumOptionId,
              multiEnumValues: duplicate.multiEnumValues ?? undefined
            }
          });
        }

        await prisma.projectCustomFieldValue.delete({ where: { id: duplicate.id } });
      }
    }
  }
}

async function ensureEmptyPortfolioValueRows(): Promise<void> {
  const projects = await prisma.project.findMany({ select: { id: true } });

  for (const project of projects) {
    for (const field of PORTFOLIO_CATALOG) {
      const canonicalGid = portfolioCatalogGid(field.key);
      const existing = await prisma.projectCustomFieldValue.findUnique({
        where: {
          projectId_customFieldGid: {
            projectId: project.id,
            customFieldGid: canonicalGid
          }
        }
      });

      if (existing) {
        continue;
      }

      const definition = await prisma.asanaCustomField.findFirst({
        where: { mikaKey: field.key, mikaTaskField: false },
        select: { id: true }
      });

      await prisma.projectCustomFieldValue.create({
        data: {
          id: newId(),
          projectId: project.id,
          customFieldGid: canonicalGid,
          customFieldName: field.label,
          type: field.type,
          customFieldId: definition?.id ?? null
        }
      });
    }
  }
}

async function main(): Promise<void> {
  console.log("[migratePortfolioCatalog] Normalizando definições...");
  await normalizeCatalogDefinitions();

  console.log("[migratePortfolioCatalog] Removendo valores derivados e vestigiais...");
  await deleteDerivedAndVestigialValues();

  console.log("[migratePortfolioCatalog] Canonicalizando valores por projeto...");
  await canonicalizeProjectValues();

  console.log("[migratePortfolioCatalog] Garantindo linhas vazias por campo...");
  await ensureEmptyPortfolioValueRows();

  console.log("[migratePortfolioCatalog] Concluído.");
}

main()
  .catch((error) => {
    console.error("[migratePortfolioCatalog] Falha:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
