export interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes: string;
  fileName: string;
  sha256: string;
}

export interface DownloadProgress {
  percent: number;
  transferred: number;
  total: number;
}
