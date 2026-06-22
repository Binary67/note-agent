"use client";

import { AnalyticsView } from "@/app/components/analytics-view";
import { ChatView } from "@/app/components/chat-view";
import { DeleteDialog } from "@/app/components/delete-dialog";
import { ImportDialog } from "@/app/components/import-dialog";
import { IngestionView } from "@/app/components/ingestion-view";
import { RenameDialog } from "@/app/components/rename-dialog";
import { Sidebar } from "@/app/components/sidebar";
import { useKnowledgeBase } from "@/app/hooks/use-knowledge-base";

export default function Home() {
  const kb = useKnowledgeBase();
  const pageTitle =
    kb.activeView === "chat"
      ? "Chat"
      : kb.activeView === "analytics"
        ? "Analytics"
        : "Knowledge";

  return (
    <main className="h-screen overflow-hidden bg-canvas text-ink">
      <div className="flex h-full min-h-0">
        <Sidebar activeView={kb.activeView} onSelectView={kb.setActiveView} />

        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-line bg-toolbar px-4 backdrop-blur-xl md:px-6">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex size-8 items-center justify-center rounded-control bg-accent text-sm font-semibold text-white lg:hidden">
                R
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-[17px] font-semibold text-ink">
                  {pageTitle}
                </h1>
              </div>
            </div>

            <div className="flex items-center">
              <div className="ml-1 flex size-8 items-center justify-center rounded-full bg-surface-muted text-[13px] font-semibold text-accent ring-1 ring-line">
                F
              </div>
            </div>
          </header>

          {kb.activeView === "chat" ? (
            <ChatView
              isContextCollapsed={kb.isContextCollapsed}
              onToggleContextCollapsed={() => kb.setIsContextCollapsed((current) => !current)}
              documentFilter={kb.documentFilter}
              onDocumentFilterChange={kb.setDocumentFilter}
              maxRetrievedDocuments={kb.maxRetrievedDocuments}
              onMaxRetrievedDocumentsChange={kb.setMaxRetrievedDocuments}
              indexedDocuments={kb.indexedDocuments}
              filteredIndexedFolders={kb.filteredIndexedFolders}
              documentsByFolder={kb.documentsByFolder}
              selectedFolderIds={kb.selectedFolderIds}
              selectedDocumentIds={kb.selectedDocumentIds}
              folderNameById={kb.folderNameById}
              onToggleFolder={kb.toggleFolder}
              onToggleDocument={kb.toggleDocument}
              messages={kb.messages}
              isAnswering={kb.isAnswering}
              chatInput={kb.chatInput}
              onChatInputChange={kb.setChatInput}
              onResetChat={kb.resetChat}
              onSubmitChat={kb.submitChat}
              messagesEndRef={kb.messagesEndRef}
            />
          ) : kb.activeView === "analytics" ? (
            <AnalyticsView />
          ) : (
            <IngestionView
              uploads={kb.uploads}
              folders={kb.folders}
              isDragging={kb.isDragging}
              isUploading={kb.isUploading}
              uploadProgress={kb.uploadProgress}
              isIngesting={kb.isIngesting}
              isExporting={kb.isExporting}
              isImporting={kb.isImporting}
              notice={kb.notice}
              stats={kb.stats}
              unassignedReadyCount={kb.unassignedReadyCount}
              readiness={kb.readiness}
              indexSteps={kb.indexSteps}
              folderNameById={kb.folderNameById}
              onDragEnter={(event) => {
                event.preventDefault();
                kb.setIsDragging(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => kb.setIsDragging(false)}
              onDrop={kb.handleDrop}
              onFileInputChange={kb.handleInputChange}
              onStartIngestion={() => void kb.startIngestion()}
              onExportKnowledgeBase={() => void kb.exportKnowledgeBase()}
              onImportKnowledgeBase={kb.importKnowledgeBase}
              onAssignDocumentFolder={kb.assignDocumentFolder}
              onOpenRename={kb.openRename}
              onOpenDelete={kb.openDelete}
            />
          )}
        </section>
      </div>

      <RenameDialog
        target={kb.renameTarget}
        onClose={() => kb.setRenameTarget(null)}
        onConfirm={kb.confirmRename}
      />

      <DeleteDialog
        target={kb.deleteTarget}
        onClose={() => kb.setDeleteTarget(null)}
        onConfirm={kb.confirmDelete}
      />

      <ImportDialog
        target={kb.importTarget}
        isImporting={kb.isImporting}
        onClose={() => kb.setImportTarget(null)}
        onConfirm={kb.confirmImportKnowledgeBase}
      />
    </main>
  );
}
