"use client";

import {
  BookOpen,
  ExternalLink,
  FileText,
  Globe,
  Lightbulb,
  Quote,
  RefreshCcw,
} from "lucide-react";
import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  cx,
  SecondaryButton,
  StatusPill,
} from "@/app/components/ui";
import type {
  DocumentTakeaway,
  FolderInsightView,
  InsightGenerationProgress,
  InsightStatus,
  InsightsResponse,
} from "@/app/types";

export type InsightsViewProps = {
  insights: InsightsResponse | null;
  progress: InsightGenerationProgress | null;
  isLoading: boolean;
  isRunning: boolean;
  error: string | null;
  onRefresh: (folderId?: string) => void | Promise<void>;
};

export function InsightsView({
  insights,
  progress,
  isLoading,
  isRunning,
  error,
  onRefresh,
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
                    {takeawayCountLabel(folder.takeawayCount)}
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
            <SecondaryButton
              className="shrink-0"
              disabled={isLoading || isRunning}
              onClick={() => void onRefresh(selectedFolder?.folder.id)}
            >
              <RefreshCcw className={cx("size-4", isRunning && "animate-spin")} />
              {isRunning ? "Generating" : "Generate"}
            </SecondaryButton>
          </div>
        </div>

        {error && (
          <div className="border-b border-line bg-danger-soft px-4 py-2 text-[13px] text-danger">
            {error}
          </div>
        )}

        {progress && (isRunning || progress.status === "error") && (
          <InsightGenerationProgressBar progress={progress} />
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

function InsightGenerationProgressBar({
  progress,
}: {
  progress: InsightGenerationProgress;
}) {
  const percent = Math.min(100, Math.max(0, Math.round(progress.percent)));
  const count =
    progress.totalDocuments > 0
      ? `${progress.processedDocuments.toLocaleString()}/${progress.totalDocuments.toLocaleString()}`
      : "Preparing";
  const detail = progress.currentDocumentName
    ? `Current document: ${progress.currentDocumentName}`
    : progress.detail;

  return (
    <div className="border-b border-line bg-surface-muted px-4 py-3">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="min-w-0 truncate font-medium text-ink">
          {progress.label}
        </span>
        <span className="shrink-0 font-medium text-muted">
          {count} - {percent}%
        </span>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-pressed"
        role="progressbar"
        aria-label="Insight generation progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={progress.label}
      >
        <div
          className={cx(
            "h-full rounded-full transition-[width] duration-300 ease-out",
            progress.status === "error" ? "bg-danger" : "bg-accent",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      {detail && (
        <p className="mt-2 truncate text-xs text-muted" title={detail}>
          {detail}
        </p>
      )}
    </div>
  );
}

function FolderInsightContent({ folder }: { folder: FolderInsightView }) {
  const takeaways = getFolderTakeaways(folder);
  const groups = getTakeawayGroups(takeaways);
  const [selectedTakeawayId, setSelectedTakeawayId] = useState<string | null>(null);
  const selectedTakeaway =
    takeaways.find((takeaway) => takeaway.id === selectedTakeawayId) ??
    takeaways[0] ??
    null;
  const selectedTakeawayIndex = selectedTakeaway
    ? takeaways.findIndex((takeaway) => takeaway.id === selectedTakeaway.id)
    : -1;
  const hasTakeaways = takeaways.length > 0;

  return (
    <div
      className={cx(
        "grid min-h-full",
        hasTakeaways &&
          "lg:grid-cols-[minmax(0,1fr)_400px] 2xl:grid-cols-[minmax(0,1fr)_460px]",
      )}
    >
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

          {hasTakeaways ? (
            <>
              <p className="mt-3 max-w-3xl text-[14px] leading-6 text-ink">
                {folder.overview}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-muted">
                  {takeawayCountLabel(folder.takeawayCount)}
                </span>
                <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-muted">
                  {documentCountLabel(folder.documentCount)}
                </span>
                <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
                  Web expansion included
                </span>
              </div>
            </>
          ) : (
            <EmptyBriefState folder={folder} />
          )}
        </section>

        {hasTakeaways && (
          <section className="px-4 py-4 sm:px-5 lg:border-b-0">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[13px] font-semibold text-ink">
                Top takeaways
              </h3>
              <span className="text-xs text-muted">
                {takeaways.length.toLocaleString()} total
              </span>
            </div>

            <div className="mt-3 space-y-4">
              {groups.map((group) => (
                <section key={group.documentId}>
                  <div className="mb-2 flex items-center gap-2 text-xs text-muted">
                    <FileText className="size-3.5 shrink-0 text-subtle" />
                    <span className="min-w-0 truncate font-medium">
                      {group.documentName}
                    </span>
                    <span className="shrink-0 text-subtle">
                      {group.takeaways.length.toLocaleString()}
                    </span>
                  </div>
                  <ol className="divide-y divide-line border-y border-line">
                    {group.takeaways.map((takeaway) => (
                      <FolderTakeawayRow
                        key={takeaway.id}
                        takeaway={takeaway}
                        index={takeaways.findIndex(
                          (item) => item.id === takeaway.id,
                        )}
                        isSelected={takeaway.id === selectedTakeaway?.id}
                        onSelect={() => setSelectedTakeawayId(takeaway.id)}
                      />
                    ))}
                  </ol>
                </section>
              ))}
            </div>
          </section>
        )}
      </div>

      {selectedTakeaway && (
        <TakeawayDetailPanel
          takeaway={selectedTakeaway}
          index={selectedTakeawayIndex}
        />
      )}
    </div>
  );
}

function EmptyBriefState({ folder }: { folder: FolderInsightView }) {
  const pendingDocuments = folder.documents.filter(
    (document) => document.status !== "fresh",
  ).length;

  return (
    <div className="mt-4 border-t border-line pt-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-surface text-muted ring-1 ring-line">
          <BookOpen className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="text-[15px] font-semibold text-ink">
            No learning brief yet
          </h4>
          <p className="mt-1 max-w-2xl text-[13px] leading-5 text-muted">
            {emptyStateMessage(folder)}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-muted ring-1 ring-line">
              {documentCountLabel(folder.documentCount)}
            </span>
            <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-muted ring-1 ring-line">
              {pendingDocuments.toLocaleString()} pending
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

type FolderTakeaway = DocumentTakeaway & {
  documentId: string;
  documentName: string;
  takeawayId: string;
};

type TakeawayGroup = {
  documentId: string;
  documentName: string;
  takeaways: FolderTakeaway[];
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
          "grid w-full grid-cols-[28px_minmax(0,1fr)] gap-3 py-3 text-left transition hover:bg-surface-muted",
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
          <span className="block text-[14px] font-semibold leading-5 text-ink">
            {takeaway.title}
          </span>
          <span className="mt-1 block text-[13px] leading-5 text-muted">
            {compactText(takeaway.summary, 210)}
          </span>
        </span>
      </button>
    </li>
  );
}

function TakeawayDetailPanel({
  takeaway,
  index,
}: {
  takeaway: FolderTakeaway;
  index: number;
}) {
  return (
    <aside className="border-t border-line bg-sidebar/70 lg:sticky lg:top-0 lg:max-h-[calc(100dvh-146px)] lg:overflow-y-auto lg:border-l lg:border-t-0">
      <div className="px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white">
            {index + 1}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase text-subtle">
              Takeaway detail
            </p>
            <h3 className="mt-1 text-[15px] font-semibold leading-5 text-ink">
              {takeaway.title}
            </h3>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
              <FileText className="size-3.5 shrink-0" />
              <span className="truncate">{takeaway.documentName}</span>
            </p>
          </div>
        </div>

        <section className="mt-5">
          <h4 className="text-[12px] font-semibold text-ink">Elaboration</h4>
          <MarkdownText content={takeaway.detail} />
          {takeaway.webContext?.summary ? (
            <MarkdownText content={takeaway.webContext.summary} />
          ) : (
            <p className="mt-3 text-[13px] leading-5 text-muted">
              Web-backed expansion will appear after this takeaway is regenerated.
            </p>
          )}
        </section>

        <TakeawaySources takeaway={takeaway} />
      </div>
    </aside>
  );
}

function TakeawaySources({ takeaway }: { takeaway: FolderTakeaway }) {
  const webCitations = takeaway.webContext?.citations ?? [];
  const hasSources = takeaway.citations.length > 0 || webCitations.length > 0;

  if (!hasSources) {
    return null;
  }

  return (
    <section className="mt-5 border-t border-line pt-4">
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle">
        Sources
      </h4>

      <div className="mt-3 space-y-3">
        {takeaway.citations.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
              <Quote className="size-3.5 text-subtle" />
              Document
            </div>
            <ul className="mt-1.5 space-y-1.5">
              {takeaway.citations.map((citation, citationIndex) => (
                <li
                  key={`${takeaway.id}-${citation.marker}-${citationIndex}`}
                  className="text-xs leading-5 text-muted"
                >
                  <span className="mr-1 rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-semibold text-ink">
                    {citation.marker}
                  </span>
                  {citation.text}
                </li>
              ))}
            </ul>
          </div>
        )}

        {webCitations.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
              <Globe className="size-3.5 text-subtle" />
              Web
            </div>
            <ul className="mt-1.5 space-y-1.5">
              {webCitations.map((citation, citationIndex) => (
                <li key={`${takeaway.id}-${citation.url}-${citationIndex}`}>
                  <a
                    className="inline-flex max-w-full items-start gap-1.5 text-xs leading-5 text-muted transition hover:text-accent"
                    href={citation.url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <ExternalLink className="mt-1 size-3 shrink-0" />
                    <span className="min-w-0 break-words">{citation.title}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function MarkdownText({
  content,
  muted = false,
}: {
  content: string;
  muted?: boolean;
}) {
  return (
    <div
      className={cx(
        "mt-2 text-[13px] leading-6",
        muted ? "text-muted" : "text-ink",
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, href }) => (
            <a
              className="font-medium text-accent underline-offset-2 hover:underline"
              href={href}
              rel="noreferrer"
              target="_blank"
            >
              {children}
            </a>
          ),
          li: ({ children }) => <li className="pl-1">{children}</li>,
          ol: ({ children }) => (
            <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>
          ),
          p: ({ children }) => (
            <p className="my-2 first:mt-0 last:mb-0">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-ink">{children}</strong>
          ),
          ul: ({ children }) => (
            <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function getFolderTakeaways(folder: FolderInsightView): FolderTakeaway[] {
  return folder.documents.flatMap((document) =>
    document.takeaways.map((takeaway) => ({
      ...takeaway,
      id: `${document.documentId}:${takeaway.id}`,
      takeawayId: takeaway.id,
      documentId: document.documentId,
      documentName: document.documentName,
    })),
  );
}

function getTakeawayGroups(takeaways: FolderTakeaway[]): TakeawayGroup[] {
  const groups = new Map<string, TakeawayGroup>();

  for (const takeaway of takeaways) {
    const existing = groups.get(takeaway.documentId);

    if (existing) {
      existing.takeaways.push(takeaway);
      continue;
    }

    groups.set(takeaway.documentId, {
      documentId: takeaway.documentId,
      documentName: takeaway.documentName,
      takeaways: [takeaway],
    });
  }

  return Array.from(groups.values());
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

function takeawayCountLabel(count: number): string {
  return `${count.toLocaleString()} takeaway${count === 1 ? "" : "s"}`;
}

function emptyStateMessage(folder: FolderInsightView): string {
  if (folder.status === "stale") {
    return "The existing brief is stale because the documents changed. Generate a fresh learning brief when you are ready.";
  }

  return "Generate a learning brief to extract document takeaways, detailed elaboration, and web-backed expansion.";
}

function pendingLabel(pendingJobs: number): string {
  if (pendingJobs === 0) {
    return "Insight cache is current";
  }

  return `${pendingJobs.toLocaleString()} document${pendingJobs === 1 ? "" : "s"} need generation`;
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
