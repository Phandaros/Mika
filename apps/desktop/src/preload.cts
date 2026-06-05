import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

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

const updaterChannels = [
  "updater:update-available",
  "updater:up-to-date",
  "updater:download-progress",
  "updater:ready-to-install",
  "updater:error"
] as const;

contextBridge.exposeInMainWorld("mkProjetos", {
  isDesktop: true,
  getServerUrl: () => ipcRenderer.invoke("mk-projetos:get-server-url") as Promise<string>,
  setServerUrl: (serverUrl: string) => ipcRenderer.invoke("mk-projetos:set-server-url", serverUrl) as Promise<string>
});

contextBridge.exposeInMainWorld("updaterAPI", {
  checkForUpdates: () => ipcRenderer.invoke("updater:check") as Promise<void>,
  installUpdate: (fileName: string) => ipcRenderer.invoke("updater:install", { fileName }) as Promise<void>,
  onUpdateAvailable: (callback: (info: UpdateInfo) => void) => {
    ipcRenderer.on("updater:update-available", (_event: IpcRendererEvent, info: UpdateInfo) => callback(info));
  },
  onUpToDate: (callback: (versionInfo: { version: string }) => void) => {
    ipcRenderer.on("updater:up-to-date", (_event: IpcRendererEvent, versionInfo: { version: string }) => callback(versionInfo));
  },
  onDownloadProgress: (callback: (progress: DownloadProgress) => void) => {
    ipcRenderer.on("updater:download-progress", (_event: IpcRendererEvent, progress: DownloadProgress) => callback(progress));
  },
  onReadyToInstall: (callback: (fileInfo: { filePath: string }) => void) => {
    ipcRenderer.on("updater:ready-to-install", (_event: IpcRendererEvent, fileInfo: { filePath: string }) => callback(fileInfo));
  },
  onError: (callback: (error: { message: string }) => void) => {
    ipcRenderer.on("updater:error", (_event: IpcRendererEvent, error: { message: string }) => callback(error));
  },
  removeAllListeners: () => {
    updaterChannels.forEach((channel) => {
      ipcRenderer.removeAllListeners(channel);
    });
  }
});
