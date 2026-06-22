"use client";

import {
  Bot,
  ChartNoAxesColumn,
  Check,
  CheckCircle2,
  CircleHelp,
  CloudUpload,
  FileText,
  FolderOpen,
  MessageSquareText,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  SendHorizontal,
  Settings,
  type LucideIcon,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import {
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  cx,
  DangerButton,
  InspectorPanel,
  Modal,
  PrimaryButton,
  SecondaryButton,
  SidebarItem,
  StatusPill,
} from "@/app/components/ui";

type UploadStatus = "Ready" | "Ingesting" | "Indexed" | "Error";
type ViewKey = "ingestion" | "chat";

type UploadItem = {
  id: string;
  name: string;
  size: string;
  status: UploadStatus;
  uploadedAt: string;
};

type ChatDocument = {
  id: string;
  name: string;
  source: "selected" | "retrieved";
  score?: number;
  semanticScore?: number;
  bm25Score?: number;
};

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  documents?: ChatDocument[];
};

type ListResponse = { documents: UploadItem[] };
type UploadResponse = { documents: UploadItem[] };
type IngestResponse = { started: number };
type DeleteResponse = { ok: boolean };
type RenameResponse = { document: UploadItem };
type ChatResponse = {
  answer: string;
  mode: "selected" | "retrieved";
  documents: ChatDocument[];
};

const navigationItems: Array<{
  label: string;
  icon: LucideIcon;
  view?: ViewKey;
}> = [
  { label: "Knowledge Base", icon: FolderOpen, view: "ingestion" },
  { label: "Chat Interface", icon: MessageSquareText, view: "chat" },
  { label: "Analytics", icon: ChartNoAxesColumn },
];

const retrievedDocumentsMin = 1;
const retrievedDocumentsMax = 10;

function isTextFile(file: File) {
  return file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt");
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let message = text;

    if (text) {
      try {
        const payload = JSON.parse(text) as { error?: string };
        message = payload.error ?? text;
      } catch {
        message = text;
      }
    }

    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function plural(value: number, noun: string) {
  return `${value} ${noun}${value === 1 ? "" : "s"}`;
}

function statusTone(status: UploadStatus): "neutral" | "accent" | "success" | "danger" {
  if (status === "Indexed") {
    return "success";
  }

  if (status === "Ingesting") {
    return "accent";
  }

  if (status === "Error") {
    return "danger";
  }

  return "neutral";
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createInitialMessages(): ChatMessage[] {
  return [
    {
      id: createId("assistant"),
      role: "assistant",
      content: "Ask a question about your indexed documents.",
    },
  ];
}

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [activeView, setActiveView] = useState<ViewKey>("chat");
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [notice, setNotice] = useState("Drop files here or browse from your computer.");
  const [documentFilter, setDocumentFilter] = useState("");
  const [isContextCollapsed, setIsContextCollapsed] = useState(false);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [maxRetrievedDocuments, setMaxRetrievedDocuments] = useState(3);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(createInitialMessages);
  const [isAnswering, setIsAnswering] = useState(false);
  const [renameTarget, setRenameTarget] = useState<UploadItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UploadItem | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await parseJson<ListResponse>(await fetch("/api/documents"));
      setUploads(data.documents);
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

  const indexedDocuments = useMemo(
    () => uploads.filter((upload) => upload.status === "Indexed"),
    [uploads],
  );
  const indexedDocumentIds = useMemo(
    () => new Set(indexedDocuments.map((document) => document.id)),
    [indexedDocuments],
  );

  useEffect(() => {
    setSelectedDocumentIds((current) =>
      current.filter((id) => indexedDocumentIds.has(id)),
    );
  }, [indexedDocumentIds]);

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

  const selectedDocumentSet = useMemo(
    () => new Set(selectedDocumentIds),
    [selectedDocumentIds],
  );

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

  async function handleFiles(fileList: FileList | null) {
    if (!fileList) {
      return;
    }

    const files = Array.from(fileList);
    const textFiles = files.filter(isTextFile);

    if (textFiles.length === 0) {
      setNotice("Only .txt files are supported in this first version.");
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      for (const file of textFiles) {
        formData.append("files", file);
      }

      const data = await parseJson<UploadResponse>(
        await fetch("/api/documents", { method: "POST", body: formData }),
      );
      setUploads((current) => [...data.documents, ...current]);
      setNotice(`${plural(textFiles.length, "file")} added to the ingestion queue.`);
      setActiveView("ingestion");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    void handleFiles(event.target.files);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    void handleFiles(event.dataTransfer.files);
  }

  async function startIngestion() {
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
  }

  function splitName(name: string): { stem: string; ext: string } {
    const dot = name.lastIndexOf(".");

    if (dot <= 0) {
      return { stem: name, ext: "" };
    }

    return { stem: name.slice(0, dot), ext: name.slice(dot) };
  }

  function typeLabel(ext: string): string {
    if (ext === ".txt") return "Text document";
    return "Document";
  }

  function openRename(target: UploadItem) {
    setRenameTarget(target);
  }

  function openDelete(target: UploadItem) {
    setDeleteTarget(target);
  }

  async function confirmRename(nextName: string) {
    const target = renameTarget;

    if (!target || !nextName.trim() || nextName.trim() === target.name) {
      setRenameTarget(null);
      return;
    }

    try {
      const data = await parseJson<RenameResponse>(
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
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to rename document.");
    } finally {
      setRenameTarget(null);
    }
  }

  async function confirmDelete() {
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
  }

  function toggleDocument(id: string) {
    setSelectedDocumentIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id],
    );
  }

  function resetChat() {
    setActiveView("chat");
    setChatInput("");
    setMessages(createInitialMessages());
    setIsAnswering(false);
  }

  async function submitChat(event?: FormEvent<HTMLFormElement>) {
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
  }

  function handleChatKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitChat();
    }
  }

  const chatCanSubmit =
    chatInput.trim().length > 0 && !isAnswering && indexedDocuments.length > 0;

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <div className="flex min-h-screen">
        <aside className="hidden w-[248px] shrink-0 border-r border-line bg-sidebar px-4 py-5 lg:flex lg:flex-col">
          <div className="flex items-center gap-3 px-1">
            <div className="flex size-8 items-center justify-center rounded-control bg-accent text-sm font-semibold text-white">
              R
            </div>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold leading-5 text-ink">RAG Engine</p>
              <p className="text-xs text-muted">Personal AI</p>
            </div>
          </div>

          <nav className="mt-6 space-y-1">
            {navigationItems.map((item) => (
              <SidebarItem
                key={item.label}
                active={item.view === activeView}
                icon={item.icon}
                label={item.label}
                onClick={() => item.view && setActiveView(item.view)}
              />
            ))}
          </nav>

          <div className="mt-auto border-t border-line pt-3">
            <SidebarItem icon={Settings} label="Settings" />
            <SidebarItem icon={CircleHelp} label="Help" />
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-line bg-toolbar px-4 backdrop-blur-xl md:px-6">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex size-8 items-center justify-center rounded-control bg-accent text-sm font-semibold text-white lg:hidden">
                R
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-[17px] font-semibold text-ink">
                  Knowledge Platform
                </h1>
              </div>
            </div>

            <div className="flex items-center">
              <div className="ml-1 flex size-8 items-center justify-center rounded-full bg-surface-muted text-[13px] font-semibold text-accent ring-1 ring-line">
                F
              </div>
            </div>
          </header>

          {activeView === "chat" ? (
            <div
              className={cx(
                "mx-auto grid w-full max-w-7xl flex-1 gap-5 px-5 py-5 md:px-7",
                !isContextCollapsed && "xl:grid-cols-[304px_minmax(0,1fr)]",
              )}
            >
              {!isContextCollapsed && (
                <aside className="overflow-hidden rounded-panel border border-line bg-surface shadow-panel">
                  <div className="border-b border-line p-4">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle">
                        Query Context
                      </p>
                      <h2 className="mt-1 truncate text-base font-semibold text-ink">
                        {selectedDocumentIds.length > 0
                          ? plural(selectedDocumentIds.length, "selected document")
                          : "All indexed documents"}
                      </h2>
                      <p className="mt-1 text-[13px] leading-5 text-muted">
                        {selectedDocumentIds.length > 0
                          ? "Selected documents are read directly."
                          : "Hybrid search chooses full documents to read."}
                      </p>
                    </div>
                  </div>

                  <div className="border-b border-line p-3">
                    <label className="flex h-9 items-center gap-2 rounded-control border border-line bg-surface px-3 text-[13px] text-muted focus-within:border-line-strong">
                      <Search className="size-4 text-subtle" />
                      <input
                        className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-subtle"
                        placeholder="Filter documents"
                        value={documentFilter}
                        onChange={(event) => setDocumentFilter(event.target.value)}
                      />
                    </label>

                    <button
                      className="mt-3 flex h-9 w-full items-center gap-3 rounded-control px-2 text-left text-[13px] transition hover:bg-surface-muted"
                      type="button"
                      onClick={() => setSelectedDocumentIds([])}
                    >
                      <span
                        className={cx(
                          "flex size-4 shrink-0 items-center justify-center rounded-[4px] border",
                          selectedDocumentIds.length === 0
                            ? "border-accent bg-accent text-white"
                            : "border-line-strong bg-surface",
                        )}
                      >
                        {selectedDocumentIds.length === 0 && <Check className="size-3" />}
                      </span>
                      <span className="min-w-0 flex-1 font-medium text-ink">All Documents</span>
                    </button>

                    {selectedDocumentIds.length === 0 ? (
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
                            setMaxRetrievedDocuments(Number(event.target.value))
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
                              onChange={() => toggleDocument(document.id)}
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
              )}

              <section className="flex min-h-[calc(100vh-96px)] min-w-0 flex-col overflow-hidden rounded-panel border border-line bg-surface shadow-panel">
                <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
                  <div className="flex min-w-0 items-center gap-2">
                    <button
                      className="flex size-8 shrink-0 items-center justify-center rounded-control border border-line bg-surface text-subtle shadow-sm transition hover:border-line-strong hover:bg-surface-muted hover:text-ink"
                      type="button"
                      aria-label={
                        isContextCollapsed
                          ? "Show query context"
                          : "Collapse query context"
                      }
                      onClick={() => setIsContextCollapsed((current) => !current)}
                    >
                      {isContextCollapsed ? (
                        <PanelLeftOpen className="size-4" />
                      ) : (
                        <PanelLeftClose className="size-4" />
                      )}
                    </button>
                    <div className="min-w-0">
                      <h2 className="truncate text-[15px] font-semibold text-ink">
                        Knowledge Chat
                      </h2>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {selectedDocumentIds.length > 0
                          ? "Answering from selected full documents"
                          : `Answering from top ${maxRetrievedDocuments} retrieved full documents`}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      className="flex h-8 items-center gap-1.5 rounded-control border border-line bg-surface px-2.5 text-[13px] font-medium text-ink shadow-sm transition hover:border-line-strong hover:bg-surface-muted"
                      type="button"
                      aria-label="New chat"
                      onClick={resetChat}
                    >
                      <Plus className="size-3.5" />
                      <span className="hidden sm:inline">New Chat</span>
                    </button>
                    <span className="hidden sm:inline-flex">
                      <StatusPill tone={selectedDocumentIds.length > 0 ? "accent" : "neutral"}>
                        {selectedDocumentIds.length > 0 ? "Selected Scope" : "Hybrid Retrieval"}
                      </StatusPill>
                    </span>
                  </div>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
                  {messages.map((message) => (
                    <ChatMessageBubble key={message.id} message={message} />
                  ))}

                  {isAnswering && (
                    <div className="flex items-start gap-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                        <Bot className="size-4" />
                      </span>
                      <div className="rounded-panel border border-line bg-surface px-3 py-2 text-[13px] text-muted shadow-sm">
                        Reading documents...
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <form className="shrink-0 border-t border-line p-4" onSubmit={submitChat}>
                  <div className="overflow-hidden rounded-panel border border-line bg-surface shadow-sm focus-within:border-line-strong">
                    <textarea
                      className="block min-h-24 w-full resize-none bg-transparent px-3 py-3 text-[14px] leading-5 text-ink outline-none placeholder:text-subtle"
                      disabled={isAnswering || indexedDocuments.length === 0}
                      placeholder={
                        indexedDocuments.length === 0
                          ? "Index documents before chatting"
                          : "Ask a question about your documents..."
                      }
                      value={chatInput}
                      onChange={(event) => setChatInput(event.target.value)}
                      onKeyDown={handleChatKeyDown}
                    />
                    <div className="flex items-center justify-between gap-3 border-t border-line bg-surface-muted px-3 py-2">
                      <p className="text-xs text-muted">
                        AI responses may be inaccurate. Verify important information.
                      </p>
                      <button
                        className="flex size-8 shrink-0 items-center justify-center rounded-control bg-accent text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-pressed disabled:text-subtle"
                        disabled={!chatCanSubmit}
                        type="submit"
                        aria-label="Send question"
                      >
                        <SendHorizontal className="size-4" />
                      </button>
                    </div>
                  </div>
                </form>
              </section>
            </div>
          ) : (
            <div className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-5 py-5 md:px-7 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0 space-y-5">
                <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-[13px] font-medium text-muted">Knowledge Base</p>
                    <h2 className="mt-1 text-[28px] font-semibold tracking-tight text-ink">
                      Ingestion
                    </h2>
                    <p className="mt-1 max-w-2xl text-[13px] leading-5 text-muted">
                      Import documents, then prepare the local index.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 text-[13px] text-muted">
                    <SummaryChip label="Total" value={stats.total} />
                    <SummaryChip label="Indexed" value={stats.indexed} />
                    <SummaryChip label="Ready" value={stats.ready} />
                  </div>
                </section>

                <label
                  className={cx(
                    "group flex cursor-pointer flex-col gap-4 rounded-panel border bg-surface p-4 shadow-panel transition sm:flex-row sm:items-center sm:justify-between",
                    isDragging
                      ? "border-dashed border-accent bg-accent-soft ring-4 ring-accent-soft"
                      : "border-line hover:border-line-strong",
                  )}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                >
                  <input
                    ref={fileInputRef}
                    className="sr-only"
                    type="file"
                    accept=".txt,text/plain"
                    multiple
                    onChange={handleInputChange}
                  />
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent">
                      <CloudUpload className="size-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-semibold text-ink">
                        Drop files here
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] text-muted">
                        {isUploading ? "Uploading..." : notice}
                      </span>
                    </span>
                  </span>
                  <span className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-control bg-accent px-3.5 text-[13px] font-semibold text-white transition group-hover:bg-accent-hover">
                    <Upload className="size-4" />
                    Select Files
                  </span>
                </label>

                <section className="overflow-hidden rounded-panel border border-line bg-surface shadow-panel">
                  <div className="flex h-12 items-center justify-between border-b border-line px-4">
                    <div>
                      <h3 className="text-[15px] font-semibold text-ink">Uploads</h3>
                      <p className="text-xs text-muted">{plural(uploads.length, "file")}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-[minmax(0,1fr)_104px_64px] border-b border-line bg-surface-muted px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle sm:grid-cols-[minmax(0,1fr)_80px_112px_64px] md:grid-cols-[minmax(0,1fr)_80px_112px_92px_64px]">
                    <span>File</span>
                    <span className="hidden sm:block">Size</span>
                    <span>Status</span>
                    <span className="hidden md:block">Date</span>
                    <span />
                  </div>

                  {uploads.length === 0 ? (
                    <div className="px-4 py-10 text-center">
                      <FileText className="mx-auto size-7 text-subtle" />
                      <p className="mt-3 text-sm font-medium text-ink">No uploads yet</p>
                      <p className="mt-1 text-[13px] text-muted">
                        Add documents to start building the local index.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-line">
                      {uploads.map((upload) => {
                        const { stem, ext } = splitName(upload.name);
                        return (
                        <div
                          key={upload.id}
                          className="grid min-h-14 grid-cols-[minmax(0,1fr)_104px_64px] items-center px-4 py-2.5 text-[13px] sm:grid-cols-[minmax(0,1fr)_80px_112px_64px] md:grid-cols-[minmax(0,1fr)_80px_112px_92px_64px]"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-control bg-surface-muted text-muted">
                              <FileText className="size-4" />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-ink">{stem}</p>
                              <p className="mt-0.5 text-xs text-muted">
                                {typeLabel(ext)}
                                <span className="sm:hidden"> · {upload.size}</span>
                              </p>
                            </div>
                          </div>
                          <span className="hidden text-muted sm:block">{upload.size}</span>
                          <span>
                            <StatusPill tone={statusTone(upload.status)}>
                              {upload.status === "Indexed" ? (
                                <CheckCircle2 className="size-3.5" />
                              ) : (
                                <span className="size-1.5 rounded-full bg-current" />
                              )}
                              {upload.status}
                            </StatusPill>
                          </span>
                          <span className="hidden text-muted md:block">{upload.uploadedAt}</span>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              className="flex size-8 items-center justify-center rounded-control text-subtle transition hover:bg-surface-muted hover:text-ink"
                              type="button"
                              aria-label={`Rename ${upload.name}`}
                              onClick={() => openRename(upload)}
                            >
                              <Pencil className="size-4" />
                            </button>
                            <button
                              className="flex size-8 items-center justify-center rounded-control text-subtle transition hover:bg-surface-muted hover:text-ink"
                              type="button"
                              aria-label={`Remove ${upload.name}`}
                              onClick={() => openDelete(upload)}
                            >
                              <X className="size-4" />
                            </button>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>

              <InspectorPanel>
                <section className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle">
                        Index Status
                      </p>
                      <h3 className="mt-1 text-base font-semibold text-ink">
                        {readiness.title}
                      </h3>
                    </div>
                    <StatusPill tone={readiness.tone}>{readiness.label}</StatusPill>
                  </div>

                  <p className="mt-2 text-[13px] leading-5 text-muted">
                    {readiness.description}
                  </p>

                  <div className="mt-4 space-y-3">
                    {indexSteps.map((step) => (
                      <div key={step.label} className="flex items-start gap-3">
                        <span
                          className={cx(
                            "mt-1.5 size-2.5 rounded-full ring-4",
                            step.state === "complete" && "bg-success ring-success-soft",
                            step.state === "active" && "bg-accent ring-accent-soft",
                            step.state === "waiting" && "bg-line-strong ring-surface-muted",
                          )}
                        />
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-ink">{step.label}</p>
                          <p className="text-xs text-muted">{step.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <PrimaryButton
                    className="mt-4 w-full"
                    disabled={stats.ready === 0 || isIngesting}
                    onClick={() => void startIngestion()}
                  >
                    {isIngesting
                      ? "Indexing..."
                      : stats.ready > 0
                        ? "Start Indexing"
                        : stats.indexed > 0
                          ? "Indexed"
                          : "Start Indexing"}
                    <RefreshCcw className={cx("size-4", isIngesting && "animate-spin")} />
                  </PrimaryButton>
                </section>
              </InspectorPanel>
            </div>
          )}
        </section>
      </div>

      <RenameDialog
        target={renameTarget}
        onClose={() => setRenameTarget(null)}
        onConfirm={confirmRename}
        splitName={splitName}
      />

      <DeleteDialog
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </main>
  );
}

function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const isAssistant = message.role === "assistant";

  return (
    <div className={cx("flex items-start gap-3", !isAssistant && "justify-end")}>
      {isAssistant && (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Bot className="size-4" />
        </span>
      )}

      <div
        className={cx(
          "max-w-[760px] rounded-panel px-3 py-2 text-[14px] leading-6",
          isAssistant
            ? "border border-line bg-surface shadow-sm"
            : "bg-surface-muted text-ink",
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>

        {isAssistant && message.documents && message.documents.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-2">
            {message.documents.map((document) => {
              const dot = document.name.lastIndexOf(".");
              const stem = dot > 0 ? document.name.slice(0, dot) : document.name;
              const ext = dot > 0 ? document.name.slice(dot) : "";
              const type = ext === ".txt" ? "Text document" : "Document";
              return (
              <span
                key={document.id}
                className="inline-flex max-w-full items-center gap-1 rounded-[6px] bg-surface-muted px-2 py-1 text-xs text-muted ring-1 ring-line"
              >
                <FileText className="size-3 shrink-0" />
                <span className="truncate">{stem}</span>
                <span className="shrink-0 text-subtle">{type}</span>
                <span className="shrink-0 text-subtle">
                  {document.source === "selected" ? "Selected" : "Retrieved"}
                </span>
              </span>
              );
            })}
          </div>
        )}
      </div>

      {!isAssistant && (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-muted ring-1 ring-line">
          <UserRound className="size-4" />
        </span>
      )}
    </div>
  );
}

function SummaryChip({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-surface px-3 text-muted ring-1 ring-line">
      <span className="font-semibold text-ink">{value}</span>
      {label}
    </span>
  );
}

function RenameDialog({
  target,
  onClose,
  onConfirm,
  splitName,
}: {
  target: UploadItem | null;
  onClose: () => void;
  onConfirm: (nextName: string) => void;
  splitName: (name: string) => { stem: string; ext: string };
}) {
  if (!target) {
    return null;
  }

  return (
    <RenameDialogInner
      key={target.id}
      target={target}
      onClose={onClose}
      onConfirm={onConfirm}
      splitName={splitName}
    />
  );
}

function RenameDialogInner({
  target,
  onClose,
  onConfirm,
  splitName,
}: {
  target: UploadItem;
  onClose: () => void;
  onConfirm: (nextName: string) => void;
  splitName: (name: string) => { stem: string; ext: string };
}) {
  const { stem: initialStem, ext } = splitName(target.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const [stem, setStem] = useState(initialStem);

  useEffect(() => {
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);

    return () => window.clearTimeout(id);
  }, []);

  const nextName = ext ? `${stem.trim()}.${ext.slice(1)}` : stem.trim();
  const canConfirm = stem.trim().length > 0 && nextName !== target.name;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canConfirm) {
      onConfirm(nextName);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      icon={FileText}
      title="Rename Document"
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton
            disabled={!canConfirm}
            form="rename-form"
            type="submit"
          >
            Rename
          </PrimaryButton>
        </>
      }
    >
      <form id="rename-form" onSubmit={handleSubmit}>
        <label
          className="flex h-9 items-center gap-2 rounded-control border border-line bg-surface px-3 text-[13px] focus-within:border-line-strong"
          onClick={() => inputRef.current?.focus()}
        >
          <input
            ref={inputRef}
            className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-subtle"
            placeholder="Document name"
            value={stem}
            onChange={(event) => setStem(event.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
          {ext && (
            <span className="shrink-0 text-subtle">{ext}</span>
          )}
        </label>
        <p className="mt-2 text-xs text-muted">
          {ext
            ? `Keeps the ${ext} extension.`
            : "No file extension to preserve."}
        </p>
      </form>
    </Modal>
  );
}

function DeleteDialog({
  target,
  onClose,
  onConfirm,
}: {
  target: UploadItem | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!target) {
    return null;
  }

  return (
    <Modal
      open
      onClose={onClose}
      icon={FileText}
      title="Delete Document?"
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <DangerButton onClick={onConfirm}>Delete</DangerButton>
        </>
      }
    >
      <p className="text-[13px] leading-5 text-muted">
        Delete <span className="font-medium text-ink">&ldquo;{target.name}&rdquo;</span>?
        This removes the file and its indexed data.
      </p>
    </Modal>
  );
}
