import type { RequestHandler } from "express";
import { AppError } from "../middleware/errorHandler.js";

export const uploadAttachment: RequestHandler = async (_req, _res, next) => {
  next(new AppError(501, "Attachments are not available in the imported Asana schema"));
};

export const downloadAttachment: RequestHandler = async (_req, _res, next) => {
  next(new AppError(404, "Attachment not found"));
};

export const deleteAttachment: RequestHandler = async (_req, res, next) => {
  try {
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
