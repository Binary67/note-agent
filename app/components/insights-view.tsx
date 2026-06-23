"use client";

import {
  ChevronDown,
  FileText,
  Lightbulb,
  RefreshCcw,
  Save,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  cx,
  PrimaryButton,
  SecondaryButton,
  StatusPill,
} from "@/app/components/ui";
import type {
  DocumentInsightView,
  FolderInsightView,
  InsightStatus,
  InsightsResponse,
} from "@/app/types";

export type InsightsViewProps = {
  insights: InsightsResponse | null;
  isLoading: boolean;
  isRunning: boolean;
  error: string | null;
  onRefresh: (folderId?: string) => void | Promise<void>;
  onUpdateInstruction: (
    folderId: string,
    instruction: string,
  ) => void | Promise<void>;
};

export function InsightsView({
  insights,
  isLoading,
  isRunning,
  error,
  onRefresh,
  onUpdateInstruction,
}: InsightsViewProps) {
  const folders = useMemo(() => insights?.folders ?? [], [insights]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const selectedFolder = useMemo(
    () =>
      folders.find((item) => item.folder.id === selectedFolderId) ??
      folders[0] ??
      null,
    [folders, selectedFolderId],
  );

  if (isLoading && !insights) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-5 py-5">
        <div className="rounded-panel border border-line bg-surface px-4 py-3 text-[13px] text-muted shadow-panel">
          Loading insights...
        </div>
      </div>
    );
  }

  if (folders.length === 0) {
    return (
      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col px-5 py-5 md:px-7">
        <section className="flex flex-1 flex-col items-center justify-center rounded-panel border border-line bg-surface px-5 py-12 text-center shadow-panel">
          <Lightbulb className="size-8 text-subtle" />
          <h2 className="mt-3 text-[17px] font-semibold text-ink">
            No folder insights yet
          </h2>
          <p className="mt-1 max-w-md text-[13px] leading-5 text-muted">
            Assign indexed documents to folders to prepare cached insights.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto grid min-h-0 w-full max-w-7xl flex-1 gap-4 overflow-y-auto px-5 py-5 md:px-7 xl:grid-cols-[300px_minmax(0,1fr)] xl:overflow-hidden">
      <aside className="flex min-h-0 flex-col overflow-hidden rounded-panel border border-line bg-surface shadow-panel">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Folders</h2>
            <p className="text-xs text-muted">
              {folders.length.toLocaleString()} with indexed documents
            </p>
          </div>
          {isRunning && <StatusPill tone="accent">Generating</StatusPill>}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {folders.map((folder) => (
            <button
              key={folder.folder.id}
              className={cx(
                "flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left transition",
                selectedFolder?.folder.id === folder.folder.id
                  ? "bg-surface-muted"
                  : "hover:bg-surface-muted",
              )}
              type="button"
              onClick={() => setSelectedFolderId(folder.folder.id)}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent">
                <Lightbulb className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">
                  {folder.folder.name}
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  {folder.documentCount.toLocaleString()} document
                  {folder.documentCount === 1 ? "" : "s"}
                </span>
              </span>
              <StatusPill tone={statusTone(folder.status)}>
                {statusLabel(folder.status)}
              </StatusPill>
            </button>
          ))}
        </div>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-panel border border-line bg-surface shadow-panel">
        <div className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-line px-4">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold text-ink">
              {selectedFolder?.folder.name ?? "Insights"}
            </h2>
            <p className="text-xs text-muted">
              {pendingLabel(insights?.pendingJobs ?? 0)}
            </p>
          </div>
          <SecondaryButton
            className="shrink-0"
            disabled={isLoading}
            onClick={() => void onRefresh(selectedFolder?.folder.id)}
          >
            <RefreshCcw className={cx("size-4", isRunning && "animate-spin")} />
            Generate
          </SecondaryButton>
        </div>

        {error && (
          <div className="border-b border-line bg-danger-soft px-4 py-2 text-[13px] text-danger">
            {error}
          </div>
        )}

        {selectedFolder && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <FolderInstructionEditor
              key={`${selectedFolder.folder.id}:${selectedFolder.instruction}`}
              folder={selectedFolder}
              onUpdateInstruction={onUpdateInstruction}
            />

            <FolderInsightContent folder={selectedFolder} />
          </div>
        )}
      </section>
    </div>
  );
}

function FolderInstructionEditor({
  folder,
  onUpdateInstruction,
}: {
  folder: FolderInsightView;
  onUpdateInstruction: (folderId: string, instruction: string) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState(folder.instruction);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const hasChanges = draft.trim() !== folder.instruction.trim();

  async function saveInstruction() {
    if (!draft.trim() || !hasChanges || isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      await onUpdateInstruction(folder.folder.id, draft);
      setSaveError(null);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Failed to save instruction.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="border-b border-line px-4 py-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="size-4 shrink-0 text-accent" />
          <h3 className="truncate text-[13px] font-semibold text-ink">
            Instruction
          </h3>
        </div>
        <StatusPill tone={folder.instructionSource === "custom" ? "success" : "neutral"}>
          {instructionLabel(folder)}
        </StatusPill>
      </div>

      <textarea
        className="block min-h-24 w-full resize-none rounded-panel border border-line bg-surface px-3 py-2.5 text-[13px] leading-5 text-ink outline-none placeholder:text-subtle focus:border-line-strong"
        placeholder="Write what this folder should extract from each document."
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="min-w-0 text-xs text-muted">
          {saveError ?? staleInstructionLabel(folder)}
        </p>
        <PrimaryButton
          className="shrink-0"
          disabled={!draft.trim() || !hasChanges || isSaving}
          onClick={() => void saveInstruction()}
        >
          <Save className="size-4" />
          Save
        </PrimaryButton>
      </div>
    </div>
  );
}

function FolderInsightContent({ folder }: { folder: FolderInsightView }) {
  const hasFolderInsight = Boolean(folder.overview || folder.sections.length > 0);

  return (
    <div>
      <div className="border-b border-line px-4 py-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-[13px] font-semibold text-ink">Top insights</h3>
          <StatusPill tone={statusTone(folder.status)}>
            {statusLabel(folder.status)}
          </StatusPill>
        </div>

        {hasFolderInsight ? (
          <div className="space-y-4">
            {folder.overview && (
              <p className="text-[14px] leading-6 text-ink">{folder.overview}</p>
            )}
            {folder.sections.map((section) => (
              <section key={section.title}>
                <h4 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-subtle">
                  {section.title}
                </h4>
                <ul className="mt-2 space-y-2">
                  {section.items.map((item, index) => (
                    <li
                      key={`${section.title}-${index}`}
                      className="text-[13px] leading-5 text-muted"
                    >
                      <span className="text-ink">{item.text}</span>
                      {item.documentName && (
                        <span className="ml-2 text-xs text-subtle">
                          {item.documentName}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <p className="text-[13px] leading-5 text-muted">
            {folder.suggestionStatus === "pending"
              ? "Waiting for a folder instruction."
              : "Waiting for cached insights."}
          </p>
        )}
      </div>

      <div>
        <div className="flex h-12 items-center justify-between px-4">
          <h3 className="text-[13px] font-semibold text-ink">Documents</h3>
          <span className="text-xs text-muted">
            {folder.documents.length.toLocaleString()} total
          </span>
        </div>
        <div className="border-t border-line">
          {folder.documents.map((document) => (
            <DocumentInsightRow key={document.documentId} document={document} />
          ))}
        </div>
      </div>
    </div>
  );
}

function DocumentInsightRow({ document }: { document: DocumentInsightView }) {
  const hasContent = Boolean(document.overview || document.sections.length > 0);

  return (
    <details className="group border-b border-line">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-control bg-surface-muted text-muted">
          <FileText className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-ink">
            {document.documentName}
          </span>
          <span className="mt-0.5 block text-xs text-muted">
            {document.generatedAt
              ? `Generated ${formatDate(document.generatedAt)}`
              : "Not generated"}
          </span>
        </span>
        <StatusPill tone={statusTone(document.status)}>
          {statusLabel(document.status)}
        </StatusPill>
        <ChevronDown className="size-4 shrink-0 text-subtle transition group-open:rotate-180" />
      </summary>

      <div className="px-4 pb-4 pl-[60px]">
        {hasContent ? (
          <div className="space-y-3">
            {document.overview && (
              <p className="text-[13px] leading-5 text-ink">{document.overview}</p>
            )}
            {document.sections.map((section) => (
              <section key={section.title}>
                <h4 className="text-[12px] font-semibold text-subtle">
                  {section.title}
                </h4>
                <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[13px] leading-5 text-muted">
                  {section.items.map((item, index) => (
                    <li key={`${section.title}-${index}`}>{item}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-muted">Waiting for idle generation.</p>
        )}
      </div>
    </details>
  );
}

function instructionLabel(folder: FolderInsightView): string {
  if (folder.instructionSource === "custom") {
    return "Custom";
  }

  return folder.suggestionStatus === "ready" ? "Suggested" : "Pending";
}

function staleInstructionLabel(folder: FolderInsightView): string {
  if (folder.instructionSource === "custom") {
    return "User instruction controls future insights.";
  }

  return folder.suggestionStatus === "ready"
    ? "Suggested from this folder and its documents."
    : "A suggested instruction will be prepared while idle.";
}

function pendingLabel(pendingJobs: number): string {
  if (pendingJobs === 0) {
    return "Insight cache is current";
  }

  return `${pendingJobs.toLocaleString()} background job${pendingJobs === 1 ? "" : "s"} pending`;
}

function statusLabel(status: InsightStatus): string {
  if (status === "fresh") {
    return "Current";
  }

  if (status === "stale") {
    return "Stale";
  }

  return "Pending";
}

function statusTone(status: InsightStatus): "neutral" | "accent" | "success" {
  if (status === "fresh") {
    return "success";
  }

  if (status === "stale") {
    return "accent";
  }

  return "neutral";
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
