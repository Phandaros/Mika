import type { RequestHandler } from "express";
import { z } from "zod";
import {
  buildIndicators,
  normalizeIndicatorDate,
  normalizeIndicatorPeriod,
  normalizeIndicatorPortfolioYear,
  normalizeIndicatorScope
} from "../lib/indicators.js";
import { AppError } from "../middleware/errorHandler.js";

const dateOnlySchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => Boolean(normalizeIndicatorDate(value)), "Data inválida");
const indicatorsQuerySchema = z.object({
  period: z.enum(["month", "year", "custom", "all"]).optional(),
  scope: z.enum(["general", "civil", "electrical"]).optional(),
  portfolioYear: z.union([z.literal("all"), z.string().regex(/^\d{4}$/)]).optional(),
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional()
}).superRefine((query, context) => {
  if (query.period === "custom" && (!query.from || !query.to)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "O período personalizado exige data inicial e final",
      path: [!query.from ? "from" : "to"]
    });
  }

  if (query.from && query.to && query.from > query.to) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "A data inicial não pode ser posterior à data final",
      path: ["from"]
    });
  }
});

export const getIndicators: RequestHandler = async (req, res, next) => {
  try {
    const parsed = indicatorsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError(400, "Filtros de indicadores inválidos", parsed.error.flatten());
    }

    const period = normalizeIndicatorPeriod(parsed.data.period);
    const scope = normalizeIndicatorScope(parsed.data.scope);
    const portfolioYear = normalizeIndicatorPortfolioYear(parsed.data.portfolioYear);
    const indicators = await buildIndicators(period, scope, portfolioYear, parsed.data.from, parsed.data.to);

    res.json(indicators);
  } catch (error) {
    next(error);
  }
};
