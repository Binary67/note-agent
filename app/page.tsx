"use client";

import {
  Bell,
  BookOpen,
  Bot,
  ChartNoAxesColumn,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Cloud,
  CloudUpload,
  FileText,
  FolderOpen,
  MessageSquareText,
  MoreVertical,
  Plus,
  RefreshCcw,
  Search,
  Settings,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { type ChangeEvent, type DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type UploadStatus = "Ready" | "Ingesting" | "Indexed" | "Error";

type UploadItem = {
  id: string;
  name: string;
  size: string;
  status: UploadStatus;
  uploadedAt: string;
};

type ListResponse = { documents: UploadItem[] };
type UploadResponse = { documents: UploadItem[] };
type IngestResponse = { started: number };
type DeleteResponse = { ok: boolean };

const navigationItems = [
  { label: "Knowledge Base", icon: FolderOpen, active: true },
  { label: "Chat Interface", icon: MessageSquareText },
  { label: "Analytics", icon: ChartNoAxesColumn },
];

const topNavItems = ["Documents", "Ingestion", "History"];

function isTextFile(file: File) {
  return file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt");
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Request failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function statusClasses(status: UploadStatus) {
  if (status === "Indexed") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  if (status === "Ingesting") {
    return "bg-blue-50 text-[#0066cc] ring-blue-200";
  }

  if (status === "Error") {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  return "bg-zinc-100 text-zinc-700 ring-zinc-200";
}

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [notice, setNotice] = useState("Drop TXT files here or browse from your computer.");

  const refresh = useCallback(async () => {
    try {
      const data = await parseJson<ListResponse>(await fetch("/api/documents"));
      setUploads(data.documents);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to load documents.");
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const data = await parseJson<ListResponse>(await fetch("/api/documents"));
        setUploads(data.documents);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Failed to load documents.");
      }
    })();
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  const stats = useMemo(
    () => ({
      total: uploads.length,
      indexed: uploads.filter((upload) => upload.status === "Indexed").length,
      ingesting: uploads.filter((upload) => upload.status === "Ingesting").length,
      ready: uploads.filter((upload) => upload.status === "Ready").length,
    }),
    [uploads],
  );

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
      setNotice(`${textFiles.length} TXT file added to the ingestion queue.`);
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

  async function removeUpload(id: string) {
    try {
      await parseJson<DeleteResponse>(
        await fetch(`/api/documents/${id}`, { method: "DELETE" }),
      );
      setUploads((current) => current.filter((upload) => upload.id !== id));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to remove document.");
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white/80 px-5 py-6 backdrop-blur lg:flex lg:flex-col">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-[#0066cc] text-sm font-semibold text-white">
              R
            </div>
            <div>
              <p className="text-lg font-semibold leading-5 text-[#0066cc]">RAG Engine</p>
              <p className="text-xs text-slate-500">Personal AI</p>
            </div>
          </div>

          <button
            className="mt-7 flex h-10 items-center justify-center gap-2 rounded-lg bg-[#0066cc] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#005bb8]"
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            <Plus className="size-4" />
            Upload TXT
          </button>

          <nav className="mt-6 space-y-1">
            {navigationItems.map((item) => (
              <button
                key={item.label}
                className={`flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm transition ${
                  item.active
                    ? "bg-[#f5f5f7] font-medium text-[#0066cc] shadow-[inset_3px_0_0_#0066cc]"
                    : "text-slate-600 hover:bg-[#f5f5f7]"
                }`}
                type="button"
              >
                <item.icon className="size-4" />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="mt-auto border-t border-slate-200 pt-4">
            <button
              className="flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm text-slate-600 transition hover:bg-[#f5f5f7]"
              type="button"
            >
              <Settings className="size-4" />
              Settings
            </button>
            <button
              className="flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm text-slate-600 transition hover:bg-[#f5f5f7]"
              type="button"
            >
              <CircleHelp className="size-4" />
              Help
            </button>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-slate-200 bg-white/90 px-5 backdrop-blur md:px-7">
            <div className="flex min-w-0 items-center gap-5">
              <div className="lg:hidden">
                <div className="flex size-9 items-center justify-center rounded-lg bg-[#0066cc] text-sm font-semibold text-white">
                  R
                </div>
              </div>
              <div>
                <h1 className="truncate text-xl font-semibold text-[#0066cc]">
                  Knowledge Platform
                </h1>
              </div>
              <nav className="hidden items-center gap-2 md:flex">
                {topNavItems.map((item) => (
                  <button
                    key={item}
                    className={`relative h-14 px-4 text-sm font-medium ${
                      item === "Ingestion" ? "text-[#0066cc]" : "text-slate-600"
                    }`}
                    type="button"
                  >
                    {item}
                    {item === "Ingestion" ? (
                      <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#0066cc]" />
                    ) : null}
                  </button>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="hidden size-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-[#f5f5f7] sm:flex"
                type="button"
                aria-label="Search"
              >
                <Search className="size-[18px]" />
              </button>
              <button
                className="hidden size-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-[#f5f5f7] sm:flex"
                type="button"
                aria-label="Notifications"
              >
                <Bell className="size-[18px]" />
              </button>
              <button
                className="hidden size-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-[#f5f5f7] sm:flex"
                type="button"
                aria-label="Cloud sync"
              >
                <Cloud className="size-[18px]" />
              </button>
              <button
                className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-[#1d1d1f] shadow-sm transition hover:border-slate-300"
                type="button"
              >
                <Plus className="size-4" />
                New Chat
              </button>
              <div className="flex size-9 items-center justify-center rounded-full bg-[#f5f5f7] text-sm font-semibold text-[#0066cc] ring-1 ring-slate-200">
                F
              </div>
            </div>
          </header>

          <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-5 py-6 md:px-7 lg:py-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0066cc] ring-1 ring-blue-100">
                  <Zap className="size-3.5" />
                  Ingestion
                </div>
                <h2 className="text-2xl font-semibold tracking-tight text-[#1d1d1f] md:text-[28px]">
                  Document Ingestion
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-5 text-slate-600">
                  Upload text files to prepare a knowledge base that an agent can crawl later.
                  Supported format for this first pass: TXT.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
                <Metric label="Total" value={stats.total} />
                <Metric label="Indexed" value={stats.indexed} />
                <Metric label="Ready" value={stats.ready} />
              </div>
            </div>

            <label
              className={`flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed bg-white px-5 text-center shadow-sm transition ${
                isDragging
                  ? "border-[#0066cc] ring-4 ring-blue-100"
                  : "border-[#0066cc] hover:bg-blue-50/30"
              }`}
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
              <span className="flex size-14 items-center justify-center rounded-full bg-blue-100 text-[#0066cc]">
                <CloudUpload className="size-7" />
              </span>
              <span className="mt-4 text-xl font-semibold tracking-tight text-[#1d1d1f]">
                Drag and drop TXT files here
              </span>
              <span className="mt-2 text-sm text-slate-600">
                {isUploading ? "Uploading..." : notice}
              </span>
              <span className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-[#0066cc] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#005bb8]">
                <Upload className="size-4" />
                Select Files
              </span>
            </label>

            <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
              <section className="min-w-0">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-xl font-semibold tracking-tight text-[#1d1d1f]">
                    Recent Uploads
                  </h3>
                  <button
                    className="flex items-center gap-1 text-sm font-semibold text-[#0066cc] transition hover:text-[#005bb8]"
                    type="button"
                  >
                    View All
                    <ChevronRight className="size-4" />
                  </button>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="grid grid-cols-[minmax(0,1fr)_120px_40px] border-b border-slate-200 bg-[#f5f5f7] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 sm:grid-cols-[minmax(0,1fr)_110px_130px_40px] md:grid-cols-[minmax(0,1fr)_110px_130px_110px_40px]">
                    <span>File Name</span>
                    <span className="hidden sm:block">Size</span>
                    <span>Status</span>
                    <span className="hidden md:block">Date</span>
                    <span />
                  </div>

                  <div className="divide-y divide-slate-200">
                    {uploads.map((upload) => (
                      <div
                        key={upload.id}
                        className="grid grid-cols-[minmax(0,1fr)_120px_40px] items-center px-4 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_110px_130px_40px] md:grid-cols-[minmax(0,1fr)_110px_130px_110px_40px]"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                            <FileText className="size-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-[#1d1d1f]">{upload.name}</p>
                            <p className="mt-0.5 text-xs text-slate-500 sm:hidden">{upload.size}</p>
                          </div>
                        </div>
                        <span className="hidden text-slate-600 sm:block">{upload.size}</span>
                        <span>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusClasses(
                              upload.status,
                            )}`}
                          >
                            {upload.status === "Indexed" ? (
                              <CheckCircle2 className="size-3.5" />
                            ) : (
                              <span className="size-1.5 rounded-full bg-current" />
                            )}
                            {upload.status}
                          </span>
                        </span>
                        <span className="hidden text-slate-600 md:block">{upload.uploadedAt}</span>
                        <button
                          className="flex size-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                          type="button"
                          aria-label={`Remove ${upload.name}`}
                          onClick={() => removeUpload(upload.id)}
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <aside className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-[#1d1d1f]">Agent Crawl Readiness</h3>
                    <BookOpen className="size-[18px] text-[#0066cc]" />
                  </div>
                  <p className="mt-2 text-sm leading-5 text-slate-600">
                    TXT uploads are staged locally. Backend parsing, chunking, indexing, and agent
                    retrieval can be connected next.
                  </p>
                  <button
                    className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#1d1d1f] px-4 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-slate-300"
                    type="button"
                    disabled={stats.ready === 0 || isIngesting}
                    onClick={() => void startIngestion()}
                  >
                    {isIngesting ? "Ingesting..." : "Start Ingestion"}
                    <RefreshCcw className={`size-4 ${isIngesting ? "animate-spin" : ""}`} />
                  </button>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-[#1d1d1f]">Next Agent Query</h3>
                    <MoreVertical className="size-[18px] text-slate-500" />
                  </div>
                  <div className="mt-4 rounded-lg bg-[#f5f5f7] p-3">
                    <div className="flex items-center gap-3">
                      <span className="flex size-8 items-center justify-center rounded-lg bg-white text-[#0066cc] ring-1 ring-slate-200">
                        <Bot className="size-4" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-[#1d1d1f]">Ask from knowledge</p>
                        <p className="text-xs text-slate-500">Available after indexing</p>
                      </div>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-[72px] rounded-lg px-3 py-1.5 text-center">
      <p className="text-lg font-semibold leading-5 text-[#1d1d1f]">{value}</p>
      <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
    </div>
  );
}
