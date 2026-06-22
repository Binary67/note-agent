"use client";

import {
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { normalizeFolderName } from "@/lib/folders";
import {
  createId,
  createInitialMessages,
  isSupportedSourceFile,
  parseJson,
  plural,
} from "@/lib/utils";
import type {
  ChatMessage,
  ChatResponse,
  DeleteResponse,
  DocumentUpdateResponse,
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

export function useKnowledgeBase() {
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const uploadProgressPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
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
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [maxRetrievedDocuments, setMaxRetrievedDocuments] = useState(3);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(createInitialMessages);
  const [isAnswering, setIsAnswering] = useState(false);
  const [renameTarget, setRenameTarget] = useState<UploadItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UploadItem | null>(null);
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
    void refresh();
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

  useEffect(() => {
    setSelectedDocumentIds((current) =>
      current.filter((id) => indexedDocumentIds.has(id)),
    );
  }, [indexedDocumentIds]);

  useEffect(() => {
    setSelectedFolderIds((current) => current.filter((id) => indexedFolderIds.has(id)));
  }, [indexedFolderIds]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [isAnswering, messages]);

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
        description: "Remove failed documents or upload a clean file before retrying.",
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
    setNotice("Ingestion started. Processing ready documents...");

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
  }, [importTarget, isImporting, isIngesting, stats.ingesting, stopPolling]);

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
  }, [renameTarget]);

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
    [],
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
  }, [deleteTarget]);

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

  const resetChat = useCallback(() => {
    setActiveView("chat");
    setChatInput("");
    setMessages(createInitialMessages());
    setIsAnswering(false);
  }, []);

  const submitChat = useCallback(async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();

    const question = chatInput.trim();

    if (!question || isAnswering || indexedDocuments.length === 0) {
      return;
    }

    setChatInput("");
    setIsAnswering(true);
    setMessages((current) => [
      ...current,
      { id: createId("user"), role: "user", content: question },
    ]);

    try {
      const data = await parseJson<ChatResponse>(
        await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            selectedDocumentIds,
            selectedFolderIds,
            maxRetrievedDocuments,
          }),
        }),
      );

      setMessages((current) => [
        ...current,
        {
          id: createId("assistant"),
          role: "assistant",
          content: data.answer,
          documents: data.documents,
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: createId("assistant"),
          role: "assistant",
          content:
            error instanceof Error
              ? error.message
              : "Failed to answer the question.",
        },
      ]);
    } finally {
      setIsAnswering(false);
    }
  }, [chatInput, isAnswering, indexedDocuments.length, selectedFolderIds, selectedDocumentIds, maxRetrievedDocuments]);

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
    maxRetrievedDocuments,
    setMaxRetrievedDocuments,
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
