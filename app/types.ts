export type UploadStatus = "Ready" | "Ingesting" | "Indexed" | "Error";
export type ViewKey = "ingestion" | "chat";
export type ScopeMode = "all" | "folders" | "documents";

export type UploadItem = {
  id: string;
  name: string;
  size: string;
  status: UploadStatus;
  uploadedAt: string;
  folderId: string | null;
};

export type FolderRecord = {
  id: string;
  name: string;
};

export type ChatDocument = {
  id: string;
  name: string;
  source: "selected" | "retrieved";
  score?: number;
  semanticScore?: number;
  bm25Score?: number;
};

export type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  documents?: ChatDocument[];
};

export type ListResponse = { documents: UploadItem[]; folders: FolderRecord[] };
export type UploadResponse = { documents: UploadItem[]; folders: FolderRecord[] };
export type IngestResponse = { started: number };
export type DeleteResponse = { ok: boolean };
export type DocumentUpdateResponse = { document: UploadItem; folders: FolderRecord[] };
export type ChatResponse = {
  answer: string;
  mode: "selected" | "retrieved" | "folder";
  documents: ChatDocument[];
};