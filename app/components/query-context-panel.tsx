"use client";

import { FileText, Search } from "lucide-react";
import { ContextTree } from "@/app/components/context-tree";
import { plural } from "@/lib/utils";
import type { FolderRecord, UploadItem } from "@/app/types";

const retrievedDocumentsMin = 1;
const retrievedDocumentsMax = 10;

export type QueryContextPanelProps = {
  documentFilter: string;
  onDocumentFilterChange: (value: string) => void;
  maxRetrievedDocuments: number;
  onMaxRetrievedDocumentsChange: (value: number) => void;
  indexedDocuments: UploadItem[];
  filteredIndexedFolders: Array<{ folder: FolderRecord; count: number }>;
  documentsByFolder: Map<string, UploadItem[]>;
  selectedFolderIds: string[];
  selectedDocumentIds: string[];
  folderNameById: Map<string, string>;
  onToggleFolder: (folderId: string) => void;
  onToggleDocument: (docId: string) => void;
};

export function QueryContextPanel({
  documentFilter,
  onDocumentFilterChange,
  maxRetrievedDocuments,
  onMaxRetrievedDocumentsChange,
  indexedDocuments,
  filteredIndexedFolders,
  documentsByFolder,
  selectedFolderIds,
  selectedDocumentIds,
  folderNameById,
  onToggleFolder,
  onToggleDocument,
}: QueryContextPanelProps) {
  const hasFoldersSelected = selectedFolderIds.length > 0;
  const hasDocsSelected = selectedDocumentIds.length > 0;
  const hasSelection = hasFoldersSelected || hasDocsSelected;
  const pureFullRead = hasDocsSelected && !hasFoldersSelected;

  const selectedFolderNames = selectedFolderIds
    .map((folderId) => folderNameById.get(folderId))
    .filter((name): name is string => name !== undefined);
  const folderScopeTitle =
    selectedFolderNames.length === 1
      ? selectedFolderNames[0]
      : plural(selectedFolderIds.length, "folder");
  const activeScopeTitle = hasSelection
    ? [
        hasFoldersSelected ? folderScopeTitle : null,
        hasDocsSelected ? plural(selectedDocumentIds.length, "document") : null,
      ]
      .filter(Boolean)
      .join(" + ")
    : "All documents";
  const activeScopeDescription =
    hasFoldersSelected && hasDocsSelected
      ? "Retrieving from folders plus direct documents."
      : hasFoldersSelected
        ? "Retrieving from selected folders."
        : hasDocsSelected
          ? "Selected documents are read directly."
          : "Hybrid retrieval chooses full documents.";

  return (
    <aside className="overflow-hidden rounded-panel border border-line bg-surface shadow-panel">
      <div className="border-b border-line p-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle">
            Sources
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
            placeholder="Filter folders & documents"
            value={documentFilter}
            onChange={(event) => onDocumentFilterChange(event.target.value)}
          />
        </label>

        {!pureFullRead ? (
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
        ) : null}
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
        ) : (
          <ContextTree
            folders={filteredIndexedFolders}
            documentsByFolder={documentsByFolder}
            filter={documentFilter}
            selectedFolderIds={selectedFolderIds}
            selectedDocumentIds={selectedDocumentIds}
            onToggleFolder={onToggleFolder}
            onToggleDocument={onToggleDocument}
          />
        )}
      </div>
    </aside>
  );
}
