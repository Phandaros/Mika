import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "../generated/prisma/client.js";
import {
  buildMultiEnumStoredValues,
  computeDerivedPortfolioFields,
  disciplineCountFromMultiEnum,
  enrichDerivedPortfolioCustomFieldValues,
  ensurePortfolioCustomFieldSettingsForProjectIfMissing,
  isProjectCountField,
  normalizeProjectFieldName,
  PORTFOLIO_FIELD_LABELS,
  recalculatePortfolioDerivedFields,
  applyProjectCustomFieldValue,
  upsertProjectCustomFieldValue
} from "./projectCustomFields.js";

describe("projectCustomFields", () => {
  it("normalizes portfolio field names without accents and casing", () => {
    expect(normalizeProjectFieldName("PPCI / GÁS")).toBe("ppci / gas");
    expect(normalizeProjectFieldName("Financeiro.")).toBe("financeiro.");
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
    expect(computeDerivedPortfolioFields(50, -1)).toEqual({
      disciplineCount: 0,
      projectedArea: 0
    });
  });

  it("enriches derived portfolio custom field values on read", () => {
    const values = enrichDerivedPortfolioCustomFieldValues(158, [
      {
        customFieldName: PORTFOLIO_FIELD_LABELS.projectCount,
        customField: { mikaLabel: PORTFOLIO_FIELD_LABELS.projectCount, name: PORTFOLIO_FIELD_LABELS.projectCount },
        multiEnumValues: [
          { gid: "1", name: "Elétrico", color: "green" },
          { gid: "2", name: "Telecom", color: "yellow" },
          { gid: "3", name: "Hid", color: "blue" },
          { gid: "4", name: "PPCI", color: "red" },
          { gid: "5", name: "SPDA", color: "orange" },
          { gid: "6", name: "Gás", color: "purple" },
          { gid: "7", name: "Clima", color: "pink" }
        ],
        numberValue: null,
        displayValue: null
      },
      {
        customFieldName: PORTFOLIO_FIELD_LABELS.projectedArea,
        customField: { mikaLabel: PORTFOLIO_FIELD_LABELS.projectedArea, name: PORTFOLIO_FIELD_LABELS.projectedArea },
        multiEnumValues: null,
        numberValue: null,
        displayValue: null
      }
    ]);

    expect(values[1]?.numberValue).toBe(1106);
    expect(values[1]?.displayValue).toBe("1106");
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

  it("detects the project count field by label", () => {
    expect(
      isProjectCountField({
        customFieldName: PORTFOLIO_FIELD_LABELS.projectCount,
        customField: null
      })
    ).toBe(true);
    expect(
      isProjectCountField({
        customFieldName: "Financeiro.",
        customField: null
      })
    ).toBe(false);
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
        customFieldGid: "cf-1",
        customFieldName: "PPCI / GÁS",
        type: "enum",
        displayValue: null,
        textValue: null,
        numberValue: null,
        enumOptionGid: null,
        enumOptionName: null,
        enumOptionColor: null,
        multiEnumValues: null,
        customFieldId: "def-1",
        enumOptionId: null,
        customField: {
          id: "def-1",
          type: "enum",
          enumOptions: [{ id: "opt-1", asanaGid: "gid-aprovado", name: "Aprovado", color: "green", enabled: true, sortOrder: 0 }]
        }
      },
      "Aprovado"
    );

    expect(tx.projectCustomFieldValue.update).toHaveBeenCalledWith({
      where: { id: "value-1" },
      data: expect.objectContaining({
        displayValue: "Aprovado",
        enumOptionName: "Aprovado",
        enumOptionId: "opt-1",
        enumOptionGid: "gid-aprovado",
        enumOptionColor: "green"
      })
    });
  });

  it("applies multi-enum values to an existing project custom field row", async () => {
    const tx = {
      projectCustomFieldValue: {
        update: vi.fn()
      }
    };

    await applyProjectCustomFieldValue(
      tx as unknown as Prisma.TransactionClient,
      {
        id: "value-2",
        projectId: "project-1",
        customFieldGid: "cf-2",
        customFieldName: PORTFOLIO_FIELD_LABELS.projectCount,
        type: "multi_enum",
        displayValue: null,
        textValue: null,
        numberValue: null,
        enumOptionGid: null,
        enumOptionName: null,
        enumOptionColor: null,
        multiEnumValues: null,
        customFieldId: "def-2",
        enumOptionId: null,
        customField: {
          id: "def-2",
          type: "multi_enum",
          enumOptions: [
            { id: "opt-1", asanaGid: "gid-eletrico", name: "Elétrico", color: "green", enabled: true, sortOrder: 0 },
            { id: "opt-2", asanaGid: "gid-telecom", name: "Telecom", color: "yellow", enabled: true, sortOrder: 1 }
          ]
        }
      },
      ["Elétrico", "Telecom"]
    );

    expect(tx.projectCustomFieldValue.update).toHaveBeenCalledWith({
      where: { id: "value-2" },
      data: expect.objectContaining({
        displayValue: "Elétrico, Telecom",
        multiEnumValues: [
          { gid: "gid-eletrico", name: "Elétrico", color: "green" },
          { gid: "gid-telecom", name: "Telecom", color: "yellow" }
        ]
      })
    });
  });

  it("recalculates discipline count and projected area after discipline changes", async () => {
    const disciplineRow = {
      id: "value-disciplines",
      projectId: "project-1",
      customFieldGid: "cf-disciplines",
      customFieldName: PORTFOLIO_FIELD_LABELS.disciplineCount,
      type: "number",
      displayValue: null,
      textValue: null,
      numberValue: null,
      enumOptionGid: null,
      enumOptionName: null,
      enumOptionColor: null,
      multiEnumValues: null,
      customFieldId: "def-disciplines",
      enumOptionId: null,
      customField: null
    };
    const projectedAreaRow = {
      id: "value-area",
      projectId: "project-1",
      customFieldGid: "cf-area",
      customFieldName: PORTFOLIO_FIELD_LABELS.projectedArea,
      type: "number",
      displayValue: null,
      textValue: null,
      numberValue: null,
      enumOptionGid: null,
      enumOptionName: null,
      enumOptionColor: null,
      multiEnumValues: null,
      customFieldId: "def-area",
      enumOptionId: null,
      customField: null
    };

    const tx = {
      project: {
        findUnique: vi.fn().mockResolvedValue({
          areaM2: 100,
          customFieldValues: [
            {
              id: "value-project-count",
              customFieldName: PORTFOLIO_FIELD_LABELS.projectCount,
              customField: { mikaLabel: PORTFOLIO_FIELD_LABELS.projectCount, name: PORTFOLIO_FIELD_LABELS.projectCount },
              multiEnumValues: [
                { gid: "1", name: "Elétrico", color: "green" },
                { gid: "2", name: "Telecom", color: "yellow" },
                { gid: "3", name: "SPDA", color: "orange" }
              ]
            }
          ]
        })
      },
      projectCustomFieldValue: {
        findMany: vi.fn().mockResolvedValue([disciplineRow, projectedAreaRow]),
        create: vi.fn(),
        update: vi.fn()
      },
      projectCustomFieldSetting: {
        findMany: vi.fn().mockResolvedValue([])
      }
    };

    await recalculatePortfolioDerivedFields(tx as unknown as Prisma.TransactionClient, "project-1");

    expect(tx.projectCustomFieldValue.update).toHaveBeenCalledWith({
      where: { id: "value-disciplines" },
      data: expect.objectContaining({
        numberValue: 3,
        displayValue: "3"
      })
    });
    expect(tx.projectCustomFieldValue.update).toHaveBeenCalledWith({
      where: { id: "value-area" },
      data: expect.objectContaining({
        numberValue: 300,
        displayValue: "300"
      })
    });
  });

  it("returns true when upserting the project count field", async () => {
    const row = {
      id: "value-project-count",
      projectId: "project-1",
      customFieldGid: "cf-project-count",
      customFieldName: PORTFOLIO_FIELD_LABELS.projectCount,
      type: "multi_enum",
      displayValue: null,
      textValue: null,
      numberValue: null,
      enumOptionGid: null,
      enumOptionName: null,
      enumOptionColor: null,
      multiEnumValues: null,
      customFieldId: "def-project-count",
      enumOptionId: null,
      customField: {
        id: "def-project-count",
        type: "multi_enum",
        enumOptions: [{ id: "opt-1", asanaGid: "gid-eletrico", name: "Elétrico", color: "green", enabled: true, sortOrder: 0 }]
      }
    };

    const tx = {
      projectCustomFieldValue: {
        findUnique: vi.fn().mockResolvedValue(row),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          ...row,
          multiEnumValues: [{ gid: "gid-eletrico", name: "Elétrico", color: "green" }]
        }),
        update: vi.fn()
      }
    };

    const updatedProjectCount = await upsertProjectCustomFieldValue(
      tx as unknown as Prisma.TransactionClient,
      "project-1",
      { id: "value-project-count", value: ["Elétrico"] }
    );

    expect(updatedProjectCount).toBe(true);
  });

  it("creates portfolio settings when project has none", async () => {
    const portfolioField = {
      id: "field-finance",
      asanaGid: "cf-finance",
      name: "Financeiro.",
      type: "multi_enum",
      mikaTaskField: false,
      enumOptions: [{ id: "opt-1", asanaGid: "gid-1", name: "1 Parcela - Kick", color: null, enabled: true, sortOrder: 0 }]
    };

    const tx = {
      projectCustomFieldSetting: {
        count: vi.fn().mockResolvedValue(0),
        upsert: vi.fn()
      },
      asanaCustomField: {
        findMany: vi.fn().mockResolvedValue([portfolioField])
      }
    };

    const created = await ensurePortfolioCustomFieldSettingsForProjectIfMissing(
      tx as unknown as Prisma.TransactionClient,
      "project-local"
    );

    expect(created).toBe(true);
    expect(tx.projectCustomFieldSetting.upsert).toHaveBeenCalledTimes(1);
  });

  it("skips portfolio settings creation when project already has settings", async () => {
    const tx = {
      projectCustomFieldSetting: {
        count: vi.fn().mockResolvedValue(3)
      },
      asanaCustomField: {
        findMany: vi.fn()
      }
    };

    const created = await ensurePortfolioCustomFieldSettingsForProjectIfMissing(
      tx as unknown as Prisma.TransactionClient,
      "project-existing"
    );

    expect(created).toBe(false);
    expect(tx.asanaCustomField.findMany).not.toHaveBeenCalled();
  });

  it("upserts enum value by custom field definition gid", async () => {
    const customField = {
      id: "field-ele-aprov",
      asanaGid: "cf-ele-aprov",
      name: "ELE APROV.",
      type: "enum",
      mikaTaskField: false,
      enumOptions: [{ id: "opt-aprovado", asanaGid: "gid-aprovado", name: "Aprovado", color: "green", enabled: true, sortOrder: 0 }]
    };

    const row = {
      id: "value-ele-aprov",
      projectId: "project-local",
      customFieldId: customField.id,
      customFieldGid: customField.asanaGid,
      customFieldName: customField.name,
      type: customField.type,
      customField
    };

    const tx = {
      projectCustomFieldValue: {
        findUnique: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(row),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          ...row,
          enumOptionName: "Aprovado",
          displayValue: "Aprovado"
        }),
        upsert: vi.fn().mockResolvedValue(row),
        update: vi.fn()
      },
      projectCustomFieldSetting: {
        findFirst: vi.fn().mockImplementation((args: { where?: { asanaGid?: string; customField?: { asanaGid?: string } } }) => {
          if (args.where?.asanaGid) {
            return Promise.resolve(null);
          }

          if (args.where?.customField?.asanaGid) {
            return Promise.resolve({ customField });
          }

          return Promise.resolve(null);
        }),
        upsert: vi.fn()
      },
      asanaCustomField: {
        findFirst: vi.fn().mockResolvedValue(customField)
      }
    };

    const updatedProjectCount = await upsertProjectCustomFieldValue(
      tx as unknown as Prisma.TransactionClient,
      "project-local",
      { customFieldGid: customField.asanaGid, value: "Aprovado" }
    );

    expect(updatedProjectCount).toBe(false);
    expect(tx.projectCustomFieldSetting.upsert).toHaveBeenCalled();
  });

  it("resolves custom field definition from setting gid fallback on upsert", async () => {
    const customField = {
      id: "field-ppci",
      asanaGid: "cf-ppci",
      name: "PPCI / GÁS",
      type: "enum",
      mikaTaskField: false,
      enumOptions: [{ id: "opt-1", asanaGid: "gid-1", name: "Aprovado", color: null, enabled: true, sortOrder: 0 }]
    };

    const row = {
      id: "value-ppci",
      projectId: "project-local",
      customFieldId: customField.id,
      customFieldGid: customField.asanaGid,
      customFieldName: customField.name,
      type: customField.type,
      customField
    };

    const tx = {
      projectCustomFieldValue: {
        findUnique: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(row),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          ...row,
          enumOptionName: "Aprovado",
          displayValue: "Aprovado"
        }),
        upsert: vi.fn().mockResolvedValue(row),
        update: vi.fn()
      },
      projectCustomFieldSetting: {
        findFirst: vi
          .fn()
          .mockImplementation((args: { where?: { asanaGid?: string; customField?: { asanaGid?: string; mikaKey?: string } } }) => {
            if (args.where?.asanaGid === "local-cfs-ppci") {
              return Promise.resolve({ asanaGid: "local-cfs-ppci", customField });
            }

            if (args.where?.customField?.asanaGid) {
              return Promise.resolve(null);
            }

            return Promise.resolve(null);
          }),
        upsert: vi.fn()
      },
      asanaCustomField: {
        findFirst: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(customField)
      }
    };

    await upsertProjectCustomFieldValue(
      tx as unknown as Prisma.TransactionClient,
      "project-local",
      { customFieldGid: "local-cfs-ppci", value: "Aprovado" }
    );

    expect(tx.projectCustomFieldValue.update).toHaveBeenCalled();
    expect(tx.asanaCustomField.findFirst).not.toHaveBeenCalled();
  });

  it("falls back to customFieldGid when persisted id is stale", async () => {
    const customField = {
      id: "field-finance",
      asanaGid: "cf-finance",
      name: "Financeiro.",
      type: "multi_enum",
      mikaTaskField: false,
      enumOptions: [{ id: "opt-1", asanaGid: "gid-1", name: "1 Parcela - Kick", color: null, enabled: true, sortOrder: 0 }]
    };

    const row = {
      id: "value-finance",
      projectId: "project-local",
      customFieldId: customField.id,
      customFieldGid: customField.asanaGid,
      customFieldName: customField.name,
      type: customField.type,
      customField
    };

    const tx = {
      projectCustomFieldValue: {
        findUnique: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(row),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          ...row,
          displayValue: "1 Parcela - Kick"
        }),
        upsert: vi.fn(),
        update: vi.fn()
      },
      projectCustomFieldSetting: {
        findFirst: vi.fn(),
        upsert: vi.fn()
      },
      asanaCustomField: {
        findFirst: vi.fn()
      }
    };

    await upsertProjectCustomFieldValue(tx as unknown as Prisma.TransactionClient, "project-local", {
      id: "stale-value-id",
      customFieldGid: customField.asanaGid,
      value: ["1 Parcela - Kick"]
    });

    expect(tx.projectCustomFieldValue.update).toHaveBeenCalled();
  });
});
