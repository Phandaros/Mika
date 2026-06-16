import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "../generated/prisma/client.js";
import {
  buildMultiEnumStoredValues,
  computeDerivedPortfolioFields,
  disciplineCountFromMultiEnum,
  applyProjectCustomFieldValue,
  upsertProjectCustomFieldValue
} from "./projectCustomFields.js";
import {
  normalizePortfolioFieldName,
  PORTFOLIO_DERIVED_LABELS,
  portfolioCatalogGid
} from "./portfolioCatalog.js";
import { projectCustomFieldValueDtos, toPortfolioCatalogFieldDtos } from "./asanaDto.js";

describe("portfolioCatalog", () => {
  it("normalizes portfolio field names without accents and casing", () => {
    expect(normalizePortfolioFieldName("PPCI / GÁS")).toBe("ppci / gas");
    expect(normalizePortfolioFieldName("Financeiro")).toBe("financeiro");
  });

  it("counts disciplines from stored multi-enum values", () => {
    expect(
      disciplineCountFromMultiEnum([
        { gid: "1", name: "Elétrico", color: "green" },
        { gid: "2", name: "Telecom", color: "yellow" }
      ])
    ).toBe(2);
    expect(disciplineCountFromMultiEnum(null)).toBe(0);
  });

  it("computes derived portfolio fields from area and discipline count", () => {
    expect(computeDerivedPortfolioFields(100, 3)).toEqual({
      disciplineCount: 3,
      projectedArea: 300
    });
    expect(computeDerivedPortfolioFields(null, 4)).toEqual({
      disciplineCount: 4,
      projectedArea: null
    });
  });

  it("exports the global portfolio catalog definitions", () => {
    const fields = toPortfolioCatalogFieldDtos();
    expect(fields).toHaveLength(7);
    expect(fields.find((field) => field.mikaKey === "disciplinas")?.name).toBe("Disciplinas");
  });

  it("computes projected area for projects without persisted derived rows", () => {
    const values = projectCustomFieldValueDtos({
      areaM2: 100,
      customFieldValues: [
        {
          id: "value-disciplinas",
          projectId: "project-local",
          customFieldGid: portfolioCatalogGid("disciplinas"),
          customFieldName: "Disciplinas",
          type: "multi_enum",
          displayValue: "Elétrico, Telecom, SPDA",
          textValue: null,
          numberValue: null,
          precision: null,
          enumOptionGid: null,
          enumOptionName: null,
          enumOptionColor: null,
          multiEnumValues: [
            { gid: "1", name: "Elétrico", color: null },
            { gid: "2", name: "Telecom", color: null },
            { gid: "3", name: "SPDA", color: null }
          ],
          customFieldId: "def-disciplinas",
          enumOptionId: null,
          customField: null,
          enumOption: null
        }
      ]
    });

    const projectedArea = values.find((field) => field.mikaKey === "projectedArea");
    expect(projectedArea?.numberValue).toBe(300);
    expect(projectedArea?.displayValue).toBe("300");
    expect(values.find((field) => field.mikaKey === "disciplineCount")?.numberValue).toBe(3);
  });

  it("builds multi-enum stored values from enum options", () => {
    const stored = buildMultiEnumStoredValues(
      [
        { asanaGid: "gid-1", name: "Elétrico", color: "green" },
        { asanaGid: "gid-2", name: "Telecom", color: "yellow" }
      ],
      ["Elétrico", "Telecom"]
    );

    expect(stored).toEqual([
      { gid: "gid-1", name: "Elétrico", color: "green" },
      { gid: "gid-2", name: "Telecom", color: "yellow" }
    ]);
  });

  it("applies enum values to an existing project custom field row", async () => {
    const tx = {
      projectCustomFieldValue: {
        update: vi.fn()
      }
    };

    await applyProjectCustomFieldValue(
      tx as unknown as Prisma.TransactionClient,
      {
        id: "value-1",
        projectId: "project-1",
        customFieldGid: portfolioCatalogGid("ppciGas"),
        customFieldName: "PPCI / GÁS",
        type: "enum",
        displayValue: null,
        textValue: null,
        numberValue: null,
        precision: null,
        enumOptionGid: null,
        enumOptionName: null,
        enumOptionColor: null,
        multiEnumValues: null,
        customFieldId: "def-1",
        enumOptionId: null,
        customField: null
      },
      "Aprovado",
      {
        key: "ppciGas",
        label: "PPCI / GÁS",
        type: "enum",
        sortOrder: 2,
        legacyLabels: [],
        legacyMikaKeys: [],
        enumOptions: [{ name: "Aprovado", color: "green" }]
      }
    );

    expect(tx.projectCustomFieldValue.update).toHaveBeenCalledWith({
      where: { id: "value-1" },
      data: expect.objectContaining({
        displayValue: "Aprovado",
        enumOptionName: "Aprovado"
      })
    });
  });

  it("upserts disciplinas by catalog mikaKey", async () => {
    const row = {
      id: "value-disciplinas",
      projectId: "project-local",
      customFieldGid: portfolioCatalogGid("disciplinas"),
      customFieldName: "Disciplinas",
      type: "multi_enum",
      displayValue: null,
      textValue: null,
      numberValue: null,
      enumOptionGid: null,
      enumOptionName: null,
      enumOptionColor: null,
      multiEnumValues: null,
      customFieldId: "def-disciplinas",
      enumOptionId: null,
      customField: null
    };

    const tx = {
      projectCustomFieldValue: {
        findUnique: vi.fn().mockResolvedValue(row),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          ...row,
          multiEnumValues: [{ gid: "gid-eletrico", name: "Elétrico", color: null }]
        }),
        findMany: vi.fn(),
        upsert: vi.fn(),
        update: vi.fn()
      },
      asanaCustomField: {
        findFirst: vi.fn().mockResolvedValue({ id: "def-disciplinas" })
      }
    };

    await upsertProjectCustomFieldValue(tx as unknown as Prisma.TransactionClient, "project-local", {
      mikaKey: "disciplinas",
      value: ["Elétrico"]
    });

    expect(tx.projectCustomFieldValue.update).toHaveBeenCalled();
  });

  it("creates a portfolio value row when missing", async () => {
    const createdRow = {
      id: "value-new",
      projectId: "project-local",
      customFieldGid: portfolioCatalogGid("eleAprov"),
      customFieldName: "ELE APROV.",
      type: "enum",
      displayValue: null,
      textValue: null,
      numberValue: null,
      enumOptionGid: null,
      enumOptionName: null,
      enumOptionColor: null,
      multiEnumValues: null,
      customFieldId: "def-ele-aprov",
      enumOptionId: null,
      customField: null
    };

    const tx = {
      projectCustomFieldValue: {
        findUnique: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(createdRow),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          ...createdRow,
          enumOptionName: "Aprovado",
          displayValue: "Aprovado"
        }),
        findMany: vi.fn().mockResolvedValue([]),
        upsert: vi.fn().mockResolvedValue(createdRow),
        update: vi.fn()
      },
      asanaCustomField: {
        findFirst: vi.fn().mockResolvedValue({ id: "def-ele-aprov" })
      }
    };

    await upsertProjectCustomFieldValue(tx as unknown as Prisma.TransactionClient, "project-local", {
      mikaKey: "eleAprov",
      value: "Aprovado"
    });

    expect(tx.projectCustomFieldValue.upsert).toHaveBeenCalled();
    expect(tx.projectCustomFieldValue.update).toHaveBeenCalled();
  });

  it("does not treat derived labels as writable catalog fields", () => {
    expect(PORTFOLIO_DERIVED_LABELS.projectedArea).toBe("Área projetada");
  });
});
