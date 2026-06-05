import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { app, shell, type BrowserWindow } from "electron";
import semver from "semver";

export const UPDATE_POLL_INTERVAL_MS = 3 * 60 * 1000;
const INITIAL_UPDATE_CHECK_DELAY_MS = 30 * 1000;
const safeFileNamePattern = /^[A-Za-z0-9._-]+$/;

interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes: string;
  fileName: string;
  sha256: string;
}

interface DownloadProgress {
  percent: number;
  transferred: number;
  total: number;
}

interface RequestResult {
  statusCode: number;
  body: string;
}

function chunkToBuffer(chunk: Buffer | string): Buffer {
  return typeof chunk === "string" ? Buffer.from(chunk) : chunk;
}

function requestText(url: string): Promise<RequestResult> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const transport = parsedUrl.protocol === "https:" ? https : http;
    const request = transport.get(parsedUrl, (response) => {
      const chunks: Buffer[] = [];

      response.on("data", (chunk: Buffer | string) => {
        chunks.push(chunkToBuffer(chunk));
      });

      response.on("end", () => {
        resolve({
          statusCode: response.statusCode ?? 0,
          body: Buffer.concat(chunks).toString("utf8")
        });
      });
    });

    request.on("error", reject);
    request.setTimeout(30_000, () => {
      request.destroy(new Error("Tempo limite ao verificar atualizacoes."));
    });
  });
}

async function readUpdateInfo(url: string): Promise<UpdateInfo | null> {
  const response = await requestText(url);

  if (response.statusCode === 404) {
    return null;
  }

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error("Servidor de atualizacao retornou uma resposta invalida.");
  }

  return JSON.parse(response.body) as UpdateInfo;
}

function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);

    stream.on("data", (chunk: Buffer | string) => {
      hash.update(chunkToBuffer(chunk));
    });
    stream.on("error", reject);
    stream.on("end", () => {
      resolve(hash.digest("hex"));
    });
  });
}

function removeFileIfExists(filePath: string): void {
  try {
    fs.unlinkSync(filePath);
  } catch {
    // The file may not exist when the download fails before the stream is opened.
  }
}

export class UpdaterService {
  private pollTimer: NodeJS.Timeout | null = null;
  private initialCheckTimer: NodeJS.Timeout | null = null;
  private isChecking = false;
  private latestInfo: UpdateInfo | null = null;
  private readonly serverBaseUrl: string;

  constructor(
    private readonly win: BrowserWindow,
    serverBaseUrl: string
  ) {
    this.serverBaseUrl = serverBaseUrl.replace(/\/+$/, "");
    this.initialCheckTimer = setTimeout(() => {
      void this.checkForUpdates({ silent: true });
    }, INITIAL_UPDATE_CHECK_DELAY_MS);
    this.pollTimer = setInterval(() => {
      void this.checkForUpdates({ silent: true });
    }, UPDATE_POLL_INTERVAL_MS);
  }

  destroy(): void {
    if (this.initialCheckTimer) {
      clearTimeout(this.initialCheckTimer);
      this.initialCheckTimer = null;
    }

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async checkForUpdates(options: { silent?: boolean } = {}): Promise<void> {
    if (this.isChecking) {
      return;
    }

    this.isChecking = true;

    try {
      const latestInfo = await readUpdateInfo(`${this.serverBaseUrl}/api/v1/updates/latest`);

      if (!latestInfo) {
        if (!options.silent) {
          this.send("updater:up-to-date", { version: app.getVersion() });
        }
        return;
      }

      this.latestInfo = latestInfo;

      if (semver.valid(latestInfo.version) && semver.gt(latestInfo.version, app.getVersion())) {
        this.send("updater:update-available", latestInfo);
        return;
      }

      if (!options.silent) {
        this.send("updater:up-to-date", { version: app.getVersion() });
      }
    } catch (error) {
      if (!options.silent) {
        this.send("updater:error", { message: this.errorMessage(error) });
      }
    } finally {
      this.isChecking = false;
    }
  }

  async downloadAndInstall(fileName: string): Promise<void> {
    try {
      if (!safeFileNamePattern.test(fileName)) {
        throw new Error("Nome de arquivo invalido.");
      }

      const latestInfo = this.latestInfo ?? (await readUpdateInfo(`${this.serverBaseUrl}/api/v1/updates/latest`));

      if (!latestInfo || latestInfo.fileName !== fileName) {
        throw new Error("Manifesto de atualizacao invalido.");
      }

      const installerPath = path.join(app.getPath("temp"), fileName);
      await this.downloadFile(fileName, installerPath);

      const actualSha256 = await hashFile(installerPath);
      if (actualSha256.toLowerCase() !== latestInfo.sha256.toLowerCase()) {
        removeFileIfExists(installerPath);
        throw new Error("Arquivo de atualizacao corrompido. Tente baixar novamente.");
      }

      this.send("updater:ready-to-install", { filePath: installerPath });
      const openError = await shell.openPath(installerPath);

      if (openError) {
        throw new Error(openError);
      }

      app.quit();
    } catch (error) {
      this.send("updater:error", { message: this.errorMessage(error) });
    }
  }

  private downloadFile(fileName: string, destinationPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const downloadUrl = `${this.serverBaseUrl}/api/v1/updates/file?fileName=${encodeURIComponent(fileName)}`;
      const parsedUrl = new URL(downloadUrl);
      const transport = parsedUrl.protocol === "https:" ? https : http;
      const fileStream = fs.createWriteStream(destinationPath);
      let transferred = 0;
      let settled = false;

      const finishWithError = (error: Error): void => {
        if (settled) {
          return;
        }

        settled = true;
        fileStream.destroy();
        removeFileIfExists(destinationPath);
        reject(error);
      };

      const request = transport.get(parsedUrl, (response) => {
        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
          finishWithError(new Error("Nao foi possivel baixar o instalador."));
          return;
        }

        const total = Number(response.headers["content-length"] ?? 0);

        response.on("data", (chunk: Buffer | string) => {
          transferred += chunkToBuffer(chunk).length;
          this.send("updater:download-progress", this.progressPayload(transferred, total));
        });

        response.on("error", finishWithError);
        fileStream.on("error", finishWithError);
        fileStream.on("finish", () => {
          if (settled) {
            return;
          }

          settled = true;
          resolve();
        });

        response.pipe(fileStream);
      });

      request.on("error", finishWithError);
      request.setTimeout(120_000, () => {
        request.destroy(new Error("Tempo limite ao baixar a atualizacao."));
      });
    });
  }

  private progressPayload(transferred: number, total: number): DownloadProgress {
    const percent = total > 0 ? Math.min(100, Math.round((transferred / total) * 100)) : 0;
    return { percent, transferred, total };
  }

  private send(channel: string, payload: unknown): void {
    if (!this.win.isDestroyed()) {
      this.win.webContents.send(channel, payload);
    }
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }

    return "Nao foi possivel verificar atualizacoes.";
  }
}
