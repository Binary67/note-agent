"use client";

import { CheckCircle2, CloudUpload, FileText, Pencil, RefreshCcw, Upload, X } from "lucide-react";
import { type ChangeEvent, type DragEvent, useRef } from "react";
import {
  cx,
  InspectorPanel,
  PrimaryButton,
  StatusPill,
} from "@/app/components/ui";
import { FolderInlineInput } from "@/app/components/folder-inline-input";
import { SummaryChip } from "@/app/components/summary-chip";
import { plural, splitName, statusTone, typeLabel } from "@/lib/utils";
import type { FolderRecord, UploadItem } from "@/app/types";

export type IngestionViewProps = {
  uploads: UploadItem[];
  folders: FolderRecord[];
  isDragging: boolean;
  isUploading: boolean;
  isIngesting: boolean;
  notice: string;
  stats: {
    total: number;
    indexed: number;
    ingesting: number;
    ready: number;
    errors: number;
  };
  readiness: {
    label: string;
    title: string;
    description: string;
    tone: "neutral" | "accent" | "success" | "danger";
  };
  indexSteps: ReadonlyArray<{
    label: string;
    detail: string;
    state: "complete" | "active" | "waiting";
  }>;
  folderNameById: Map<string, string>;
  onDragEnter: (event: DragEvent<HTMLLabelElement>) => void;
  onDragOver: (event: DragEvent<HTMLLabelElement>) => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent<HTMLLabelElement>) => void;
  onFileInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onStartIngestion: () => void;
  onAssignDocumentFolder: (target: UploadItem, folderName: string | null) => void | Promise<void>;
  onOpenRename: (target: UploadItem) => void;
  onOpenDelete: (target: UploadItem) => void;
};

export function IngestionView({
  uploads,
  folders,
  isDragging,
  isUploading,
  isIngesting,
  notice,
  stats,
  readiness,
  indexSteps,
  folderNameById,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileInputChange,
  onStartIngestion,
  onAssignDocumentFolder,
  onOpenRename,
  onOpenDelete,
}: IngestionViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-5 py-5 md:px-7 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-5">
        <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[13px] font-medium text-muted">Knowledge Base</p>
            <h2 className="mt-1 text-[28px] font-semibold tracking-tight text-ink">
              Ingestion
            </h2>
            <p className="mt-1 max-w-2xl text-[13px] leading-5 text-muted">
              Import documents, then prepare the local index.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-[13px] text-muted">
            <SummaryChip label="Total" value={stats.total} />
            <SummaryChip label="Indexed" value={stats.indexed} />
            <SummaryChip label="Ready" value={stats.ready} />
          </div>
        </section>

        <label
          className={cx(
            "group flex cursor-pointer flex-col gap-4 rounded-panel border bg-surface p-4 shadow-panel transition sm:flex-row sm:items-center sm:justify-between",
            isDragging
              ? "border-dashed border-accent bg-accent-soft ring-4 ring-accent-soft"
              : "border-line hover:border-line-strong",
          )}
          onDragEnter={onDragEnter}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <input
            ref={fileInputRef}
            className="sr-only"
            type="file"
            accept=".txt,text/plain"
            multiple
            onChange={onFileInputChange}
          />
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent">
              <CloudUpload className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold text-ink">
                Drop files here
              </span>
              <span className="mt-0.5 block truncate text-[13px] text-muted">
                {isUploading ? "Uploading..." : notice}
              </span>
            </span>
          </span>
          <span className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-control bg-accent px-3.5 text-[13px] font-semibold text-white transition group-hover:bg-accent-hover">
            <Upload className="size-4" />
            Select Files
          </span>
        </label>

        <section className="rounded-panel border border-line bg-surface shadow-panel">
          <div className="flex h-12 items-center justify-between border-b border-line px-4">
            <div>
              <h3 className="text-[15px] font-semibold text-ink">Uploads</h3>
              <p className="text-xs text-muted">{plural(uploads.length, "file")}</p>
            </div>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_112px_64px] border-b border-line bg-surface-muted px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle sm:grid-cols-[minmax(0,1fr)_128px_80px_112px_64px] md:grid-cols-[minmax(0,1fr)_144px_80px_112px_92px_64px]">
            <span>File</span>
            <span className="hidden text-center sm:block">Folder</span>
            <span className="hidden text-center sm:block">Size</span>
            <span className="text-center">Status</span>
            <span className="hidden text-center md:block">Date</span>
            <span />
          </div>

          {uploads.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <FileText className="mx-auto size-7 text-subtle" />
              <p className="mt-3 text-sm font-medium text-ink">No uploads yet</p>
              <p className="mt-1 text-[13px] text-muted">
                Add documents to start building the local index.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-line">
              {uploads.map((upload) => {
                const { stem, ext } = splitName(upload.name);
                const folderName = upload.folderId
                  ? folderNameById.get(upload.folderId) ?? "Unknown folder"
                  : "Unfiled";
                return (
                <div
                  key={upload.id}
                  className="grid min-h-14 grid-cols-[minmax(0,1fr)_112px_64px] items-center px-4 py-2.5 text-[13px] sm:grid-cols-[minmax(0,1fr)_128px_80px_112px_64px] md:grid-cols-[minmax(0,1fr)_144px_80px_112px_92px_64px]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-control bg-surface-muted text-muted">
                      <FileText className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{stem}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {typeLabel(ext)}
                        <span className="sm:hidden"> · {upload.size}</span>
                        <span className="sm:hidden"> · {folderName}</span>
                      </p>
                      <span className="mt-2 block sm:hidden">
                        <FolderInlineInput
                          className="w-48"
                          folders={folders}
                          valueName={upload.folderId ? folderName : null}
                          onCommit={(nextFolderName) =>
                            onAssignDocumentFolder(upload, nextFolderName)
                          }
                        />
                      </span>
                    </div>
                  </div>
                  <span className="relative hidden min-w-0 sm:block">
                    <FolderInlineInput
                      className="w-full justify-center"
                      folders={folders}
                      valueName={upload.folderId ? folderName : null}
                      onCommit={(nextFolderName) =>
                        onAssignDocumentFolder(upload, nextFolderName)
                      }
                    />
                  </span>
                  <span className="hidden text-center text-muted sm:block">{upload.size}</span>
                  <span className="justify-self-center">
                    <StatusPill tone={statusTone(upload.status)}>
                      {upload.status === "Indexed" ? (
                        <CheckCircle2 className="size-3.5" />
                      ) : (
                        <span className="size-1.5 rounded-full bg-current" />
                      )}
                      {upload.status}
                    </StatusPill>
                  </span>
                  <span className="hidden text-center text-muted md:block">{upload.uploadedAt}</span>
                  <div className="flex items-center justify-end gap-1">
                    <button
                      className="flex size-8 items-center justify-center rounded-control text-subtle transition hover:bg-surface-muted hover:text-ink"
                      type="button"
                      aria-label={`Rename ${upload.name}`}
                      onClick={() => onOpenRename(upload)}
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      className="flex size-8 items-center justify-center rounded-control text-subtle transition hover:bg-surface-muted hover:text-ink"
                      type="button"
                      aria-label={`Remove ${upload.name}`}
                      onClick={() => onOpenDelete(upload)}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <InspectorPanel>
        <section className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle">
                Index Status
              </p>
              <h3 className="mt-1 text-base font-semibold text-ink">
                {readiness.title}
              </h3>
            </div>
            <StatusPill tone={readiness.tone}>{readiness.label}</StatusPill>
          </div>

          <p className="mt-2 text-[13px] leading-5 text-muted">
            {readiness.description}
          </p>

          <div className="mt-4 space-y-3">
            {indexSteps.map((step) => (
              <div key={step.label} className="flex items-start gap-3">
                <span
                  className={cx(
                    "mt-1.5 size-2.5 rounded-full ring-4",
                    step.state === "complete" && "bg-success ring-success-soft",
                    step.state === "active" && "bg-accent ring-accent-soft",
                    step.state === "waiting" && "bg-line-strong ring-surface-muted",
                  )}
                />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-ink">{step.label}</p>
                  <p className="text-xs text-muted">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>

          <PrimaryButton
            className="mt-4 w-full"
            disabled={stats.ready === 0 || isIngesting}
            onClick={onStartIngestion}
          >
            {isIngesting
              ? "Indexing..."
              : stats.ready > 0
                ? "Start Indexing"
                : stats.indexed > 0
                  ? "Indexed"
                  : "Start Indexing"}
            <RefreshCcw className={cx("size-4", isIngesting && "animate-spin")} />
          </PrimaryButton>
        </section>
      </InspectorPanel>
    </div>
  );
}