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

declare global {
  interface Window {
    updaterAPI: {
      checkForUpdates(): Promise<void>;
      installUpdate(fileName: string): Promise<void>;
      onUpdateAvailable(callback: (info: UpdateInfo) => void): void;
      onUpToDate(callback: (versionInfo: { version: string }) => void): void;
      onDownloadProgress(callback: (progress: DownloadProgress) => void): void;
      onReadyToInstall(callback: (fileInfo: { filePath: string }) => void): void;
      onError(callback: (error: { message: string }) => void): void;
      removeAllListeners(): void;
    };
  }
}

export {};
