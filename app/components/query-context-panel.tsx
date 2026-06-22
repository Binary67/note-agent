"use client";

import { Check, FileText, Search } from "lucide-react";
import { cx } from "@/app/components/ui";
import { plural, splitName, typeLabel } from "@/lib/utils";
import type { FolderRecord, ScopeMode, UploadItem } from "@/app/types";

const retrievedDocumentsMin = 1;
const retrievedDocumentsMax = 10;

export type QueryContextPanelProps = {
  scopeMode: ScopeMode;
  onScopeModeChange: (mode: ScopeMode) => void;
  documentFilter: string;
  onDocumentFilterChange: (value: string) => void;
  maxRetrievedDocuments: number;
  onMaxRetrievedDocumentsChange: (value: number) => void;
  indexedDocuments: UploadItem[];
  filteredIndexedDocuments: UploadItem[];
  filteredIndexedFolders: Array<{ folder: FolderRecord; count: number }>;
  selectedFolderIds: string[];
  selectedDocumentIds: string[];
  onToggleFolder: (id: string) => void;
  onToggleDocument: (id: string) => void;
  folderNameById: Map<string, string>;
};

export function QueryContextPanel({
  scopeMode,
  onScopeModeChange,
  documentFilter,
  onDocumentFilterChange,
  maxRetrievedDocuments,
  onMaxRetrievedDocumentsChange,
  indexedDocuments,
  filteredIndexedDocuments,
  filteredIndexedFolders,
  selectedFolderIds,
  selectedDocumentIds,
  onToggleFolder,
  onToggleDocument,
  folderNameById,
}: QueryContextPanelProps) {
  const selectedFolderSet = new Set(selectedFolderIds);
  const selectedDocumentSet = new Set(selectedDocumentIds);

  const activeScopeTitle =
    scopeMode === "folders"
      ? selectedFolderIds.length > 0
        ? plural(selectedFolderIds.length, "selected folder")
        : "Select folders"
      : scopeMode === "documents"
        ? selectedDocumentIds.length > 0
          ? plural(selectedDocumentIds.length, "selected document")
          : "Select documents"
        : "All indexed documents";
  const activeScopeDescription =
    scopeMode === "folders"
      ? selectedFolderIds.length > 0
        ? "Hybrid search is limited to selected folders."
        : "Choose one or more folders for this chat."
      : scopeMode === "documents"
        ? selectedDocumentIds.length > 0
          ? "Selected documents are read directly."
          : "Choose one or more documents for this chat."
        : "Hybrid search chooses full documents to read.";

  return (
    <aside className="overflow-hidden rounded-panel border border-line bg-surface shadow-panel">
      <div className="border-b border-line p-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle">
            Query Context
          </p>
          <h2 className="mt-1 truncate text-base font-semibold text-ink">
            {activeScopeTitle}
          </h2>
          <p className="mt-1 text-[13px] leading-5 text-muted">
            {activeScopeDescription}
          </p>
        </div>
      </div>

      <div className="border-b border-line p-3">
        <label className="flex h-9 items-center gap-2 rounded-control border border-line bg-surface px-3 text-[13px] text-muted focus-within:border-line-strong">
          <Search className="size-4 text-subtle" />
          <input
            className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-subtle"
            placeholder={
              scopeMode === "folders" ? "Filter folders" : "Filter documents"
            }
            value={documentFilter}
            onChange={(event) => onDocumentFilterChange(event.target.value)}
          />
        </label>

        <div className="mt-3 grid grid-cols-3 rounded-control bg-surface-muted p-1">
          {(["all", "folders", "documents"] as const).map((mode) => (
            <button
              key={mode}
              className={cx(
                "h-7 rounded-[7px] text-xs font-medium transition",
                scopeMode === mode
                  ? "bg-surface text-ink shadow-sm"
                  : "text-muted hover:text-ink",
              )}
              type="button"
              onClick={() => onScopeModeChange(mode)}
            >
              {mode === "all"
                ? "All"
                : mode === "folders"
                  ? "Folders"
                  : "Documents"}
            </button>
          ))}
        </div>

        {scopeMode !== "documents" ? (
          <div className="mt-3 rounded-control bg-surface-muted p-3">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-muted">Retrieved documents</span>
              <span className="font-medium text-ink">
                {plural(maxRetrievedDocuments, "document")}
              </span>
            </div>
            <input
              aria-label="Retrieved documents"
              className="mt-3 h-2 w-full cursor-pointer accent-accent"
              min={retrievedDocumentsMin}
              max={retrievedDocumentsMax}
              step={1}
              type="range"
              value={maxRetrievedDocuments}
              onChange={(event) =>
                onMaxRetrievedDocumentsChange(Number(event.target.value))
              }
            />
            <div className="mt-1 flex justify-between text-[11px] text-subtle">
              <span>{retrievedDocumentsMin}</span>
              <span>{retrievedDocumentsMax}</span>
            </div>
          </div>
        ) : (
          <div className="mt-3 rounded-control bg-surface-muted px-3 py-2 text-xs text-muted">
            Selected documents are read directly.
          </div>
        )}
      </div>

      <div className="max-h-[calc(100vh-280px)] overflow-y-auto p-2">
        {indexedDocuments.length === 0 ? (
          <div className="px-2 py-8 text-center">
            <FileText className="mx-auto size-6 text-subtle" />
            <p className="mt-2 text-[13px] font-medium text-ink">
              No indexed documents
            </p>
            <p className="mt-1 text-xs leading-5 text-muted">
              Import and index documents before chatting.
            </p>
          </div>
        ) : scopeMode === "all" ? (
          filteredIndexedDocuments.length === 0 ? (
            <div className="px-2 py-8 text-center text-[13px] text-muted">
              No documents match the filter.
            </div>
          ) : (
            <div className="space-y-1">
              {filteredIndexedDocuments.map((document) => {
                const { stem, ext } = splitName(document.name);
                const folderName = document.folderId
                  ? folderNameById.get(document.folderId)
                  : null;
                return (
                  <div
                    key={document.id}
                    className="flex items-start gap-3 rounded-control px-2 py-2"
                  >
                    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] bg-surface-muted text-subtle">
                      <FileText className="size-3" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-ink">
                        {stem}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {typeLabel(ext)} · {document.size}
                        {folderName ? ` · ${folderName}` : ""}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          )
        ) : scopeMode === "folders" ? (
          filteredIndexedFolders.length === 0 ? (
            <div className="px-2 py-8 text-center text-[13px] text-muted">
              No indexed folders match the filter.
            </div>
          ) : (
            <div className="space-y-1">
              {filteredIndexedFolders.map(({ folder, count }) => (
                <label
                  key={folder.id}
                  className="flex cursor-pointer items-start gap-3 rounded-control px-2 py-2 transition hover:bg-surface-muted"
                >
                  <input
                    className="sr-only"
                    checked={selectedFolderSet.has(folder.id)}
                    type="checkbox"
                    onChange={() => onToggleFolder(folder.id)}
                  />
                  <span
                    className={cx(
                      "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] border",
                      selectedFolderSet.has(folder.id)
                        ? "border-accent bg-accent text-white"
                        : "border-line-strong bg-surface",
                    )}
                  >
                    {selectedFolderSet.has(folder.id) && (
                      <Check className="size-3" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-ink">
                      {folder.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {plural(count, "indexed document")}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )
        ) : filteredIndexedDocuments.length === 0 ? (
          <div className="px-2 py-8 text-center text-[13px] text-muted">
            No documents match the filter.
          </div>
        ) : (
          <div className="space-y-1">
            {filteredIndexedDocuments.map((document) => {
              const { stem, ext } = splitName(document.name);
              return (
              <label
                key={document.id}
                className="flex cursor-pointer items-start gap-3 rounded-control px-2 py-2 transition hover:bg-surface-muted"
              >
                <input
                  className="sr-only"
                  checked={selectedDocumentSet.has(document.id)}
                  type="checkbox"
                  onChange={() => onToggleDocument(document.id)}
                />
                <span
                  className={cx(
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] border",
                    selectedDocumentSet.has(document.id)
                      ? "border-accent bg-accent text-white"
                      : "border-line-strong bg-surface",
                  )}
                >
                  {selectedDocumentSet.has(document.id) && (
                    <Check className="size-3" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-ink">
                    {stem}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {typeLabel(ext)} · {document.size}
                  </span>
                </span>
              </label>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}