const DEFAULT_SERVER_HOST = "DESKTOP-TP1SBGH";
const SERVER_PORT = "3001";

interface DesktopApi {
  isDesktop: true;
  getServerUrl: () => Promise<string>;
  setServerUrl: (serverUrl: string) => Promise<string>;
}

declare global {
  interface Window {
    mkProjetos?: DesktopApi;
  }
}

let apiBaseUrl = "";
let socketBaseUrl = "";

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function normalizeServerUrl(serverUrl: string): string {
  const withProtocol = /^https?:\/\//i.test(serverUrl) ? serverUrl : `http://${serverUrl}`;
  const parsedUrl = new URL(withProtocol);
  parsedUrl.pathname = "";
  parsedUrl.search = "";
  parsedUrl.hash = "";

  if (!parsedUrl.port) {
    parsedUrl.port = SERVER_PORT;
  }

  return trimTrailingSlash(parsedUrl.toString());
}

function browserServerUrl(): string {
  const envApiUrl = import.meta.env.VITE_API_URL as string | undefined;
  const currentHostname = window.location.hostname;

  if (envApiUrl) {
    const parsedEnvUrl = new URL(envApiUrl);

    if (!isLocalHostname(currentHostname) && isLocalHostname(parsedEnvUrl.hostname)) {
      parsedEnvUrl.hostname = currentHostname;
      parsedEnvUrl.port = SERVER_PORT;
      parsedEnvUrl.pathname = "";
      return trimTrailingSlash(parsedEnvUrl.toString());
    }
  }

  const hostname = currentHostname || DEFAULT_SERVER_HOST;
  return `http://${hostname}:${SERVER_PORT}`;
}

export async function initializeRuntimeConfig(): Promise<void> {
  const serverUrl = window.mkProjetos?.isDesktop
    ? await window.mkProjetos.getServerUrl()
    : browserServerUrl();

  socketBaseUrl = normalizeServerUrl(serverUrl);
  apiBaseUrl = `${socketBaseUrl}/api/v1`;
}

export function getApiBaseUrl(): string {
  return apiBaseUrl || `${browserServerUrl()}/api/v1`;
}

export function getSocketBaseUrl(): string {
  return socketBaseUrl || browserServerUrl();
}

export async function updateDesktopServerUrl(serverUrl: string): Promise<void> {
  if (!window.mkProjetos?.isDesktop) {
    return;
  }

  const savedServerUrl = await window.mkProjetos.setServerUrl(serverUrl);
  socketBaseUrl = normalizeServerUrl(savedServerUrl);
  apiBaseUrl = `${socketBaseUrl}/api/v1`;
}
