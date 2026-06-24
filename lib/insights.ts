import "server-only";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { OpenAI } from "openai";
import type { Response as OpenAIResponse } from "openai/resources/responses/responses";
import type {
  DocumentTakeaway,
  FolderInsightView,
  InsightGenerationProgress,
  InsightCitation,
  InsightStatus,
  InsightWebCitation,
  InsightWebContext,
  InsightsResponse,
  InsightsRunResponse,
} from "@/app/types";
import { getConfig } from "@/lib/config";
import {
  type DocIndex,
  type DocumentRecord,
  type FolderRecord,
  listDocuments,
  listFolders,
  readIndex,
  readSource,
} from "@/lib/storage";

const ROOT = path.join(process.cwd(), "data");
const INSIGHTS_PATH = path.join(ROOT, "insights.json");
const INSIGHT_SCHEMA_VERSION = 3;
const MAX_DOCUMENT_TEXT_CHARS = 16000;
const MAX_PROGRESS_AGE_MS = 30 * 60 * 1000;
const LEARNING_BRIEF_INSTRUCTION =
  "Extract the most useful learning brief from each document: top key takeaways, concise summaries, detailed elaboration, document evidence, and richer web-backed expansion.";

type DocumentInsightRecord = {
  schemaVersion: number;
  documentId: string;
  folderId: string;
  documentName: string;
  instructionHash: string;
  documentHash: string;
  generatedAt: string;
  overview: string;
  takeaways: DocumentTakeaway[];
};

type InsightStore = {
  documentInsights: DocumentInsightRecord[];
};

type InsightProgressUpdate = Partial<
  Pick<
    InsightGenerationProgress,
    | "status"
    | "percent"
    | "processedDocuments"
    | "totalDocuments"
    | "currentDocumentName"
    | "label"
    | "detail"
  >
>;

const insightProgress = new Map<string, InsightGenerationProgress>();

type IndexedFolderDocument = {
  record: DocumentRecord;
  index: DocIndex;
  documentHash: string;
};

type IndexedFolderContext = {
  folder: FolderRecord;
  documents: IndexedFolderDocument[];
};

type InsightGenerationTarget = {
  context: IndexedFolderContext;
  document: IndexedFolderDocument;
};

type ParsedDocumentInsight = {
  overview: string;
  takeaways: DocumentTakeaway[];
};

function clampPercent(percent: number): number {
  return Math.min(100, Math.max(0, percent));
}

function progressPercent(processedDocuments: number, totalDocuments: number): number {
  if (totalDocuments === 0) {
    return 100;
  }

  return Math.round((processedDocuments / totalDocuments) * 100);
}

function progressDetail(processedDocuments: number, totalDocuments: number): string {
  return `${processedDocuments.toLocaleString()} of ${totalDocuments.toLocaleString()} documents processed`;
}

function pruneInsightProgress(): void {
  const cutoff = Date.now() - MAX_PROGRESS_AGE_MS;

  for (const [jobId, progress] of insightProgress) {
    if (progress.updatedAt < cutoff) {
      insightProgress.delete(jobId);
    }
  }
}

export function beginInsightGenerationProgress(jobId: string): void {
  pruneInsightProgress();
  insightProgress.set(jobId, {
    jobId,
    status: "active",
    percent: 0,
    processedDocuments: 0,
    totalDocuments: 0,
    currentDocumentName: null,
    label: "Preparing generation",
    detail: null,
    updatedAt: Date.now(),
  });
}

function updateInsightGenerationProgress(
  jobId: string | undefined,
  update: InsightProgressUpdate,
): void {
  if (!jobId) {
    return;
  }

  const existing = insightProgress.get(jobId) ?? {
    jobId,
    status: "active" as const,
    percent: 0,
    processedDocuments: 0,
    totalDocuments: 0,
    currentDocumentName: null,
    label: "Preparing generation",
    detail: null,
    updatedAt: Date.now(),
  };

  insightProgress.set(jobId, {
    ...existing,
    ...update,
    percent: clampPercent(update.percent ?? existing.percent),
    updatedAt: Date.now(),
  });
}

export function getInsightGenerationProgress(
  jobId: string,
): InsightGenerationProgress | null {
  pruneInsightProgress();
  return insightProgress.get(jobId) ?? null;
}

function getClient(): OpenAI {
  const { azure } = getConfig();

  if (!azure.apiKey || !azure.endpoint) {
    throw new Error(
      "Azure OpenAI is not configured. Set AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT in .env.",
    );
  }

  return new OpenAI({
    apiKey: azure.apiKey,
    baseURL: azure.endpoint,
  });
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function readStore(): Promise<InsightStore> {
  try {
    const content = await fs.readFile(INSIGHTS_PATH, "utf8");
    const parsed = JSON.parse(content) as Partial<InsightStore>;

    return {
      documentInsights: Array.isArray(parsed.documentInsights)
        ? parsed.documentInsights
        : [],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        documentInsights: [],
      };
    }

    throw error;
  }
}

async function writeStore(store: InsightStore): Promise<void> {
  await ensureDir(ROOT);
  await fs.writeFile(INSIGHTS_PATH, JSON.stringify(store, null, 2), "utf8");
}

function hashText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function instructionHash(instruction: string): string {
  return hashText(instruction.trim());
}

function documentHash(index: DocIndex): string {
  return hashText(
    JSON.stringify({
      summary: index.summary,
      entities: index.entities,
      tags: index.tags,
      chunks: index.chunks.map((chunk) => chunk.text),
    }),
  );
}

async function loadIndexedFolderContexts(): Promise<IndexedFolderContext[]> {
  const [documents, folders] = await Promise.all([listDocuments(), listFolders()]);
  const folderById = new Map(folders.map((folder) => [folder.id, folder]));
  const indexedDocuments = documents.filter(
    (document) => document.status === "Indexed" && document.folderId,
  );
  const documentsByFolder = new Map<string, IndexedFolderDocument[]>();

  await Promise.all(
    indexedDocuments.map(async (record) => {
      if (!record.folderId || !folderById.has(record.folderId)) {
        return;
      }

      const index = await readIndex(record.id);

      if (!index) {
        return;
      }

      const item: IndexedFolderDocument = {
        record,
        index,
        documentHash: documentHash(index),
      };
      const existing = documentsByFolder.get(record.folderId);

      if (existing) {
        existing.push(item);
      } else {
        documentsByFolder.set(record.folderId, [item]);
      }
    }),
  );

  return folders
    .map((folder) => {
      const folderDocuments = documentsByFolder.get(folder.id) ?? [];

      return {
        folder,
        documents: folderDocuments,
      };
    })
    .filter((context) => context.documents.length > 0);
}

function getDocumentInsight(
  store: InsightStore,
  documentId: string,
): DocumentInsightRecord | null {
  return (
    store.documentInsights.find((insight) => insight.documentId === documentId) ?? null
  );
}

function upsertDocumentInsight(
  store: InsightStore,
  insight: DocumentInsightRecord,
): void {
  const index = store.documentInsights.findIndex(
    (item) => item.documentId === insight.documentId,
  );

  if (index === -1) {
    store.documentInsights.push(insight);
  } else {
    store.documentInsights[index] = insight;
  }
}

function hasCurrentInsightContent(insight: DocumentInsightRecord): boolean {
  return (
    insight.schemaVersion === INSIGHT_SCHEMA_VERSION &&
    insight.takeaways.length > 0 &&
    insight.takeaways.every(
      (takeaway) =>
        Boolean(takeaway.title && takeaway.summary && takeaway.detail) &&
        Boolean(takeaway.webContext?.summary),
    )
  );
}

function getDocumentStatus(
  document: IndexedFolderDocument,
  insight: DocumentInsightRecord | null,
): InsightStatus {
  if (!insight) {
    return "pending";
  }

  return insight.folderId === document.record.folderId &&
    insight.instructionHash === instructionHash(LEARNING_BRIEF_INSTRUCTION) &&
    insight.documentHash === document.documentHash &&
    hasCurrentInsightContent(insight)
    ? "fresh"
    : "stale";
}

function countPendingJobs(
  contexts: IndexedFolderContext[],
  store: InsightStore,
): number {
  let count = 0;
  const currentInstructionHash = instructionHash(LEARNING_BRIEF_INSTRUCTION);

  for (const context of contexts) {
    for (const document of context.documents) {
      const insight = getDocumentInsight(store, document.record.id);

      if (
        !insight ||
        insight.folderId !== context.folder.id ||
        insight.instructionHash !== currentInstructionHash ||
        insight.documentHash !== document.documentHash ||
        !hasCurrentInsightContent(insight)
      ) {
        count += 1;
      }
    }
  }

  return count;
}

function parseJsonObject(content: string): Record<string, unknown> {
  const parsed = JSON.parse(content) as unknown;

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Model returned invalid JSON.");
  }

  return parsed as Record<string, unknown>;
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDocumentCitations(value: unknown): InsightCitation[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((citation, index) => {
      if (
        typeof citation !== "object" ||
        citation === null ||
        Array.isArray(citation)
      ) {
        return null;
      }

      const record = citation as Record<string, unknown>;
      const marker =
        normalizeText(record.marker).replace(/^\[|\]$/g, "") || `D${index + 1}`;
      const text = normalizeText(record.text);

      if (!text) {
        return null;
      }

      return { marker, text };
    })
    .filter((citation): citation is InsightCitation => citation !== null)
    .slice(0, 4);
}

function normalizeTakeaways(
  value: unknown,
): Array<Omit<DocumentTakeaway, "webContext">> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((takeaway, index) => {
      if (
        typeof takeaway !== "object" ||
        takeaway === null ||
        Array.isArray(takeaway)
      ) {
        return null;
      }

      const record = takeaway as Record<string, unknown>;
      const title = normalizeText(record.title);
      const summary = normalizeText(record.summary);
      const detail = normalizeText(record.detail);

      if (!title || !summary || !detail) {
        return null;
      }

      return {
        id: `t${index + 1}`,
        title,
        summary,
        detail,
        citations: normalizeDocumentCitations(record.citations),
      };
    })
    .filter(
      (takeaway): takeaway is Omit<DocumentTakeaway, "webContext"> =>
        takeaway !== null,
    )
    .slice(0, 6);
}

function normalizeWebCitations(value: unknown): InsightWebCitation[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((citation) => {
      if (
        typeof citation !== "object" ||
        citation === null ||
        Array.isArray(citation)
      ) {
        return null;
      }

      const record = citation as Record<string, unknown>;
      const title = normalizeText(record.title);
      const url = normalizeText(record.url);

      if (!url) {
        return null;
      }

      return { title: title || url, url };
    })
    .filter((citation): citation is InsightWebCitation => citation !== null)
    .slice(0, 6);
}

function dedupeWebCitations(
  citations: InsightWebCitation[],
): InsightWebCitation[] {
  const seen = new Set<string>();
  const unique: InsightWebCitation[] = [];

  for (const citation of citations) {
    if (seen.has(citation.url)) {
      continue;
    }

    seen.add(citation.url);
    unique.push(citation);
  }

  return unique.slice(0, 6);
}

function collectResponseWebCitations(
  response: OpenAIResponse,
): InsightWebCitation[] {
  const citations: InsightWebCitation[] = [];

  for (const item of response.output) {
    if (item.type !== "message") {
      continue;
    }

    for (const content of item.content) {
      if (content.type !== "output_text") {
        continue;
      }

      for (const annotation of content.annotations) {
        if (annotation.type === "url_citation") {
          citations.push({
            title: annotation.title || annotation.url,
            url: annotation.url,
          });
        }
      }
    }
  }

  return dedupeWebCitations(citations);
}

function normalizeWebContexts(
  value: unknown,
  takeaways: Array<Omit<DocumentTakeaway, "webContext">>,
  fallbackCitations: InsightWebCitation[],
): Map<string, InsightWebContext> {
  const knownIds = new Set(takeaways.map((takeaway) => takeaway.id));
  const contexts = new Map<string, InsightWebContext>();

  if (!Array.isArray(value)) {
    return contexts;
  }

  for (const item of value) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      continue;
    }

    const record = item as Record<string, unknown>;
    const takeawayId = normalizeText(record.takeawayId);
    const summary = normalizeText(record.summary);

    if (!knownIds.has(takeawayId) || !summary) {
      continue;
    }

    const citations = normalizeWebCitations(record.citations);

    contexts.set(takeawayId, {
      summary,
      citations: dedupeWebCitations(
        citations.length > 0 ? citations : fallbackCitations,
      ),
    });
  }

  return contexts;
}

async function generateDocumentInsight(
  document: IndexedFolderDocument,
  folderName: string,
): Promise<ParsedDocumentInsight> {
  const { azure } = getConfig();
  const client = getClient();
  const text = await readSource(document.record.id);
  const truncatedText =
    text.length > MAX_DOCUMENT_TEXT_CHARS
      ? `${text.slice(0, MAX_DOCUMENT_TEXT_CHARS)}\n\n[Document truncated for insight generation.]`
      : text;

  const response = await client.chat.completions.create({
    model: azure.chatDeployment,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You generate a learning brief for one document in a personal knowledge base. " +
          "Extract 3-6 concrete, non-overlapping key takeaways. " +
          "Each takeaway needs a short title, a concise summary, and a detailed elaboration grounded only in the document. " +
          "Use unique inline document citation markers like [D1], [D2], and [D3] in each takeaway detail, and include matching short evidence snippets in citations. " +
          "Do not add web-backed expansion in this step. " +
          "Respond with strict JSON: " +
          '{"overview":"one sentence","takeaways":[{"title":"takeaway title","summary":"one sentence","detail":"2-4 short paragraphs with [D1] markers","citations":[{"marker":"D1","text":"short document evidence"}]}]}.',
      },
      {
        role: "user",
        content:
          `Learning brief goal:\n${LEARNING_BRIEF_INSTRUCTION}\n\n` +
          `Folder name: ${folderName}\n` +
          `Document name: ${document.record.name}\n` +
          `Existing summary: ${document.index.summary}\n` +
          `Tags: ${document.index.tags.join(", ")}\n\n` +
          `Document text:\n${truncatedText}`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  const parsed = parseJsonObject(raw);
  const overview = normalizeText(parsed.overview);
  const takeawaysWithoutWeb = normalizeTakeaways(parsed.takeaways);

  if (!overview && takeawaysWithoutWeb.length === 0) {
    throw new Error("The model did not return document insights.");
  }

  const webContexts = await generateWebContexts(
    document,
    folderName,
    takeawaysWithoutWeb,
  );
  const takeaways = takeawaysWithoutWeb.map((takeaway) => ({
    ...takeaway,
    webContext: webContexts.get(takeaway.id) ?? null,
  }));

  if (!takeaways.every((takeaway) => takeaway.webContext?.summary)) {
    throw new Error("The model did not return web-backed expansion for every takeaway.");
  }

  return { overview, takeaways };
}

async function generateWebContexts(
  document: IndexedFolderDocument,
  folderName: string,
  takeaways: Array<Omit<DocumentTakeaway, "webContext">>,
): Promise<Map<string, InsightWebContext>> {
  const { azure } = getConfig();
  const client = getClient();

  const response = await client.responses.create({
    model: azure.chatDeployment,
    store: false,
    include: ["web_search_call.action.sources"],
    tools: [{ type: "web_search_preview", search_context_size: "high" }],
    tool_choice: "required",
    instructions:
      "Use web search to expand document-grounded learning takeaways with current, externally sourced context. " +
      "For each takeaway, write a richer web-backed expansion that can be read immediately after the document-grounded detail. " +
      "Cover relevant background, current external context, practical implications, examples, and caveats when useful. " +
      "Keep it anchored to the takeaway and avoid generic web research. " +
      "Write 2-4 compact paragraphs in the summary field, roughly 120-220 words per takeaway. " +
      "Use inline Markdown links where external claims appear. " +
      "Prefer authoritative or primary sources when available. " +
      "Return only JSON that matches the schema.",
    text: {
      format: {
        type: "json_schema",
        name: "document_takeaway_web_expansion",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["takeaways"],
          properties: {
            takeaways: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["takeawayId", "summary", "citations"],
                properties: {
                  takeawayId: { type: "string" },
                  summary: { type: "string" },
                  citations: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      required: ["title", "url"],
                      properties: {
                        title: { type: "string" },
                        url: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    input:
      `Learning brief goal:\n${LEARNING_BRIEF_INSTRUCTION}\n\n` +
      `Folder name: ${folderName}\n` +
      `Document name: ${document.record.name}\n` +
      `Existing document summary: ${document.index.summary}\n` +
      `Tags: ${document.index.tags.join(", ")}\n\n` +
      `Document-grounded takeaways:\n${JSON.stringify(
        takeaways.map((takeaway) => ({
          id: takeaway.id,
          title: takeaway.title,
          summary: takeaway.summary,
          detail: takeaway.detail,
        })),
        null,
        2,
      )}`,
  });

  if (response.status === "incomplete") {
    const reason = response.incomplete_details?.reason ?? "unknown reason";
    throw new Error(`Web expansion generation did not complete: ${reason}.`);
  }

  if (response.status === "failed") {
    const message = response.error?.message ?? "unknown reason";
    throw new Error(`Web expansion generation failed: ${message}.`);
  }

  const parsed = parseJsonObject(response.output_text.trim() || "{}");

  return normalizeWebContexts(
    parsed.takeaways,
    takeaways,
    collectResponseWebCitations(response),
  );
}

export async function getInsightsView(): Promise<InsightsResponse> {
  const [store, contexts] = await Promise.all([
    readStore(),
    loadIndexedFolderContexts(),
  ]);
  const folders: FolderInsightView[] = contexts.map((context) => {
    const documents = context.documents.map((document) => {
      const insight = getDocumentInsight(store, document.record.id);
      const status = getDocumentStatus(document, insight);
      const currentInsight = status === "fresh" ? insight : null;

      return {
        documentId: document.record.id,
        documentName: document.record.name,
        status,
        generatedAt: currentInsight?.generatedAt ?? null,
        overview: currentInsight?.overview ?? "",
        takeaways: currentInsight?.takeaways ?? [],
      };
    });
    const documentStatuses = documents.map((document) => document.status);
    const status: InsightStatus = documentStatuses.includes("pending")
      ? "pending"
      : documentStatuses.includes("stale")
        ? "stale"
        : "fresh";
    const takeawayCount = documents.reduce(
      (total, document) => total + document.takeaways.length,
      0,
    );
    const generatedAt =
      documents
        .map((document) => document.generatedAt)
        .filter((value): value is string => Boolean(value))
        .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;

    return {
      folder: context.folder,
      documentCount: context.documents.length,
      takeawayCount,
      status,
      generatedAt,
      overview:
        takeawayCount > 0
          ? `${takeawayCount.toLocaleString()} takeaways generated from ${context.documents.length.toLocaleString()} document${context.documents.length === 1 ? "" : "s"}.`
          : "",
      documents,
    };
  });

  return {
    folders,
    pendingJobs: countPendingJobs(contexts, store),
  };
}

export async function forceGenerateInsights({
  folderId,
  jobId,
}: {
  folderId?: string;
  jobId?: string;
} = {}): Promise<InsightsRunResponse> {
  return runInsightsPass({ folderId, jobId });
}

async function runInsightsPass({
  folderId,
  jobId,
}: {
  folderId?: string;
  jobId?: string;
}): Promise<InsightsRunResponse> {
  const store = await readStore();
  const contexts = (await loadIndexedFolderContexts()).filter(
    (context) => !folderId || context.folder.id === folderId,
  );
  const generationTargets: InsightGenerationTarget[] = [];

  for (const context of contexts) {
    for (const document of context.documents) {
      const insight = getDocumentInsight(store, document.record.id);

      if (getDocumentStatus(document, insight) !== "fresh") {
        generationTargets.push({ context, document });
      }
    }
  }

  const totalDocuments = generationTargets.length;
  let documentInsightsGenerated = 0;
  let processedDocuments = 0;

  updateInsightGenerationProgress(jobId, {
    status: "active",
    percent: progressPercent(0, totalDocuments),
    processedDocuments: 0,
    totalDocuments,
    currentDocumentName: null,
    label:
      totalDocuments === 0
        ? "No documents need generation"
        : "Preparing learning brief",
    detail:
      totalDocuments === 0 ? "Insight cache is current" : progressDetail(0, totalDocuments),
  });

  try {
    const currentInstructionHash = instructionHash(LEARNING_BRIEF_INSTRUCTION);

    for (const { context, document } of generationTargets) {
      updateInsightGenerationProgress(jobId, {
        status: "active",
        percent: progressPercent(processedDocuments, totalDocuments),
        processedDocuments,
        totalDocuments,
        currentDocumentName: document.record.name,
        label: "Generating learning brief",
        detail: progressDetail(processedDocuments, totalDocuments),
      });

      const generated = await generateDocumentInsight(
        document,
        context.folder.name,
      );

      upsertDocumentInsight(store, {
        documentId: document.record.id,
        folderId: context.folder.id,
        documentName: document.record.name,
        instructionHash: currentInstructionHash,
        documentHash: document.documentHash,
        schemaVersion: INSIGHT_SCHEMA_VERSION,
        generatedAt: new Date().toISOString(),
        overview: generated.overview,
        takeaways: generated.takeaways,
      });
      await writeStore(store);
      documentInsightsGenerated += 1;
      processedDocuments += 1;

      updateInsightGenerationProgress(jobId, {
        status: "active",
        percent: progressPercent(processedDocuments, totalDocuments),
        processedDocuments,
        totalDocuments,
        currentDocumentName: document.record.name,
        label: "Saved learning brief",
        detail: progressDetail(processedDocuments, totalDocuments),
      });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate insights.";

    updateInsightGenerationProgress(jobId, {
      status: "error",
      percent: progressPercent(processedDocuments, totalDocuments),
      processedDocuments,
      totalDocuments,
      label: "Generation failed",
      detail: message,
    });

    throw error;
  }

  const pendingJobs = countPendingJobs(contexts, store);
  const changed = documentInsightsGenerated > 0;

  updateInsightGenerationProgress(jobId, {
    status: "complete",
    percent: 100,
    processedDocuments,
    totalDocuments,
    currentDocumentName: null,
    label: "Generation complete",
    detail:
      totalDocuments === 0
        ? "Insight cache is current"
        : progressDetail(processedDocuments, totalDocuments),
  });

  return {
    started: true,
    changed,
    documentInsightsGenerated,
    pendingJobs,
  };
}
