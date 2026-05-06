import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("mkProjetos", {
  isDesktop: true
});
