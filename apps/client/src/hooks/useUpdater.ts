import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { DownloadProgress, UpdateInfo } from "shared";

export type UpdaterStatus = "idle" | "checking" | "downloading" | "ready" | "error";

export interface UpdaterState {
  isElectron: boolean;
  updateInfo: UpdateInfo | null;
  status: UpdaterStatus;
  progress: number;
  errorMessage: string | null;
  showBanner: boolean;
  checkNow: () => void;
  install: () => void;
  dismiss: () => void;
}

export function useUpdater(): UpdaterState {
  const isElectron = typeof window !== "undefined" && window.updaterAPI !== undefined;
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [status, setStatus] = useState<UpdaterStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!isElectron || !window.updaterAPI) {
      return undefined;
    }

    window.updaterAPI.onUpdateAvailable((info) => {
      setUpdateInfo(info);
      setProgress(0);
      setErrorMessage(null);
      setDismissedVersion(null);
      setStatus("idle");
    });

    window.updaterAPI.onUpToDate(({ version }) => {
      setStatus("idle");
      toast(`Voce ja esta na versao mais recente (v${version}).`);
    });

    window.updaterAPI.onDownloadProgress((downloadProgress: DownloadProgress) => {
      setProgress(downloadProgress.percent);
      setStatus("downloading");
    });

    window.updaterAPI.onReadyToInstall(() => {
      setProgress(100);
      setStatus("ready");
    });

    window.updaterAPI.onError(({ message }) => {
      setErrorMessage(message);
      setStatus("error");
      toast.error(message);
    });

    return () => {
      window.updaterAPI?.removeAllListeners();
    };
  }, [isElectron]);

  const checkNow = useCallback(() => {
    if (!window.updaterAPI) {
      return;
    }

    setStatus("checking");
    setErrorMessage(null);
    void window.updaterAPI.checkForUpdates();
  }, []);

  const install = useCallback(() => {
    if (!window.updaterAPI || !updateInfo) {
      return;
    }

    setStatus("downloading");
    setProgress(0);
    setErrorMessage(null);
    void window.updaterAPI.installUpdate(updateInfo.fileName);
  }, [updateInfo]);

  const dismiss = useCallback(() => {
    setDismissedVersion(updateInfo?.version ?? null);
  }, [updateInfo]);

  return useMemo(
    () => ({
      isElectron,
      updateInfo,
      status,
      progress,
      errorMessage,
      showBanner:
        isElectron &&
        updateInfo !== null &&
        dismissedVersion !== updateInfo.version &&
        (status === "idle" || status === "downloading" || status === "ready"),
      checkNow,
      install,
      dismiss
    }),
    [checkNow, dismiss, dismissedVersion, errorMessage, install, isElectron, progress, status, updateInfo]
  );
}
