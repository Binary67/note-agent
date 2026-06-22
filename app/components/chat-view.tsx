"use client";

import { Bot, PanelLeftClose, PanelLeftOpen, Plus, SendHorizontal } from "lucide-react";
import { type FormEvent, type KeyboardEvent } from "react";
import { cx } from "@/app/components/ui";
import { ChatMessageBubble } from "@/app/components/chat-message-bubble";
import { QueryContextPanel } from "@/app/components/query-context-panel";
import type { ChatMessage, FolderRecord, UploadItem } from "@/app/types";

export type ChatViewProps = {
  isContextCollapsed: boolean;
  onToggleContextCollapsed: () => void;
  documentFilter: string;
  onDocumentFilterChange: (value: string) => void;
  maxRetrievedDocuments: number;
  onMaxRetrievedDocumentsChange: (value: number) => void;
  indexedDocuments: UploadItem[];
  filteredIndexedFolders: Array<{ folder: FolderRecord; count: number }>;
  documentsByFolder: Map<string, UploadItem[]>;
  selectedFolderIds: string[];
  selectedDocumentIds: string[];
  folderNameById: Map<string, string>;
  onToggleFolder: (folderId: string) => void;
  onToggleDocument: (docId: string) => void;
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
  documentFilter,
  onDocumentFilterChange,
  maxRetrievedDocuments,
  onMaxRetrievedDocumentsChange,
  indexedDocuments,
  filteredIndexedFolders,
  documentsByFolder,
  selectedFolderIds,
  selectedDocumentIds,
  folderNameById,
  onToggleFolder,
  onToggleDocument,
  messages,
  isAnswering,
  chatInput,
  onChatInputChange,
  onResetChat,
  onSubmitChat,
  messagesEndRef,
}: ChatViewProps) {
  const hasFoldersSelected = selectedFolderIds.length > 0;
  const hasDocsSelected = selectedDocumentIds.length > 0;
  const hasSelection = hasFoldersSelected || hasDocsSelected;
  const chatCanSubmit =
    chatInput.trim().length > 0 &&
    !isAnswering &&
    indexedDocuments.length > 0;

  function handleChatKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSubmitChat();
    }
  }

  return (
    <div
      className={cx(
        "mx-auto grid w-full max-w-7xl flex-1 gap-4 px-5 py-5 md:px-7",
        !isContextCollapsed && "xl:grid-cols-[304px_minmax(0,1fr)]",
      )}
    >
      {!isContextCollapsed && (
        <QueryContextPanel
          documentFilter={documentFilter}
          onDocumentFilterChange={onDocumentFilterChange}
          maxRetrievedDocuments={maxRetrievedDocuments}
          onMaxRetrievedDocumentsChange={onMaxRetrievedDocumentsChange}
          indexedDocuments={indexedDocuments}
          filteredIndexedFolders={filteredIndexedFolders}
          documentsByFolder={documentsByFolder}
          selectedFolderIds={selectedFolderIds}
          selectedDocumentIds={selectedDocumentIds}
          folderNameById={folderNameById}
          onToggleFolder={onToggleFolder}
          onToggleDocument={onToggleDocument}
        />
      )}

      <section className="flex min-h-[calc(100vh-96px)] min-w-0 flex-col overflow-hidden rounded-panel border border-line bg-surface shadow-panel">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
          <div className="flex min-w-0 items-center gap-2">
            <button
              className="flex size-8 shrink-0 items-center justify-center rounded-control text-subtle transition hover:bg-surface-muted hover:text-ink"
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
                Chat
              </h2>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              className="flex h-8 items-center gap-1.5 rounded-control px-2.5 text-[13px] font-medium text-ink transition hover:bg-surface-muted"
              type="button"
              aria-label="New chat"
              onClick={onResetChat}
            >
              <Plus className="size-3.5" />
              <span className="hidden sm:inline">New Chat</span>
            </button>
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
          <div className="overflow-hidden rounded-panel border border-line bg-surface focus-within:border-line-strong">
            <textarea
              className="block min-h-24 w-full resize-none bg-transparent px-3 py-3 text-[14px] leading-5 text-ink outline-none placeholder:text-subtle"
              disabled={isAnswering || indexedDocuments.length === 0}
              placeholder={
                indexedDocuments.length === 0
                  ? "Index documents before chatting"
                  : hasSelection
                    ? "Ask about the selected context..."
                    : `Ask across ${maxRetrievedDocuments} retrieved documents...`
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
