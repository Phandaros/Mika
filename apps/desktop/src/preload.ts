import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("mkProjetos", {
  isDesktop: true,
  getServerUrl: () => ipcRenderer.invoke("mk-projetos:get-server-url") as Promise<string>,
  setServerUrl: (serverUrl: string) => ipcRenderer.invoke("mk-projetos:set-server-url", serverUrl) as Promise<string>
});
