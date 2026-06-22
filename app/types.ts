export type UploadStatus = "Ready" | "Ingesting" | "Indexed" | "Error";
export type UploadProgressStatus = "active" | "complete" | "error";
export type ViewKey = "ingestion" | "chat" | "analytics";

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

export type UploadProgress = {
  jobId: string;
  status: UploadProgressStatus;
  percent: number;
  label: string;
  detail: string | null;
  updatedAt: number;
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
export type UploadProgressResponse = { progress: UploadProgress | null };
export type IngestResponse = { started: number };
export type AnalyticsDay = {
  date: string;
  label: string;
  questionsAnswered: number;
  referencesReviewed: number;
};
export type AnalyticsResponse = {
  questionsAnsweredToday: number;
  questionsAnsweredThisWeek: number;
  questionsAnsweredAllTime: number;
  referencesReviewedToday: number;
  referencesReviewedThisWeek: number;
  referencesReviewedAllTime: number;
  estimatedTimeSavedMinutes: number;
  averageReferencesPerAnswer: number;
  currentStreakDays: number;
  activeDaysLast7: number;
  todayDate: string;
  weekStartDate: string;
  daily: AnalyticsDay[];
};
export type KnowledgeImportResponse = {
  documents: UploadItem[];
  folders: FolderRecord[];
  imported: number;
};
export type DeleteResponse = { ok: boolean };
export type DocumentUpdateResponse = { document: UploadItem; folders: FolderRecord[] };
export type ChatResponse = {
  answer: string;
  mode: "selected" | "retrieved" | "folder" | "mixed";
  documents: ChatDocument[];
};
