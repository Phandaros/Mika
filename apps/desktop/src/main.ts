import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, ipcMain, nativeTheme, shell } from "electron";
import { UpdaterService } from "./updater.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const devServerUrl = process.env.VITE_DEV_SERVER_URL ?? "http://localhost:5173";
const appName = process.env.ELECTRON_APP_NAME ?? "Mika";
const defaultServerUrl = process.env.MIKA_SERVER_URL ?? "http://DESKTOP-TP1SBGH:3001";
const configFileName = "mk-projetos.ini";

let updaterService: UpdaterService | null = null;

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
    return normalizeServerUrl(defaultServerUrl);
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
  ipcMain.handle("updater:check", async () => {
    await updaterService?.checkForUpdates();
  });
  ipcMain.handle("updater:install", async (_event, payload: { fileName: string }) => {
    await updaterService?.downloadAndInstall(payload.fileName);
  });
}

async function createWindow(): Promise<BrowserWindow> {
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
    return mainWindow;
  }

  await mainWindow.loadFile(clientIndexPath());
  return mainWindow;
}

app.whenReady().then(async () => {
  registerIpcHandlers();
  const mainWindow = await createWindow();
  updaterService = new UpdaterService(mainWindow, await readServerUrlConfig());

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on("before-quit", () => {
  updaterService?.destroy();
  updaterService = null;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
