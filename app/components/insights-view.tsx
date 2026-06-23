"use client";

import {
  ChevronDown,
  FileText,
  Lightbulb,
  PencilLine,
  RefreshCcw,
  Save,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  cx,
  Modal,
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
  const showFolderList = folders.length > 1;

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
    <div
      className={cx(
        "mx-auto grid min-h-0 w-full flex-1 gap-4 overflow-y-auto px-5 py-5 md:px-7",
        showFolderList
          ? "max-w-[1600px] xl:grid-cols-[300px_minmax(0,1fr)] xl:overflow-hidden"
          : "max-w-[1500px]",
      )}
    >
      {showFolderList && (
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
                  <span className="mt-0.5 block truncate text-xs text-muted">
                    {documentCountLabel(folder.documentCount)} -{" "}
                    {instructionLabel(folder)} instruction
                  </span>
                </span>
                <StatusPill tone={statusTone(folder.status)}>
                  {statusLabel(folder.status)}
                </StatusPill>
              </button>
            ))}
          </div>
        </aside>
      )}

      <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-panel border border-line bg-surface shadow-panel">
        <div className="flex shrink-0 flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold text-ink">
              {selectedFolder?.folder.name ?? "Insights"}
            </h2>
            <p className="text-xs text-muted">
              {selectedFolder
                ? `${documentCountLabel(selectedFolder.documentCount)} - ${pendingLabel(insights?.pendingJobs ?? 0)}`
                : pendingLabel(insights?.pendingJobs ?? 0)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selectedFolder && (
              <FolderInstructionControl
                key={`${selectedFolder.folder.id}:${selectedFolder.instruction}`}
                folder={selectedFolder}
                onUpdateInstruction={onUpdateInstruction}
              />
            )}
            <SecondaryButton
              className="shrink-0"
              disabled={isLoading}
              onClick={() => void onRefresh(selectedFolder?.folder.id)}
            >
              <RefreshCcw className={cx("size-4", isRunning && "animate-spin")} />
              Generate
            </SecondaryButton>
          </div>
        </div>

        {error && (
          <div className="border-b border-line bg-danger-soft px-4 py-2 text-[13px] text-danger">
            {error}
          </div>
        )}

        {selectedFolder && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <FolderInsightContent folder={selectedFolder} />
          </div>
        )}
      </section>
    </div>
  );
}

function FolderInstructionControl({
  folder,
  onUpdateInstruction,
}: {
  folder: FolderInsightView;
  onUpdateInstruction: (folderId: string, instruction: string) => void | Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
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
      setIsOpen(false);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Failed to save instruction.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <SecondaryButton
        className="h-8 shrink-0 px-3 text-xs"
        onClick={() => setIsOpen(true)}
      >
        <PencilLine className="size-3.5" />
        Instruction: {instructionLabel(folder)}
      </SecondaryButton>

      <Modal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        icon={Sparkles}
        title={`${folder.folder.name} instruction`}
        className="max-w-[560px]"
        footer={
          <>
            <SecondaryButton
              disabled={isSaving}
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </SecondaryButton>
            <PrimaryButton
              disabled={!draft.trim() || !hasChanges || isSaving}
              onClick={() => void saveInstruction()}
            >
              <Save className="size-4" />
              Save
            </PrimaryButton>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill
              tone={folder.instructionSource === "custom" ? "success" : "neutral"}
            >
              {instructionLabel(folder)}
            </StatusPill>
            <span className="text-xs text-muted">
              {documentCountLabel(folder.documentCount)}
            </span>
          </div>

          <textarea
            className="block min-h-40 w-full resize-none rounded-panel border border-line bg-surface px-3 py-2.5 text-[13px] leading-5 text-ink outline-none placeholder:text-subtle focus:border-line-strong"
            placeholder="Write what this folder should extract from each document."
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />

          <p
            className={cx(
              "text-xs leading-5",
              saveError ? "text-danger" : "text-muted",
            )}
          >
            {saveError ?? staleInstructionLabel(folder)}
          </p>
        </div>
      </Modal>
    </>
  );
}

function FolderInsightContent({ folder }: { folder: FolderInsightView }) {
  const takeaways = getFolderTakeaways(folder);
  const [selectedTakeawayId, setSelectedTakeawayId] = useState<string | null>(null);
  const selectedTakeaway =
    takeaways.find((takeaway) => takeaway.id === selectedTakeawayId) ??
    takeaways[0] ??
    null;
  const selectedTakeawayIndex = selectedTakeaway
    ? takeaways.findIndex((takeaway) => takeaway.id === selectedTakeaway.id)
    : -1;
  const hasFolderInsight = Boolean(folder.overview || takeaways.length > 0);

  return (
    <div>
      <div className="grid min-h-0 lg:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_440px]">
        <div className="min-w-0">
          <section className="border-b border-line px-4 py-4 sm:px-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-[13px] font-semibold text-ink">
                  Learning brief
                </h3>
                <p className="mt-0.5 text-xs text-muted">
                  {folder.generatedAt
                    ? `Generated ${formatDate(folder.generatedAt)}`
                    : "Generated after the next insight run"}
                </p>
              </div>
              <StatusPill tone={statusTone(folder.status)}>
                {statusLabel(folder.status)}
              </StatusPill>
            </div>

            {hasFolderInsight ? (
              <>
                {folder.overview && (
                  <p className="mt-3 max-w-3xl text-[14px] leading-6 text-ink">
                    {folder.overview}
                  </p>
                )}

                {folder.sections.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {folder.sections.map((section) => (
                      <span
                        key={section.title}
                        className="max-w-full truncate rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-muted"
                      >
                        {section.title}
                      </span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-[13px] leading-5 text-muted">
                {folder.suggestionStatus === "pending"
                  ? "Waiting for a folder instruction."
                  : "Waiting for cached insights."}
              </p>
            )}
          </section>

          {takeaways.length > 0 && (
            <section className="border-b border-line px-4 py-4 sm:px-5 lg:border-b-0">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[13px] font-semibold text-ink">
                  Top takeaways
                </h3>
                <span className="text-xs text-muted">
                  {takeaways.length.toLocaleString()} total
                </span>
              </div>

              <ol className="mt-2 divide-y divide-line border-y border-line">
                {takeaways.map((takeaway, index) => (
                  <FolderTakeawayRow
                    key={takeaway.id}
                    takeaway={takeaway}
                    index={index}
                    isSelected={takeaway.id === selectedTakeaway?.id}
                    onSelect={() => setSelectedTakeawayId(takeaway.id)}
                  />
                ))}
              </ol>
            </section>
          )}
        </div>

        {selectedTakeaway && (
          <TakeawayDetailPanel
            folder={folder}
            takeaway={selectedTakeaway}
            index={selectedTakeawayIndex}
          />
        )}
      </div>

      <details className="group border-t-8 border-canvas bg-surface">
        <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 transition hover:bg-surface-muted sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-surface-muted text-muted ring-1 ring-line">
              <FileText className="size-4" />
            </span>
            <div className="min-w-0">
              <h3 className="text-[13px] font-semibold text-ink">Documents</h3>
              <p className="mt-0.5 truncate text-xs text-muted">
                Open source-level notes and per-document summaries.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-muted">
              {folder.documents.length.toLocaleString()} total
            </span>
            <span className="flex size-8 items-center justify-center rounded-control bg-surface-muted text-subtle transition group-open:bg-surface-pressed group-open:text-ink">
              <ChevronDown className="size-4 transition group-open:rotate-180" />
            </span>
          </div>
        </summary>
        <div className="border-t border-line">
          {folder.documents.map((document) => (
            <DocumentInsightRow key={document.documentId} document={document} />
          ))}
        </div>
      </details>
    </div>
  );
}

type FolderTakeaway = {
  id: string;
  sectionTitle: string;
  text: string;
  documentId?: string;
  documentName?: string;
};

function FolderTakeawayRow({
  takeaway,
  index,
  isSelected,
  onSelect,
}: {
  takeaway: FolderTakeaway;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        className={cx(
          "grid w-full grid-cols-[28px_minmax(0,1fr)_20px] gap-3 py-3 text-left transition hover:bg-surface-muted",
          isSelected && "bg-accent-soft",
        )}
        type="button"
        onClick={onSelect}
      >
        <span
          className={cx(
            "mt-0.5 flex size-7 items-center justify-center rounded-full text-xs font-semibold",
            isSelected
              ? "bg-accent text-white"
              : "bg-surface-muted text-muted",
          )}
        >
          {index + 1}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[11px] font-semibold uppercase tracking-[0.1em] text-subtle">
            {takeaway.sectionTitle}
          </span>
          <span className="mt-1 block text-[14px] leading-5 text-ink">
            {compactText(takeaway.text, 150)}
          </span>
        </span>
        <ChevronDown
          className={cx(
            "mt-1 size-4 shrink-0 -rotate-90 text-subtle transition",
            isSelected && "text-accent",
          )}
        />
      </button>
    </li>
  );
}

function TakeawayDetailPanel({
  folder,
  takeaway,
  index,
}: {
  folder: FolderInsightView;
  takeaway: FolderTakeaway;
  index: number;
}) {
  const relatedDocument = getRelatedDocument(folder, takeaway);

  return (
    <aside className="border-b border-line bg-sidebar/60 lg:sticky lg:top-0 lg:max-h-[calc(100dvh-146px)] lg:overflow-y-auto lg:border-b-0 lg:border-l">
      <div className="px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white">
            {index + 1}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-subtle">
              Takeaway detail
            </p>
            <h3 className="mt-1 text-[14px] font-semibold leading-5 text-ink">
              {takeaway.sectionTitle}
            </h3>
          </div>
        </div>

        <p className="mt-4 text-[14px] leading-6 text-ink">{takeaway.text}</p>

        {takeaway.documentName && (
          <section className="mt-5 border-t border-line pt-4">
            <h4 className="text-[12px] font-semibold text-ink">Source</h4>
            <p className="mt-1 text-[13px] leading-5 text-muted">
              {takeaway.documentName}
            </p>
            {takeaway.documentId && (
              <a
                className="mt-2 inline-flex text-[13px] font-medium text-accent hover:text-accent-hover"
                href={`#document-${takeaway.documentId}`}
              >
                View document details
              </a>
            )}
          </section>
        )}

        {relatedDocument?.overview && (
          <section className="mt-5 border-t border-line pt-4">
            <h4 className="text-[12px] font-semibold text-ink">
              Related document brief
            </h4>
            <p className="mt-2 text-[13px] leading-5 text-muted">
              {relatedDocument.overview}
            </p>
          </section>
        )}

        {relatedDocument?.sections.slice(0, 2).map((section) => (
          <section key={section.title} className="mt-5 border-t border-line pt-4">
            <h4 className="text-[12px] font-semibold text-ink">
              {section.title}
            </h4>
            <ul className="mt-2 space-y-2 text-[13px] leading-5 text-muted">
              {section.items.slice(0, 3).map((item, itemIndex) => (
                <li key={`${section.title}-${itemIndex}`}>{item}</li>
              ))}
            </ul>
          </section>
        ))}

        {!takeaway.documentName && !relatedDocument && (
          <p className="mt-5 border-t border-line pt-4 text-[13px] leading-5 text-muted">
            This takeaway is synthesized across the folder.
          </p>
        )}
      </div>
    </aside>
  );
}

function getRelatedDocument(
  folder: FolderInsightView,
  takeaway: FolderTakeaway,
): DocumentInsightView | null {
  if (takeaway.documentId) {
    const document = folder.documents.find(
      (item) => item.documentId === takeaway.documentId,
    );

    if (document) {
      return document;
    }
  }

  if (takeaway.documentName) {
    return (
      folder.documents.find(
        (document) => document.documentName === takeaway.documentName,
      ) ?? null
    );
  }

  return null;
}

function DocumentInsightRow({ document }: { document: DocumentInsightView }) {
  const hasContent = Boolean(document.overview || document.sections.length > 0);

  return (
    <details
      id={`document-${document.documentId}`}
      className="group border-b border-line scroll-mt-4"
    >
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

function getFolderTakeaways(folder: FolderInsightView): FolderTakeaway[] {
  return folder.sections.flatMap((section, sectionIndex) =>
    section.items.map((item, itemIndex) => ({
      id: `${sectionIndex}-${itemIndex}`,
      sectionTitle: section.title,
      text: item.text,
      documentId: item.documentId,
      documentName: item.documentName,
    })),
  );
}

function compactText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function documentCountLabel(count: number): string {
  return `${count.toLocaleString()} document${count === 1 ? "" : "s"}`;
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
