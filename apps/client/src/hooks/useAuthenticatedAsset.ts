import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { getApiBaseUrl } from "../lib/runtimeConfig";

function resolveAssetRequestUrl(src: string): string | null {
  if (!src) {
    return null;
  }

  if (src.startsWith("http://") || src.startsWith("https://")) {
    const apiBase = getApiBaseUrl();
    if (src.startsWith(apiBase)) {
      return src.slice(apiBase.length);
    }

    return null;
  }

  if (src.startsWith("/api/v1/")) {
    return src.slice("/api/v1".length);
  }

  return null;
}

export function useAuthenticatedAsset(src: string | undefined): {
  blobUrl: string | null;
  failed: boolean;
  loading: boolean;
} {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(Boolean(src));

  useEffect(() => {
    const requestPath = src ? resolveAssetRequestUrl(src) : null;

    if (!requestPath) {
      setBlobUrl(null);
      setFailed(Boolean(src));
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    setLoading(true);
    setFailed(false);
    setBlobUrl(null);

    void api
      .get(requestPath, { responseType: "blob" })
      .then((response) => {
        if (cancelled) {
          return;
        }

        objectUrl = URL.createObjectURL(response.data);
        setBlobUrl(objectUrl);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setFailed(true);
        setLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src]);

  return { blobUrl, failed, loading };
}

export async function openAuthenticatedAsset(src: string): Promise<void> {
  const requestPath = resolveAssetRequestUrl(src);

  if (!requestPath) {
    window.open(src, "_blank", "noopener,noreferrer");
    return;
  }

  const response = await api.get(requestPath, { responseType: "blob" });
  const objectUrl = URL.createObjectURL(response.data);
  window.open(objectUrl, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}
