import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

type DesktopUpdateEvent =
  | { type: "checking" }
  | { type: "available"; version: string }
  | { type: "not-available"; version: string }
  | { type: "download-progress"; percent: number }
  | { type: "downloaded"; version: string }
  | { type: "error"; message: string };

contextBridge.exposeInMainWorld("mkProjetos", {
  isDesktop: true,
  getServerUrl: () => ipcRenderer.invoke("mk-projetos:get-server-url") as Promise<string>,
  setServerUrl: (serverUrl: string) => ipcRenderer.invoke("mk-projetos:set-server-url", serverUrl) as Promise<string>,
  onUpdateEvent: (listener: (updateEvent: DesktopUpdateEvent) => void) => {
    const channelListener = (_event: IpcRendererEvent, updateEvent: DesktopUpdateEvent): void => {
      listener(updateEvent);
    };

    ipcRenderer.on("mk-projetos:update-event", channelListener);

    return () => {
      ipcRenderer.removeListener("mk-projetos:update-event", channelListener);
    };
  },
  restartAndInstallUpdate: () => ipcRenderer.invoke("mk-projetos:restart-and-install-update") as Promise<void>
});
