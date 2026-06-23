import { useMemo } from "react";
import type { FolderRecord, UploadItem } from "@/app/types";
import { plural } from "@/lib/utils";

type UseKnowledgeBaseDerivedParams = {
  uploads: UploadItem[];
  folders: FolderRecord[];
  documentFilter: string;
  isIngesting: boolean;
};

export function useKnowledgeBaseDerived({
  uploads,
  folders,
  documentFilter,
  isIngesting,
}: UseKnowledgeBaseDerivedParams) {
  const indexedDocuments = useMemo(
    () => uploads.filter((upload) => upload.status === "Indexed"),
    [uploads],
  );
  const indexedDocumentIds = useMemo(
    () => new Set(indexedDocuments.map((document) => document.id)),
    [indexedDocuments],
  );
  const folderNameById = useMemo(
    () => new Map(folders.map((folder) => [folder.id, folder.name])),
    [folders],
  );
  const indexedFolderCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const document of indexedDocuments) {
      if (document.folderId) {
        counts.set(document.folderId, (counts.get(document.folderId) ?? 0) + 1);
      }
    }

    return counts;
  }, [indexedDocuments]);
  const indexedFolderIds = useMemo(
    () => new Set(indexedFolderCounts.keys()),
    [indexedFolderCounts],
  );

  const documentsByFolder = useMemo(() => {
    const groups = new Map<string, UploadItem[]>();

    for (const document of indexedDocuments) {
      if (document.folderId) {
        const existing = groups.get(document.folderId);
        if (existing) {
          existing.push(document);
        } else {
          groups.set(document.folderId, [document]);
        }
      }
    }

    return groups;
  }, [indexedDocuments]);

  const filteredIndexedDocuments = useMemo(() => {
    const query = documentFilter.trim().toLowerCase();

    if (!query) {
      return indexedDocuments;
    }

    return indexedDocuments.filter((document) =>
      document.name.toLowerCase().includes(query),
    );
  }, [documentFilter, indexedDocuments]);

  const indexedFolderOptions = useMemo(
    () =>
      folders
        .map((folder) => ({
          folder,
          count: indexedFolderCounts.get(folder.id) ?? 0,
        }))
        .filter((item) => item.count > 0),
    [folders, indexedFolderCounts],
  );

  const filteredIndexedFolders = useMemo(() => {
    const query = documentFilter.trim().toLowerCase();

    if (!query) {
      return indexedFolderOptions;
    }

    return indexedFolderOptions.filter(({ folder }) =>
      folder.name.toLowerCase().includes(query),
    );
  }, [documentFilter, indexedFolderOptions]);

  const stats = useMemo(
    () => ({
      total: uploads.length,
      indexed: uploads.filter((upload) => upload.status === "Indexed").length,
      ingesting: uploads.filter((upload) => upload.status === "Ingesting").length,
      ready: uploads.filter((upload) => upload.status === "Ready").length,
      errors: uploads.filter((upload) => upload.status === "Error").length,
    }),
    [uploads],
  );

  const unassignedReadyCount = useMemo(
    () =>
      uploads.filter((upload) => upload.status === "Ready" && !upload.folderId)
        .length,
    [uploads],
  );

  const readiness = useMemo(() => {
    if (isIngesting || stats.ingesting > 0) {
      return {
        label: "Indexing",
        title: "Indexing documents",
        description: "Parsing, chunking, embedding, and saving local index files.",
        tone: "accent" as const,
      };
    }

    if (stats.ready > 0) {
      return {
        label: "Ready",
        title: `${stats.ready} ready to index`,
        description: "Start indexing to make the staged documents searchable.",
        tone: "accent" as const,
      };
    }

    if (stats.errors > 0) {
      return {
        label: "Review",
        title: `${stats.errors} indexing issue${stats.errors === 1 ? "" : "s"}`,
        description: "Retry failed documents or remove files that keep failing.",
        tone: "danger" as const,
      };
    }

    if (stats.indexed > 0) {
      return {
        label: "Indexed",
        title: "All files indexed",
        description: "The local index is up to date for all uploaded files.",
        tone: "success" as const,
      };
    }

    return {
      label: "Idle",
      title: "No documents staged",
      description: "Import documents to prepare the knowledge base.",
      tone: "neutral" as const,
    };
  }, [isIngesting, stats]);

  const indexActive = isIngesting || stats.ingesting > 0;
  const indexComplete = stats.indexed > 0;
  const indexSteps = [
    {
      label: "Uploaded",
      detail: stats.total > 0 ? plural(stats.total, "file") : "Waiting for files",
      state: stats.total > 0 ? "complete" : "waiting",
    },
    {
      label: "Parsed",
      detail: indexComplete ? "Text extracted" : indexActive ? "In progress" : "Waiting",
      state: indexComplete ? "complete" : indexActive ? "active" : "waiting",
    },
    {
      label: "Chunked",
      detail: indexComplete ? "Segments prepared" : indexActive ? "In progress" : "Waiting",
      state: indexComplete ? "complete" : indexActive ? "active" : "waiting",
    },
    {
      label: "Embedded",
      detail: indexComplete ? "Vectors saved" : indexActive ? "In progress" : "Waiting",
      state: indexComplete ? "complete" : indexActive ? "active" : "waiting",
    },
    {
      label: "Indexed",
      detail: indexComplete ? plural(stats.indexed, "searchable file") : "Waiting",
      state: indexComplete ? "complete" : "waiting",
    },
  ] as const;

  return {
    indexedDocuments,
    indexedDocumentIds,
    indexedFolderIds,
    documentsByFolder,
    folderNameById,
    filteredIndexedDocuments,
    filteredIndexedFolders,
    stats,
    unassignedReadyCount,
    readiness,
    indexSteps,
  };
}
