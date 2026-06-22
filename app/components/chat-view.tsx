"use client";

import { Bot, PanelLeftClose, PanelLeftOpen, Plus, SendHorizontal } from "lucide-react";
import { type FormEvent, type KeyboardEvent } from "react";
import { cx, StatusPill } from "@/app/components/ui";
import { ChatMessageBubble } from "@/app/components/chat-message-bubble";
import { QueryContextPanel } from "@/app/components/query-context-panel";
import type { ChatMessage, FolderRecord, ScopeMode, UploadItem } from "@/app/types";

export type ChatViewProps = {
  isContextCollapsed: boolean;
  onToggleContextCollapsed: () => void;
  scopeMode: ScopeMode;
  onScopeModeChange: (mode: ScopeMode) => void;
  documentFilter: string;
  onDocumentFilterChange: (value: string) => void;
  maxRetrievedDocuments: number;
  onMaxRetrievedDocumentsChange: (value: number) => void;
  indexedDocuments: UploadItem[];
  filteredIndexedDocuments: UploadItem[];
  filteredIndexedFolders: Array<{ folder: FolderRecord; count: number }>;
  selectedFolderIds: string[];
  selectedDocumentIds: string[];
  onToggleFolder: (id: string) => void;
  onToggleDocument: (id: string) => void;
  folderNameById: Map<string, string>;
  messages: ChatMessage[];
  isAnswering: boolean;
  chatInput: string;
  onChatInputChange: (value: string) => void;
  onResetChat: () => void;
  onSubmitChat: (event?: FormEvent<HTMLFormElement>) => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
};

export function ChatView({
  isContextCollapsed,
  onToggleContextCollapsed,
  scopeMode,
  onScopeModeChange,
  documentFilter,
  onDocumentFilterChange,
  maxRetrievedDocuments,
  onMaxRetrievedDocumentsChange,
  indexedDocuments,
  filteredIndexedDocuments,
  filteredIndexedFolders,
  selectedFolderIds,
  selectedDocumentIds,
  onToggleFolder,
  onToggleDocument,
  folderNameById,
  messages,
  isAnswering,
  chatInput,
  onChatInputChange,
  onResetChat,
  onSubmitChat,
  messagesEndRef,
}: ChatViewProps) {
  const chatCanSubmit =
    chatInput.trim().length > 0 &&
    !isAnswering &&
    indexedDocuments.length > 0 &&
    (scopeMode !== "folders" || selectedFolderIds.length > 0) &&
    (scopeMode !== "documents" || selectedDocumentIds.length > 0);
  const chatStatusLabel =
    scopeMode === "folders"
      ? "Folder Scope"
      : scopeMode === "documents"
        ? "Document Scope"
        : "Hybrid Retrieval";

  function handleChatKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSubmitChat();
    }
  }

  return (
    <div
      className={cx(
        "mx-auto grid w-full max-w-7xl flex-1 gap-5 px-5 py-5 md:px-7",
        !isContextCollapsed && "xl:grid-cols-[304px_minmax(0,1fr)]",
      )}
    >
      {!isContextCollapsed && (
        <QueryContextPanel
          scopeMode={scopeMode}
          onScopeModeChange={onScopeModeChange}
          documentFilter={documentFilter}
          onDocumentFilterChange={onDocumentFilterChange}
          maxRetrievedDocuments={maxRetrievedDocuments}
          onMaxRetrievedDocumentsChange={onMaxRetrievedDocumentsChange}
          indexedDocuments={indexedDocuments}
          filteredIndexedDocuments={filteredIndexedDocuments}
          filteredIndexedFolders={filteredIndexedFolders}
          selectedFolderIds={selectedFolderIds}
          selectedDocumentIds={selectedDocumentIds}
          onToggleFolder={onToggleFolder}
          onToggleDocument={onToggleDocument}
          folderNameById={folderNameById}
        />
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
              onClick={onToggleContextCollapsed}
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
                {scopeMode === "documents"
                  ? "Answering from selected full documents"
                  : scopeMode === "folders"
                    ? "Retrieving from selected folders"
                    : `Answering from top ${maxRetrievedDocuments} retrieved full documents`}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              className="flex h-8 items-center gap-1.5 rounded-control border border-line bg-surface px-2.5 text-[13px] font-medium text-ink shadow-sm transition hover:border-line-strong hover:bg-surface-muted"
              type="button"
              aria-label="New chat"
              onClick={onResetChat}
            >
              <Plus className="size-3.5" />
              <span className="hidden sm:inline">New Chat</span>
            </button>
            <span className="hidden sm:inline-flex">
              <StatusPill tone={scopeMode === "all" ? "neutral" : "accent"}>
                {chatStatusLabel}
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

        <form className="shrink-0 border-t border-line p-4" onSubmit={onSubmitChat}>
          <div className="overflow-hidden rounded-panel border border-line bg-surface shadow-sm focus-within:border-line-strong">
            <textarea
              className="block min-h-24 w-full resize-none bg-transparent px-3 py-3 text-[14px] leading-5 text-ink outline-none placeholder:text-subtle"
              disabled={isAnswering || indexedDocuments.length === 0}
              placeholder={
                indexedDocuments.length === 0
                  ? "Index documents before chatting"
                  : scopeMode === "folders" && selectedFolderIds.length === 0
                    ? "Select a folder before chatting"
                    : scopeMode === "documents" && selectedDocumentIds.length === 0
                      ? "Select documents before chatting"
                  : "Ask a question about your documents..."
              }
              value={chatInput}
              onChange={(event) => onChatInputChange(event.target.value)}
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
  );
}