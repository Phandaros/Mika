import type { RequestHandler } from "express";
import { z } from "zod";
import { TaskStatus, type TaskStatus as TaskStatusValue } from "../lib/enums.js";
import { buildTeamBoardResponse, TEAM_BOARD_DEFAULT_STATUSES } from "../lib/teamBoardTasks.js";
import { AppError } from "../middleware/errorHandler.js";

const taskStatusValues = [
  TaskStatus.TODO,
  TaskStatus.ON_SCHEDULE,
  TaskStatus.OVERDUE,
  TaskStatus.IN_PROGRESS,
  TaskStatus.AWAITING_REVIEW,
  TaskStatus.IN_ANALYSIS,
  TaskStatus.AWAITING_DEFINITION,
  TaskStatus.FINISHED
] as const;

const teamBoardQuerySchema = z.object({
  statuses: z
    .string()
    .optional()
    .transform((value) => {
      if (!value || value.trim() === "") {
        return [...TEAM_BOARD_DEFAULT_STATUSES];
      }

      return value
        .split(",")
        .map((item) => item.trim())
        .filter((item): item is TaskStatusValue => taskStatusValues.includes(item as TaskStatusValue));
    }),
  includeEmpty: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true")
    .default("false")
});

export const getTeamBoard: RequestHandler = async (req, res, next) => {
  try {
    const parsed = teamBoardQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      throw new AppError(400, "Parametros statuses ou includeEmpty invalidos");
    }

    if (parsed.data.statuses.length === 0) {
      throw new AppError(400, "Pelo menos um status valido e obrigatorio");
    }

    const response = await buildTeamBoardResponse({
      statuses: parsed.data.statuses,
      includeEmpty: parsed.data.includeEmpty
    });

    res.json(response);
  } catch (error) {
    next(error);
  }
};
