import type { CorsOptions } from "cors";

const DEFAULT_HOSTNAME = "DESKTOP-TP1SBGH";

function isPrivateLanHost(hostname: string): boolean {
  if (hostname === "localhost" || hostname === DEFAULT_HOSTNAME.toLowerCase()) {
    return true;
  }

  if (hostname === "127.0.0.1" || hostname === "::1") {
    return true;
  }

  if (hostname.startsWith("192.168.") || hostname.startsWith("10.")) {
    return true;
  }

  const parts = hostname.split(".").map((part) => Number(part));
  return parts.length === 4 && parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31;
}

export function isAllowedCorsOrigin(origin: string | undefined, configuredClientUrl: string): boolean {
  if (!origin || origin === "file://") {
    return true;
  }

  if (origin === configuredClientUrl) {
    return true;
  }

  try {
    const parsedOrigin = new URL(origin);

    if (parsedOrigin.protocol !== "http:" && parsedOrigin.protocol !== "https:") {
      return false;
    }

    return isPrivateLanHost(parsedOrigin.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function createCorsOptions(configuredClientUrl: string): CorsOptions {
  return {
    origin(origin, callback) {
      callback(null, isAllowedCorsOrigin(origin, configuredClientUrl));
    },
    credentials: true
  };
}
