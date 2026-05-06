import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Request } from "express";
import type { RequestHandler } from "express";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { getAuthUser } from "../middleware/auth.js";
import { AppError } from "../middleware/errorHandler.js";

function uploadPath(filename: string): string {
  const uploadRoot = path.resolve(env.UPLOAD_DIR);
  const filePath = path.resolve(uploadRoot, filename);

  if (!filePath.startsWith(uploadRoot)) {
    throw new AppError(400, "Invalid file path");
  }

  return filePath;
}

interface Multer3File {
  path: string;
  originalName: string;
  clientReportedMimeType: string;
  size: number;
}

const allowedExtensions = new Set([
  "pdf",
  "dwg",
  "dxf",
  "rvt",
  "ifc",
  "jpg",
  "jpeg",
  "png",
  "xlsx",
  "docx",
  "zip"
]);

function requestFile(req: Request): Multer3File | null {
  const maybeFile = (req as Request & { file?: Partial<Multer3File> }).file;

  if (
    typeof maybeFile?.path === "string" &&
    typeof maybeFile.originalName === "string" &&
    typeof maybeFile.clientReportedMimeType === "string" &&
    typeof maybeFile.size === "number"
  ) {
    return {
      path: maybeFile.path,
      originalName: maybeFile.originalName,
      clientReportedMimeType: maybeFile.clientReportedMimeType,
      size: maybeFile.size
    };
  }

  return null;
}

function persistUpload(file: Multer3File): { filename: string; originalName: string; mimeType: string; size: number } {
  const extension = path.extname(file.originalName).toLowerCase();
  const cleanExtension = extension.replace(".", "");

  if (!allowedExtensions.has(cleanExtension)) {
    fs.rmSync(file.path, { force: true });
    throw new AppError(400, "File type not allowed");
  }

  fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });

  const filename = `${randomUUID()}${extension}`;
  const destination = uploadPath(filename);
  fs.renameSync(file.path, destination);

  return {
    filename,
    originalName: file.originalName,
    mimeType: file.clientReportedMimeType,
    size: file.size
  };
}

export const uploadAttachment: RequestHandler = async (req, res, next) => {
  try {
    const user = getAuthUser(req);
    const file = requestFile(req);

    if (!file) {
      throw new AppError(400, "Attachment file missing");
    }

    const task = await prisma.task.findUnique({ where: { id: req.params.taskId } });

    if (!task) {
      fs.rmSync(file.path, { force: true });
      throw new AppError(404, "Task not found");
    }

    const savedFile = persistUpload(file);

    const attachment = await prisma.attachment.create({
      data: {
        taskId: req.params.taskId,
        filename: savedFile.filename,
        originalName: savedFile.originalName,
        mimeType: savedFile.mimeType,
        size: savedFile.size,
        uploadedById: user.id
      }
    });

    res.status(201).json({ attachment });
  } catch (error) {
    next(error);
  }
};

export const downloadAttachment: RequestHandler = async (req, res, next) => {
  try {
    const attachment = await prisma.attachment.findUnique({ where: { id: req.params.id } });

    if (!attachment) {
      throw new AppError(404, "Attachment not found");
    }

    const filePath = uploadPath(attachment.filename);

    if (!fs.existsSync(filePath)) {
      throw new AppError(404, "File not found");
    }

    res.download(filePath, attachment.originalName);
  } catch (error) {
    next(error);
  }
};

export const deleteAttachment: RequestHandler = async (req, res, next) => {
  try {
    const attachment = await prisma.attachment.findUnique({ where: { id: req.params.id } });

    if (!attachment) {
      throw new AppError(404, "Attachment not found");
    }

    const filePath = uploadPath(attachment.filename);
    fs.rmSync(filePath, { force: true });
    await prisma.attachment.delete({ where: { id: req.params.id } });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
