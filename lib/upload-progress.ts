import "server-only";

export type UploadProgressStatus = "active" | "complete" | "error";

export type UploadProgressSnapshot = {
  jobId: string;
  status: UploadProgressStatus;
  percent: number;
  label: string;
  detail: string | null;
  updatedAt: number;
};

type UploadProgressUpdate = Partial<
  Pick<UploadProgressSnapshot, "status" | "percent" | "label" | "detail">
>;

const MAX_PROGRESS_AGE_MS = 30 * 60 * 1000;
const uploadProgress = new Map<string, UploadProgressSnapshot>();

function clampPercent(percent: number): number {
  return Math.min(100, Math.max(0, percent));
}

function pruneUploadProgress(): void {
  const cutoff = Date.now() - MAX_PROGRESS_AGE_MS;

  for (const [jobId, progress] of uploadProgress) {
    if (progress.updatedAt < cutoff) {
      uploadProgress.delete(jobId);
    }
  }
}

export function beginUploadProgress(jobId: string | null): void {
  if (!jobId) {
    return;
  }

  pruneUploadProgress();
  uploadProgress.set(jobId, {
    jobId,
    status: "active",
    percent: 5,
    label: "Request accepted",
    detail: null,
    updatedAt: Date.now(),
  });
}

export function updateUploadProgress(jobId: string | null, update: UploadProgressUpdate): void {
  if (!jobId) {
    return;
  }

  const existing = uploadProgress.get(jobId) ?? {
    jobId,
    status: "active" as const,
    percent: 0,
    label: "Upload started",
    detail: null,
    updatedAt: Date.now(),
  };

  uploadProgress.set(jobId, {
    ...existing,
    ...update,
    percent: clampPercent(update.percent ?? existing.percent),
    updatedAt: Date.now(),
  });
}

export function getUploadProgress(jobId: string): UploadProgressSnapshot | null {
  pruneUploadProgress();
  return uploadProgress.get(jobId) ?? null;
}
