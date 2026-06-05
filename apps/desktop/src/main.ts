import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, ipcMain, nativeTheme, shell } from "electron";
import electronUpdater from "electron-updater";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const devServerUrl = process.env.VITE_DEV_SERVER_URL ?? "http://localhost:5173";
const appName = process.env.ELECTRON_APP_NAME ?? "Mika";
const defaultServerUrl = "http://DESKTOP-TP1SBGH:3001";
const configFileName = "mk-projetos.ini";
const updateFeedPath = "/binaries/desktop/win";
const updateCheckIntervalMs = 6 * 60 * 60 * 1000;
const maxDownloadDelayMs = 60 * 1000;
const { autoUpdater } = electronUpdater;

type DesktopUpdateEvent =
  | { type: "checking" }
  | { type: "available"; version: string }
  | { type: "not-available"; version: string }
  | { type: "download-progress"; percent: number }
  | { type: "downloaded"; version: string }
  | { type: "error"; message: string };

let isCheckingForUpdates = false;
let updateCheckTimer: NodeJS.Timeout | null = null;
let updateDownloadTimer: NodeJS.Timeout | null = null;

app.setName(appName);

function configFilePath(): string {
  return path.join(app.getPath("userData"), configFileName);
}

function normalizeServerUrl(serverUrl: string): string {
  const trimmedServerUrl = serverUrl.trim();
  const withProtocol = /^https?:\/\//i.test(trimmedServerUrl) ? trimmedServerUrl : `http://${trimmedServerUrl}`;
  const parsedUrl = new URL(withProtocol);
  parsedUrl.pathname = "";
  parsedUrl.search = "";
  parsedUrl.hash = "";

  if (!parsedUrl.port) {
    parsedUrl.port = "3001";
  }

  return parsedUrl.toString().replace(/\/+$/, "");
}

function parseServerUrlConfig(contents: string): string | null {
  const line = contents
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find((item) => item.startsWith("serverUrl="));

  if (!line) {
    return null;
  }

  return line.slice("serverUrl=".length).trim() || null;
}

async function readServerUrlConfig(): Promise<string> {
  try {
    const contents = await fs.readFile(configFilePath(), "utf8");
    return normalizeServerUrl(parseServerUrlConfig(contents) ?? defaultServerUrl);
  } catch {
    return defaultServerUrl;
  }
}

async function writeServerUrlConfig(serverUrl: string): Promise<string> {
  const normalizedServerUrl = normalizeServerUrl(serverUrl);
  await fs.mkdir(path.dirname(configFilePath()), { recursive: true });
  await fs.writeFile(configFilePath(), `serverUrl=${normalizedServerUrl}\n`, "utf8");
  return normalizedServerUrl;
}

function isSafeExternalUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === "https:" || parsedUrl.protocol === "http:";
  } catch {
    return false;
  }
}

function clientIndexPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "client", "index.html");
  }

  return path.resolve(__dirname, "..", "..", "client", "dist", "index.html");
}

function registerIpcHandlers(): void {
  ipcMain.handle("mk-projetos:get-server-url", async () => readServerUrlConfig());
  ipcMain.handle("mk-projetos:set-server-url", async (_event, serverUrl: string) => writeServerUrlConfig(serverUrl));
  ipcMain.handle("mk-projetos:restart-and-install-update", () => {
    autoUpdater.quitAndInstall(false, true);
  });
}

function emitUpdateEvent(updateEvent: DesktopUpdateEvent): void {
  for (const browserWindow of BrowserWindow.getAllWindows()) {
    browserWindow.webContents.send("mk-projetos:update-event", updateEvent);
  }
}

function updateFeedUrl(serverUrl: string): string {
  return `${normalizeServerUrl(serverUrl)}${updateFeedPath}`;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Não foi possível verificar atualizações";
}

function scheduleUpdateDownload(): void {
  if (updateDownloadTimer) {
    return;
  }

  const downloadDelayMs = Math.floor(Math.random() * maxDownloadDelayMs);
  updateDownloadTimer = setTimeout(() => {
    updateDownloadTimer = null;
    void autoUpdater.downloadUpdate().catch((error: unknown) => {
      emitUpdateEvent({ type: "error", message: errorMessage(error) });
    });
  }, downloadDelayMs);
}

async function checkForDesktopUpdates(): Promise<void> {
  if (!app.isPackaged || isCheckingForUpdates) {
    return;
  }

  isCheckingForUpdates = true;
  emitUpdateEvent({ type: "checking" });

  try {
    autoUpdater.setFeedURL({
      provider: "generic",
      url: updateFeedUrl(await readServerUrlConfig())
    });
    await autoUpdater.checkForUpdates();
  } catch (error) {
    emitUpdateEvent({ type: "error", message: errorMessage(error) });
  } finally {
    isCheckingForUpdates = false;
  }
}

function startDesktopAutoUpdater(): void {
  if (!app.isPackaged) {
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on("update-available", (info) => {
    emitUpdateEvent({ type: "available", version: info.version });
    scheduleUpdateDownload();
  });

  autoUpdater.on("update-not-available", (info) => {
    emitUpdateEvent({ type: "not-available", version: info.version });
  });

  autoUpdater.on("download-progress", (progress) => {
    emitUpdateEvent({ type: "download-progress", percent: progress.percent });
  });

  autoUpdater.on("update-downloaded", (event) => {
    emitUpdateEvent({ type: "downloaded", version: event.version });
  });

  autoUpdater.on("error", (error) => {
    emitUpdateEvent({ type: "error", message: errorMessage(error) });
  });

  void checkForDesktopUpdates();
  updateCheckTimer = setInterval(() => {
    void checkForDesktopUpdates();
  }, updateCheckIntervalMs);
}

async function createWindow(): Promise<void> {
  nativeTheme.themeSource = "dark";

  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 720,
    title: appName,
    backgroundColor: "#111111",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) {
      void shell.openExternal(url);
    }

    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    const currentUrl = mainWindow.webContents.getURL();

    if (url !== currentUrl && isSafeExternalUrl(url) && !url.startsWith(devServerUrl)) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  if (!app.isPackaged) {
    await mainWindow.loadURL(devServerUrl);
    return;
  }

  await mainWindow.loadFile(clientIndexPath());
}

app.whenReady().then(async () => {
  registerIpcHandlers();
  await createWindow();
  startDesktopAutoUpdater();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (updateCheckTimer) {
    clearInterval(updateCheckTimer);
    updateCheckTimer = null;
  }

  if (updateDownloadTimer) {
    clearTimeout(updateDownloadTimer);
    updateDownloadTimer = null;
  }

  if (process.platform !== "darwin") {
    app.quit();
  }
});
