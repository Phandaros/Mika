import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, nativeTheme, shell } from "electron";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const devServerUrl = process.env.VITE_DEV_SERVER_URL ?? "http://localhost:5173";
const appName = process.env.ELECTRON_APP_NAME ?? "MK Projetos";

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
