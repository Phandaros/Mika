import type { RequestHandler } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getAuthUser } from "../middleware/auth.js";
import { AppError } from "../middleware/errorHandler.js";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const holidayQuerySchema = z.object({
  from: dateSchema,
  to: dateSchema
});

type CompanyHolidayRecord = {
  id: string;
  date: string;
  name: string;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toCompanyHolidayDto(holiday: CompanyHolidayRecord) {
  return {
    id: holiday.id,
    date: holiday.date,
    name: holiday.name,
    createdBy: holiday.createdBy,
    createdAt: holiday.createdAt.toISOString(),
    updatedAt: holiday.updatedAt.toISOString()
  };
}

export const listCompanyHolidays: RequestHandler = async (req, res, next) => {
  try {
    const parsed = holidayQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      throw new AppError(400, "Parametros from e to sao obrigatorios (YYYY-MM-DD)");
    }

    let { from, to } = parsed.data;
    if (from > to) {
      const swap = from;
      from = to;
      to = swap;
    }

    const holidays = await prisma.companyHoliday.findMany({
      where: {
        date: {
          gte: from,
          lte: to
        }
      },
      orderBy: { date: "asc" }
    });

    res.json({ holidays: holidays.map(toCompanyHolidayDto) });
  } catch (error) {
    next(error);
  }
};

export const createCompanyHoliday: RequestHandler = async (req, res, next) => {
  try {
    const user = getAuthUser(req);
    const body = req.body as { date: string; name: string };

    const holiday = await prisma.companyHoliday.create({
      data: {
        date: body.date,
        name: body.name,
        createdBy: user.id
      }
    });

    res.status(201).json({ holiday: toCompanyHolidayDto(holiday) });
  } catch (error) {
    next(error);
  }
};

export const updateCompanyHoliday: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as { date?: string; name?: string };

    if (body.date === undefined && body.name === undefined) {
      throw new AppError(400, "Informe ao menos um campo para atualizar");
    }

    const holiday = await prisma.companyHoliday.update({
      where: { id: req.params.id },
      data: {
        date: body.date,
        name: body.name
      }
    });

    res.json({ holiday: toCompanyHolidayDto(holiday) });
  } catch (error) {
    next(error);
  }
};

export const deleteCompanyHoliday: RequestHandler = async (req, res, next) => {
  try {
    await prisma.companyHoliday.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
