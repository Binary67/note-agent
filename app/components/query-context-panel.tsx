"use client";

import { FileText, Search } from "lucide-react";
import { ContextTree } from "@/app/components/context-tree";
import { plural } from "@/lib/utils";
import type { FolderRecord, UploadItem } from "@/app/types";

export type QueryContextPanelProps = {
  documentFilter: string;
  onDocumentFilterChange: (value: string) => void;
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

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-panel border border-line bg-surface shadow-panel">
      <div className="border-b border-line px-4 py-3.5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle">
            Context
          </p>
          <h2 className="mt-1 truncate text-base font-semibold text-ink">
            {activeScopeTitle}
          </h2>
        </div>
      </div>

      <div className="border-b border-line p-3">
        <label className="flex h-9 items-center gap-2 rounded-control border border-line bg-surface px-3 text-[13px] text-muted focus-within:border-line-strong">
          <Search className="size-4 text-subtle" />
          <input
            className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-subtle"
            placeholder="Search documents"
            value={documentFilter}
            onChange={(event) => onDocumentFilterChange(event.target.value)}
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {indexedDocuments.length === 0 ? (
          <div className="px-2 py-8 text-center">
            <FileText className="mx-auto size-6 text-subtle" />
            <p className="mt-2 text-[13px] font-medium text-ink">
              No documents indexed
            </p>
            <p className="mt-1 text-xs leading-5 text-muted">
              Index documents first.
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
