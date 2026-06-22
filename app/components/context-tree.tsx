"use client";

import {
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  FolderClosed,
  FolderOpen,
  Minus,
} from "lucide-react";
import { useState } from "react";
import { cx } from "@/app/components/ui";
import { plural, splitName, typeLabel } from "@/lib/utils";
import type { FolderRecord, UploadItem } from "@/app/types";

export type ContextTreeProps = {
  folders: Array<{ folder: FolderRecord; count: number }>;
  documentsByFolder: Map<string, UploadItem[]>;
  filter: string;
  selectedFolderIds: string[];
  selectedDocumentIds: string[];
  onToggleFolder: (folderId: string) => void;
  onToggleDocument: (docId: string) => void;
};

export function ContextTree({
  folders,
  documentsByFolder,
  filter,
  selectedFolderIds,
  selectedDocumentIds,
  onToggleFolder,
  onToggleDocument,
}: ContextTreeProps) {
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

  const selectedFolderSet = new Set(selectedFolderIds);
  const selectedDocumentSet = new Set(selectedDocumentIds);
  const query = filter.trim().toLowerCase();

  const matchingFolders = folders.filter(({ folder }) => {
    const childDocs = documentsByFolder.get(folder.id) ?? [];
    if (query) {
      const folderMatches = folder.name.toLowerCase().includes(query);
      const childMatches = childDocs.some((document) =>
        document.name.toLowerCase().includes(query),
      );
      return folderMatches || childMatches;
    }
    return true;
  });

  function toggleCollapse(folderId: string) {
    setCollapsedFolders((current) => {
      const next = new Set(current);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }

  if (matchingFolders.length === 0) {
    return (
      <div className="px-2 py-8 text-center text-[13px] text-muted">
        No indexed folders match the filter.
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {matchingFolders.map(({ folder, count }) => {
        const childDocs = documentsByFolder.get(folder.id) ?? [];
        const childDocIds = childDocs.map((document) => document.id);
        const checkedChildren = childDocIds.filter((id) =>
          selectedDocumentSet.has(id),
        );
        const folderChecked = selectedFolderSet.has(folder.id);
        const indeterminate =
          !folderChecked && checkedChildren.length > 0;
        const collapsed = collapsedFolders.has(folder.id);
        const folderMatchesQuery =
          query.length > 0 && folder.name.toLowerCase().includes(query);
        const visibleDocs = query
          ? folderMatchesQuery
            ? childDocs
            : childDocs.filter((document) =>
                document.name.toLowerCase().includes(query),
              )
          : childDocs;
        const FolderIcon = collapsed ? FolderClosed : FolderOpen;

        return (
          <div key={folder.id}>
            <div
              className={cx(
                "group flex items-center gap-1 rounded-control px-1.5 py-1.5 transition",
                folderChecked ? "bg-accent-soft" : "hover:bg-surface-muted",
              )}
            >
              <button
                className="flex size-6 shrink-0 items-center justify-center rounded-[6px] text-subtle transition hover:bg-surface"
                type="button"
                aria-label={collapsed ? "Expand folder" : "Collapse folder"}
                onClick={() => toggleCollapse(folder.id)}
              >
                {collapsed ? (
                  <ChevronRight className="size-3.5" />
                ) : (
                  <ChevronDown className="size-3.5" />
                )}
              </button>
              <button
                className="flex min-w-0 flex-1 items-center gap-2 rounded-[7px] px-1 py-0.5 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-accent/25"
                type="button"
                aria-pressed={folderChecked}
                onClick={() => onToggleFolder(folder.id)}
              >
                <span
                  className={cx(
                    "flex size-6 shrink-0 items-center justify-center rounded-[6px]",
                    folderChecked ? "text-accent" : "text-subtle",
                  )}
                >
                  <FolderIcon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">
                    {folder.name}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {plural(count, "indexed document")}
                  </span>
                </span>
                {folderChecked && (
                  <span className="ml-auto flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-white">
                    <Check className="size-3.5" />
                  </span>
                )}
                {indeterminate && (
                  <span className="ml-auto flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                    <Minus className="size-3.5" />
                  </span>
                )}
              </button>
            </div>

            {!collapsed && visibleDocs.length > 0 && (
              <div className="ml-8 mt-0.5 space-y-0.5 border-l border-line pl-2">
                {visibleDocs.map((document) => {
                  const { stem, ext } = splitName(document.name);
                  const docChecked =
                    !folderChecked && selectedDocumentSet.has(document.id);
                  return (
                    <button
                      key={document.id}
                      className={cx(
                        "group/document flex w-full min-w-0 items-center gap-2 rounded-control px-2 py-1.5 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-accent/25",
                        docChecked
                          ? "bg-surface-muted"
                          : folderChecked
                            ? "text-muted"
                            : "hover:bg-surface-muted",
                      )}
                      type="button"
                      aria-pressed={docChecked}
                      disabled={folderChecked}
                      onClick={() => onToggleDocument(document.id)}
                    >
                      <FileText
                        className={cx(
                          "size-3.5 shrink-0",
                          docChecked ? "text-accent" : "text-subtle",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className={cx(
                            "block truncate text-[13px] font-medium",
                            folderChecked ? "text-muted" : "text-ink",
                          )}
                        >
                          {stem}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted">
                          {typeLabel(ext)} · {document.size}
                        </span>
                      </span>
                      {docChecked && (
                        <Check className="ml-auto size-4 shrink-0 text-accent" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
