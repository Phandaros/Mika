import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { RequestHandler } from "express";
import { AppError } from "../middleware/errorHandler.js";

const safeFileNamePattern = /^[A-Za-z0-9._-]+$/;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const releaseChannelDir = path.resolve(__dirname, "..", "..", "release-channel");
const latestManifestPath = path.join(releaseChannelDir, "latest.json");

export const getLatest: RequestHandler = async (_req, res, next) => {
  try {
    if (!fs.existsSync(latestManifestPath)) {
      throw new AppError(404, "Nenhuma atualizacao publicada.");
    }

    res.type("application/json").sendFile(latestManifestPath);
  } catch (error) {
    next(error);
  }
};

export const downloadFile: RequestHandler = async (req, res, next) => {
  try {
    const fileName = typeof req.query.fileName === "string" ? req.query.fileName : "";

    if (!safeFileNamePattern.test(fileName)) {
      throw new AppError(400, "Nome de arquivo invalido.");
    }

    const filePath = path.join(releaseChannelDir, fileName);

    if (!fs.existsSync(filePath)) {
      throw new AppError(404, "Instalador nao encontrado.");
    }

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    next(error);
  }
};
