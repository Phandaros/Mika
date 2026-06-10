import type { ErrorRequestHandler } from "express";
import multer from "multer";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
  }
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message, details: err.details });
  }

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "Arquivo excede o tamanho máximo permitido" });
    }

    if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(413).json({ error: "Número máximo de arquivos por envio excedido (máximo 5)" });
    }

    return res.status(400).json({ error: err.message });
  }

  if (err instanceof Error && err.message.startsWith("Tipo de arquivo não permitido")) {
    return res.status(415).json({ error: err.message });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({ error: "Invalid request data", details: err.flatten() });
  }

  console.error(err);
  return res.status(500).json({ error: "Internal server error" });
};
