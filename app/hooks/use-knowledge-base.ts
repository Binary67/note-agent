"use client";

import {
  type ChangeEvent,
  type DragEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useDocumentActions } from "@/app/hooks/knowledge-base/use-document-actions";
import { useKnowledgeBaseDerived } from "@/app/hooks/knowledge-base/use-knowledge-base-derived";
import { useKnowledgeChat } from "@/app/hooks/knowledge-base/use-knowledge-chat";
import { useKnowledgeSelection } from "@/app/hooks/knowledge-base/use-knowledge-selection";
import type {
  FolderRecord,
  IngestResponse,
  KnowledgeImportResponse,
  ListResponse,
  UploadItem,
  UploadProgress,
  UploadProgressResponse,
  UploadResponse,
  ViewKey,
} from "@/app/types";
import {
  createId,
  createInitialMessages,
  isSupportedSourceFile,
  parseJson,
  plural,
} from "@/lib/utils";

export function useKnowledgeBase() {
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const uploadProgressPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [activeView, setActiveView] = useState<ViewKey>("ingestion");
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [folders, setFolders] = useState<FolderRecord[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [isIngesting, setIsIngesting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [notice, setNotice] = useState("Drop text, PDF, or audio files here.");
  const [documentFilter, setDocumentFilter] = useState("");
  const [isContextCollapsed, setIsContextCollapsed] = useState(false);
  const [importTarget, setImportTarget] = useState<File | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await parseJson<ListResponse>(await fetch("/api/documents"));
      setUploads(data.documents);
      setFolders(data.folders);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to load documents.");
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(refresh);
  }, [refresh]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  const stopUploadProgressPolling = useCallback(() => {
    if (uploadProgressPollRef.current) {
      clearInterval(uploadProgressPollRef.current);
      uploadProgressPollRef.current = null;
    }
  }, []);

  useEffect(() => stopUploadProgressPolling, [stopUploadProgressPolling]);

  const pollUploadProgress = useCallback(async (jobId: string) => {
    try {
      const data = await parseJson<UploadProgressResponse>(
        await fetch(`/api/documents/progress?jobId=${encodeURIComponent(jobId)}`, {
          cache: "no-store",
        }),
      );

      if (!data.progress) {
        return;
      }

      setUploadProgress(data.progress);

      if (data.progress.status !== "active") {
        stopUploadProgressPolling();
      }
    } catch {
      // The upload request reports the user-facing error; progress polling is best-effort.
    }
  }, [stopUploadProgressPolling]);

  const startUploadProgressPolling = useCallback((jobId: string) => {
    stopUploadProgressPolling();
    uploadProgressPollRef.current = setInterval(() => {
      void pollUploadProgress(jobId);
    }, 700);
    void pollUploadProgress(jobId);
  }, [pollUploadProgress, stopUploadProgressPolling]);

  const {
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
  } = useKnowledgeBaseDerived({
    uploads,
    folders,
    documentFilter,
    isIngesting,
  });

  const {
    selectedFolderIds,
    setSelectedFolderIds,
    selectedDocumentIds,
    setSelectedDocumentIds,
    toggleDocument,
    toggleFolder,
  } = useKnowledgeSelection({
    indexedDocumentIds,
    indexedFolderIds,
    documentsByFolder,
  });

  const {
    chatInput,
    setChatInput,
    messages,
    setMessages,
    isAnswering,
    messagesEndRef,
    resetChat,
    submitChat,
  } = useKnowledgeChat({
    indexedDocumentsLength: indexedDocuments.length,
    selectedFolderIds,
    selectedDocumentIds,
    setActiveView,
  });

  const {
    renameTarget,
    setRenameTarget,
    deleteTarget,
    setDeleteTarget,
    openRename,
    openDelete,
    confirmRename,
    assignDocumentFolder,
    confirmDelete,
  } = useDocumentActions({
    setUploads,
    setFolders,
    setNotice,
    setSelectedDocumentIds,
  });

  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList) {
      return;
    }

    const files = Array.from(fileList);
    const sourceFiles = files.filter(isSupportedSourceFile);

    if (sourceFiles.length === 0) {
      setNotice("Only .txt, .pdf, and supported audio files are supported.");
      return;
    }

    const jobId = createId("upload");

    setIsUploading(true);
    setUploadProgress({
      jobId,
      status: "active",
      percent: 0,
      label: "Starting upload",
      detail: null,
      updatedAt: Date.now(),
    });
    startUploadProgressPolling(jobId);

    try {
      const formData = new FormData();
      for (const file of sourceFiles) {
        formData.append("files", file);
      }

      const data = await parseJson<UploadResponse>(
        await fetch(`/api/documents?jobId=${encodeURIComponent(jobId)}`, {
          method: "POST",
          body: formData,
        }),
      );
      setUploads((current) => [...data.documents, ...current]);
      setFolders(data.folders);
      setNotice(`${plural(sourceFiles.length, "file")} added to the ingestion queue.`);
      setActiveView("ingestion");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      stopUploadProgressPolling();
      setUploadProgress(null);
      setIsUploading(false);
    }
  }, [startUploadProgressPolling, stopUploadProgressPolling]);

  const handleInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    void handleFiles(event.target.files);
    event.target.value = "";
  }, [handleFiles]);

  const handleDrop = useCallback((event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    void handleFiles(event.dataTransfer.files);
  }, [handleFiles]);

  const startIngestion = useCallback(async () => {
    setIsIngesting(true);
    setNotice("Ingestion started. Processing queued documents...");

    try {
      await parseJson<IngestResponse>(await fetch("/api/ingest", { method: "POST" }));

      pollRef.current = setInterval(async () => {
        await refresh();
        const stillIngesting = (await parseJson<ListResponse>(await fetch("/api/documents")))
          .documents.some((doc) => doc.status === "Ingesting");

        if (!stillIngesting) {
          stopPolling();
          setIsIngesting(false);
          setNotice("Ingestion complete.");
        }
      }, 2000);
    } catch (error) {
      setIsIngesting(false);
      setNotice(error instanceof Error ? error.message : "Ingestion failed to start.");
    }
  }, [refresh, stopPolling]);

  const exportKnowledgeBase = useCallback(async () => {
    if (isIngesting || stats.ingesting > 0) {
      setNotice("Wait for indexing to finish before exporting.");
      return;
    }

    setIsExporting(true);

    try {
      const response = await fetch("/api/knowledge/export");

      if (!response.ok) {
        await parseJson<unknown>(response);
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = `knowledge-base-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setNotice("Knowledge base exported.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setIsExporting(false);
    }
  }, [isIngesting, stats.ingesting]);

  const importKnowledgeBase = useCallback((file: File | null) => {
    if (!file) {
      return;
    }

    if (isIngesting || stats.ingesting > 0) {
      setNotice("Wait for indexing to finish before importing.");
      return;
    }

    if (!file.name.toLowerCase().endsWith(".zip")) {
      setNotice("Select a knowledge base zip file.");
      return;
    }

    setImportTarget(file);
  }, [isIngesting, stats.ingesting]);

  const confirmImportKnowledgeBase = useCallback(async () => {
    const file = importTarget;

    if (!file || isImporting) {
      return;
    }

    if (isIngesting || stats.ingesting > 0) {
      setNotice("Wait for indexing to finish before importing.");
      return;
    }

    setIsImporting(true);
    stopPolling();
    setIsIngesting(false);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const data = await parseJson<KnowledgeImportResponse>(
        await fetch("/api/knowledge/import", { method: "POST", body: formData }),
      );

      setUploads(data.documents);
      setFolders(data.folders);
      setSelectedFolderIds([]);
      setSelectedDocumentIds([]);
      setChatInput("");
      setMessages(createInitialMessages());
      setActiveView("ingestion");
      setNotice(`${plural(data.imported, "document")} imported.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setIsImporting(false);
      setImportTarget(null);
    }
  }, [
    importTarget,
    isImporting,
    isIngesting,
    setChatInput,
    setMessages,
    setSelectedDocumentIds,
    setSelectedFolderIds,
    stats.ingesting,
    stopPolling,
  ]);

  return {
    activeView,
    setActiveView,
    uploads,
    folders,
    isDragging,
    setIsDragging,
    isUploading,
    uploadProgress,
    isIngesting,
    isExporting,
    isImporting,
    notice,
    documentFilter,
    setDocumentFilter,
    isContextCollapsed,
    setIsContextCollapsed,
    selectedFolderIds,
    selectedDocumentIds,
    chatInput,
    setChatInput,
    messages,
    isAnswering,
    renameTarget,
    setRenameTarget,
    deleteTarget,
    setDeleteTarget,
    importTarget,
    setImportTarget,
    indexedDocuments,
    documentsByFolder,
    folderNameById,
    filteredIndexedDocuments,
    filteredIndexedFolders,
    stats,
    unassignedReadyCount,
    readiness,
    indexSteps,
    messagesEndRef,
    handleInputChange,
    handleDrop,
    startIngestion,
    exportKnowledgeBase,
    importKnowledgeBase,
    confirmImportKnowledgeBase,
    openRename,
    openDelete,
    confirmRename,
    assignDocumentFolder,
    confirmDelete,
    toggleDocument,
    toggleFolder,
    resetChat,
    submitChat,
  };
}
