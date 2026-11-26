export type AppUpdateState =
  | "idle"
  | "checking"
  | "up-to-date"
  | "update-available"
  | "downloading"
  | "downloaded"
  | "installing"
  | "error";

export interface AppUpdateAsset {
  name: string;
  downloadUrl: string;
  sizeBytes: number;
}

export interface AppUpdateStatus {
  state: AppUpdateState;
  currentVersion: string;
  latestVersion: string | null;
  releaseName: string | null;
  releaseNotes: string | null;
  releaseUrl: string;
  publishedAt: string | null;
  asset: AppUpdateAsset | null;
  downloadedFilePath: string | null;
  downloadProgress: number;
  downloadedBytes: number;
  totalBytes: number;
  message: string;
  error: string | null;
  lastCheckedAt: string | null;
  canInstallInPlace: boolean;
}
