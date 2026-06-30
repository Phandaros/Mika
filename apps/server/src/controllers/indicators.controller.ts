import type { RequestHandler } from "express";
import {
  buildIndicators,
  normalizeIndicatorPeriod,
  normalizeIndicatorPortfolioYear,
  normalizeIndicatorScope
} from "../lib/indicators.js";

export const getIndicators: RequestHandler = async (req, res, next) => {
  try {
    const period = normalizeIndicatorPeriod(req.query.period);
    const scope = normalizeIndicatorScope(req.query.scope);
    const portfolioYear = normalizeIndicatorPortfolioYear(req.query.portfolioYear);
    const indicators = await buildIndicators(period, scope, portfolioYear);

    res.json(indicators);
  } catch (error) {
    next(error);
  }
};
