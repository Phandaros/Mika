import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, ipcMain, nativeTheme, shell } from "electron";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const devServerUrl = process.env.VITE_DEV_SERVER_URL ?? "http://localhost:5173";
const appName = process.env.ELECTRON_APP_NAME ?? "MK Projetos";
const defaultServerUrl = "http://DESKTOP-TP1SBGH:3001";
const configFileName = "mk-projetos.ini";

app.setName(appName);

function configFilePath(): string {
  return path.join(app.getPath("userData"), configFileName);
}

function normalizeServerUrl(serverUrl: string): string {
  const withProtocol = /^https?:\/\//i.test(serverUrl) ? serverUrl : `http://${serverUrl}`;
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
      preload: path.join(__dirname, "preload.js"),
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

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
