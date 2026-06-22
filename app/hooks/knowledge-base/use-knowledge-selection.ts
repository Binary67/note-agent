import { useCallback, useMemo, useState } from "react";
import type { UploadItem } from "@/app/types";

type UseKnowledgeSelectionParams = {
  indexedDocumentIds: Set<string>;
  indexedFolderIds: Set<string>;
  documentsByFolder: Map<string, UploadItem[]>;
};

export function useKnowledgeSelection({
  indexedDocumentIds,
  indexedFolderIds,
  documentsByFolder,
}: UseKnowledgeSelectionParams) {
  const [storedSelectedFolderIds, setSelectedFolderIds] = useState<string[]>([]);
  const [storedSelectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);

  const selectedDocumentIds = useMemo(
    () => storedSelectedDocumentIds.filter((id) => indexedDocumentIds.has(id)),
    [indexedDocumentIds, storedSelectedDocumentIds],
  );

  const selectedFolderIds = useMemo(
    () => storedSelectedFolderIds.filter((id) => indexedFolderIds.has(id)),
    [indexedFolderIds, storedSelectedFolderIds],
  );

  const toggleDocument = useCallback((id: string) => {
    setSelectedDocumentIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id],
    );
  }, []);

  const toggleFolder = useCallback(
    (folderId: string) => {
      const childDocIds = (documentsByFolder.get(folderId) ?? []).map(
        (document) => document.id,
      );
      const childSet = new Set(childDocIds);

      setSelectedFolderIds((current) =>
        current.includes(folderId)
          ? current.filter((selectedId) => selectedId !== folderId)
          : [...current, folderId],
      );
      setSelectedDocumentIds((current) =>
        current.filter((id) => !childSet.has(id)),
      );
    },
    [documentsByFolder],
  );

  return {
    selectedFolderIds,
    setSelectedFolderIds,
    selectedDocumentIds,
    setSelectedDocumentIds,
    toggleDocument,
    toggleFolder,
  };
}
