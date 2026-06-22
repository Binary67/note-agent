import { type Dispatch, type SetStateAction, useCallback, useState } from "react";
import type {
  DeleteResponse,
  DocumentUpdateResponse,
  FolderRecord,
  UploadItem,
} from "@/app/types";
import { normalizeFolderName } from "@/lib/folders";
import { parseJson } from "@/lib/utils";

type UseDocumentActionsParams = {
  setUploads: Dispatch<SetStateAction<UploadItem[]>>;
  setFolders: Dispatch<SetStateAction<FolderRecord[]>>;
  setNotice: Dispatch<SetStateAction<string>>;
  setSelectedDocumentIds: Dispatch<SetStateAction<string[]>>;
};

export function useDocumentActions({
  setUploads,
  setFolders,
  setNotice,
  setSelectedDocumentIds,
}: UseDocumentActionsParams) {
  const [renameTarget, setRenameTarget] = useState<UploadItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UploadItem | null>(null);

  const openRename = useCallback((target: UploadItem) => {
    setRenameTarget(target);
  }, []);

  const openDelete = useCallback((target: UploadItem) => {
    setDeleteTarget(target);
  }, []);

  const confirmRename = useCallback(async (nextName: string) => {
    const target = renameTarget;

    if (!target || !nextName.trim() || nextName.trim() === target.name) {
      setRenameTarget(null);
      return;
    }

    try {
      const data = await parseJson<DocumentUpdateResponse>(
        await fetch(`/api/documents/${target.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: nextName.trim() }),
        }),
      );
      setUploads((current) =>
        current.map((upload) =>
          upload.id === target.id ? { ...upload, name: data.document.name } : upload,
        ),
      );
      setFolders(data.folders);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to rename document.");
    } finally {
      setRenameTarget(null);
    }
  }, [renameTarget, setFolders, setNotice, setUploads]);

  const assignDocumentFolder = useCallback(
    async (target: UploadItem, folderName: string | null) => {
      try {
        const data = await parseJson<DocumentUpdateResponse>(
          await fetch(`/api/documents/${target.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              folderName: folderName === null ? null : normalizeFolderName(folderName),
            }),
          }),
        );
        setUploads((current) =>
          current.map((upload) =>
            upload.id === target.id ? { ...upload, folderId: data.document.folderId } : upload,
          ),
        );
        setFolders(data.folders);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Failed to update folder.");
      }
    },
    [setFolders, setNotice, setUploads],
  );

  const confirmDelete = useCallback(async () => {
    const target = deleteTarget;

    if (!target) {
      return;
    }

    try {
      await parseJson<DeleteResponse>(
        await fetch(`/api/documents/${target.id}`, { method: "DELETE" }),
      );
      setUploads((current) => current.filter((upload) => upload.id !== target.id));
      setSelectedDocumentIds((current) =>
        current.filter((selectedId) => selectedId !== target.id),
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to remove document.");
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, setNotice, setSelectedDocumentIds, setUploads]);

  return {
    renameTarget,
    setRenameTarget,
    deleteTarget,
    setDeleteTarget,
    openRename,
    openDelete,
    confirmRename,
    assignDocumentFolder,
    confirmDelete,
  };
}
