import "server-only";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { OpenAI } from "openai";
import type {
  FolderInsightItem,
  FolderInsightSection,
  FolderInsightView,
  InsightInstructionSource,
  InsightSection,
  InsightStatus,
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
const MAX_BACKGROUND_MODEL_CALLS = 2;
const MAX_DOCUMENT_TEXT_CHARS = 16000;
const MAX_FOLDER_DOCUMENTS_FOR_SUGGESTION = 8;

type FolderInsightSetting = {
  folderId: string;
  instruction: string;
  instructionSource: InsightInstructionSource;
  suggestedInstruction: string;
  suggestionContextHash: string;
  suggestionGeneratedAt: string;
  updatedAt: string;
};

type DocumentInsightRecord = {
  documentId: string;
  folderId: string;
  documentName: string;
  instructionHash: string;
  documentHash: string;
  generatedAt: string;
  overview: string;
  sections: InsightSection[];
};

type FolderInsightRecord = {
  folderId: string;
  instructionHash: string;
  generatedAt: string;
  overview: string;
  sections: FolderInsightSection[];
};

type InsightStore = {
  folderSettings: FolderInsightSetting[];
  documentInsights: DocumentInsightRecord[];
  folderInsights: FolderInsightRecord[];
};

type IndexedFolderDocument = {
  record: DocumentRecord;
  index: DocIndex;
  documentHash: string;
};

type IndexedFolderContext = {
  folder: FolderRecord;
  documents: IndexedFolderDocument[];
  suggestionContextHash: string;
};

type ParsedDocumentInsight = {
  overview: string;
  sections: InsightSection[];
};

type ParsedFolderInsight = {
  overview: string;
  sections: FolderInsightSection[];
};

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
      folderSettings: Array.isArray(parsed.folderSettings)
        ? parsed.folderSettings
        : [],
      documentInsights: Array.isArray(parsed.documentInsights)
        ? parsed.documentInsights
        : [],
      folderInsights: Array.isArray(parsed.folderInsights)
        ? parsed.folderInsights
        : [],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        folderSettings: [],
        documentInsights: [],
        folderInsights: [],
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

function folderSuggestionContextHash(
  folder: FolderRecord,
  documents: IndexedFolderDocument[],
): string {
  return hashText(
    JSON.stringify({
      folderName: folder.name,
      documents: documents.map(({ record, index }) => ({
        name: record.name,
        summary: index.summary,
        tags: index.tags,
        entities: index.entities,
      })),
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
        suggestionContextHash: folderSuggestionContextHash(folder, folderDocuments),
      };
    })
    .filter((context) => context.documents.length > 0);
}

function getFolderSetting(
  store: InsightStore,
  folderId: string,
): FolderInsightSetting | null {
  return store.folderSettings.find((setting) => setting.folderId === folderId) ?? null;
}

function getDocumentInsight(
  store: InsightStore,
  documentId: string,
): DocumentInsightRecord | null {
  return (
    store.documentInsights.find((insight) => insight.documentId === documentId) ?? null
  );
}

function getFolderInsight(
  store: InsightStore,
  folderId: string,
): FolderInsightRecord | null {
  return store.folderInsights.find((insight) => insight.folderId === folderId) ?? null;
}

function upsertFolderSetting(
  store: InsightStore,
  setting: FolderInsightSetting,
): void {
  const index = store.folderSettings.findIndex(
    (item) => item.folderId === setting.folderId,
  );

  if (index === -1) {
    store.folderSettings.push(setting);
  } else {
    store.folderSettings[index] = setting;
  }
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

function upsertFolderInsight(
  store: InsightStore,
  insight: FolderInsightRecord,
): void {
  const index = store.folderInsights.findIndex(
    (item) => item.folderId === insight.folderId,
  );

  if (index === -1) {
    store.folderInsights.push(insight);
  } else {
    store.folderInsights[index] = insight;
  }
}

function shouldSuggestInstruction(
  setting: FolderInsightSetting | null,
  context: IndexedFolderContext,
): boolean {
  return (
    !setting ||
    (setting.instructionSource === "suggested" &&
      setting.suggestionContextHash !== context.suggestionContextHash)
  );
}

function getDocumentStatus(
  document: IndexedFolderDocument,
  setting: FolderInsightSetting | null,
  insight: DocumentInsightRecord | null,
): InsightStatus {
  if (!setting || !insight) {
    return "pending";
  }

  return insight.folderId === document.record.folderId &&
    insight.instructionHash === instructionHash(setting.instruction) &&
    insight.documentHash === document.documentHash
    ? "fresh"
    : "stale";
}

function getFolderStatus(
  context: IndexedFolderContext,
  setting: FolderInsightSetting | null,
  folderInsight: FolderInsightRecord | null,
  documentInsights: DocumentInsightRecord[],
): InsightStatus {
  if (!setting || !folderInsight) {
    return "pending";
  }

  const currentInstructionHash = instructionHash(setting.instruction);

  if (folderInsight.instructionHash !== currentInstructionHash) {
    return "stale";
  }

  if (documentInsights.length !== context.documents.length) {
    return "pending";
  }

  const folderGeneratedAt = Date.parse(folderInsight.generatedAt);
  const hasNewerDocumentInsight = documentInsights.some(
    (insight) => Date.parse(insight.generatedAt) > folderGeneratedAt,
  );

  return hasNewerDocumentInsight ? "stale" : "fresh";
}

function countPendingJobs(
  contexts: IndexedFolderContext[],
  store: InsightStore,
): number {
  let count = 0;

  for (const context of contexts) {
    const setting = getFolderSetting(store, context.folder.id);

    if (shouldSuggestInstruction(setting, context)) {
      count += 1;
      continue;
    }

    if (!setting) {
      continue;
    }

    const currentInstructionHash = instructionHash(setting.instruction);
    let hasStaleDocument = false;

    for (const document of context.documents) {
      const insight = getDocumentInsight(store, document.record.id);

      if (
        !insight ||
        insight.folderId !== context.folder.id ||
        insight.instructionHash !== currentInstructionHash ||
        insight.documentHash !== document.documentHash
      ) {
        count += 1;
        hasStaleDocument = true;
      }
    }

    if (!hasStaleDocument) {
      const folderInsight = getFolderInsight(store, context.folder.id);
      const documentInsights = context.documents
        .map((document) => getDocumentInsight(store, document.record.id))
        .filter((insight): insight is DocumentInsightRecord => insight !== null);

      if (
        getFolderStatus(context, setting, folderInsight, documentInsights) !== "fresh"
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

function normalizeSections(value: unknown): InsightSection[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((section) => {
      if (typeof section !== "object" || section === null || Array.isArray(section)) {
        return null;
      }

      const record = section as Record<string, unknown>;
      const title = normalizeText(record.title);
      const items = Array.isArray(record.items)
        ? record.items.map(normalizeText).filter(Boolean).slice(0, 6)
        : [];

      if (!title || items.length === 0) {
        return null;
      }

      return { title, items };
    })
    .filter((section): section is InsightSection => section !== null)
    .slice(0, 5);
}

function normalizeFolderSections(
  value: unknown,
  documentNameById: Map<string, string>,
): FolderInsightSection[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((section) => {
      if (typeof section !== "object" || section === null || Array.isArray(section)) {
        return null;
      }

      const record = section as Record<string, unknown>;
      const title = normalizeText(record.title);
      const items = Array.isArray(record.items)
        ? record.items
            .map((item): FolderInsightItem | null => {
              if (typeof item === "string") {
                return { text: item.trim() };
              }

              if (
                typeof item !== "object" ||
                item === null ||
                Array.isArray(item)
              ) {
                return null;
              }

              const itemRecord = item as Record<string, unknown>;
              const text = normalizeText(itemRecord.text);
              const documentId = normalizeText(itemRecord.documentId);

              if (!text) {
                return null;
              }

              if (!documentId || !documentNameById.has(documentId)) {
                return { text };
              }

              return {
                text,
                documentId,
                documentName: documentNameById.get(documentId),
              };
            })
            .filter((item): item is FolderInsightItem => item !== null)
            .slice(0, 8)
        : [];

      if (!title || items.length === 0) {
        return null;
      }

      return { title, items };
    })
    .filter((section): section is FolderInsightSection => section !== null)
    .slice(0, 5);
}

async function generateSuggestedInstruction(
  context: IndexedFolderContext,
): Promise<string> {
  const { azure } = getConfig();
  const client = getClient();
  const documentContext = context.documents
    .slice(0, MAX_FOLDER_DOCUMENTS_FOR_SUGGESTION)
    .map(
      ({ record, index }) =>
        `- ${record.name}\n  Summary: ${index.summary}\n  Tags: ${index.tags.join(", ")}`,
    )
    .join("\n");

  const response = await client.chat.completions.create({
    model: azure.chatDeployment,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You propose editable folder-level instructions for generating personal knowledge-base insights. " +
          "Infer the likely folder purpose from its name and document metadata. " +
          "Do not mention that this is inferred. Respond with strict JSON: " +
          '{"instruction":"one concise instruction paragraph"}',
      },
      {
        role: "user",
        content: `Folder name: ${context.folder.name}\n\nDocuments:\n${documentContext}`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  const parsed = parseJsonObject(raw);
  const instruction = normalizeText(parsed.instruction);

  if (!instruction) {
    throw new Error("The model did not return a folder instruction.");
  }

  return instruction;
}

async function generateDocumentInsight(
  document: IndexedFolderDocument,
  instruction: string,
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
          "You generate cached insights for one document in a personal knowledge base. " +
          "Follow the folder instruction exactly. Keep insights concrete and useful. " +
          "Respond with strict JSON: " +
          '{"overview":"one sentence","sections":[{"title":"section name","items":["2-6 concise items"]}]}.',
      },
      {
        role: "user",
        content:
          `Folder instruction:\n${instruction}\n\n` +
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
  const sections = normalizeSections(parsed.sections);

  if (!overview && sections.length === 0) {
    throw new Error("The model did not return document insights.");
  }

  return { overview, sections };
}

async function generateFolderInsight(
  context: IndexedFolderContext,
  documentInsights: DocumentInsightRecord[],
  instruction: string,
): Promise<ParsedFolderInsight> {
  const { azure } = getConfig();
  const client = getClient();
  const documentNameById = new Map(
    context.documents.map((document) => [document.record.id, document.record.name]),
  );
  const insightContext = documentInsights.map((insight) => ({
    documentId: insight.documentId,
    documentName: insight.documentName,
    overview: insight.overview,
    sections: insight.sections,
  }));

  const response = await client.chat.completions.create({
    model: azure.chatDeployment,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You aggregate document-level insights into folder-level insights for a personal knowledge base. " +
          "Follow the folder instruction and prioritize the most useful cross-document takeaways. " +
          "Respond with strict JSON: " +
          '{"overview":"one sentence","sections":[{"title":"section name","items":[{"text":"concise item","documentId":"source document id when relevant"}]}]}.',
      },
      {
        role: "user",
        content:
          `Folder name: ${context.folder.name}\n` +
          `Folder instruction:\n${instruction}\n\n` +
          `Document insights:\n${JSON.stringify(insightContext, null, 2)}`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  const parsed = parseJsonObject(raw);
  const overview = normalizeText(parsed.overview);
  const sections = normalizeFolderSections(parsed.sections, documentNameById);

  if (!overview && sections.length === 0) {
    throw new Error("The model did not return folder insights.");
  }

  return { overview, sections };
}

export async function getInsightsView(): Promise<InsightsResponse> {
  const [store, contexts] = await Promise.all([
    readStore(),
    loadIndexedFolderContexts(),
  ]);
  const folders: FolderInsightView[] = contexts.map((context) => {
    const setting = getFolderSetting(store, context.folder.id);
    const currentInstructionHash = setting
      ? instructionHash(setting.instruction)
      : null;
    const documentHashById = new Map(
      context.documents.map((document) => [
        document.record.id,
        document.documentHash,
      ]),
    );
    const documents = context.documents.map((document) => {
      const insight = getDocumentInsight(store, document.record.id);
      const status = getDocumentStatus(document, setting, insight);

      return {
        documentId: document.record.id,
        documentName: document.record.name,
        status,
        generatedAt: insight?.generatedAt ?? null,
        overview: insight?.overview ?? "",
        sections: insight?.sections ?? [],
      };
    });
    const freshDocumentInsights = context.documents
      .map((document) => getDocumentInsight(store, document.record.id))
      .filter(
        (insight): insight is DocumentInsightRecord =>
          insight !== null &&
          Boolean(currentInstructionHash) &&
          insight.folderId === context.folder.id &&
          insight.instructionHash === currentInstructionHash &&
          insight.documentHash === documentHashById.get(insight.documentId),
      );
    const folderInsight = getFolderInsight(store, context.folder.id);
    const folderStatus = getFolderStatus(
      context,
      setting,
      folderInsight,
      freshDocumentInsights,
    );
    const documentStatuses = documents.map((document) => document.status);
    const status: InsightStatus = documentStatuses.includes("pending")
      ? "pending"
      : documentStatuses.includes("stale") || folderStatus === "stale"
        ? "stale"
        : folderStatus;

    return {
      folder: context.folder,
      documentCount: context.documents.length,
      instruction: setting?.instruction ?? "",
      instructionSource: setting?.instructionSource ?? null,
      suggestionStatus: setting ? "ready" : "pending",
      status,
      generatedAt: folderInsight?.generatedAt ?? null,
      overview: folderInsight?.overview ?? "",
      sections: folderInsight?.sections ?? [],
      documents,
    };
  });

  return {
    folders,
    pendingJobs: countPendingJobs(contexts, store),
  };
}

export async function updateFolderInsightInstruction({
  folderId,
  instruction,
}: {
  folderId: string;
  instruction: string;
}): Promise<InsightsResponse> {
  const trimmedInstruction = instruction.trim();

  if (!trimmedInstruction) {
    throw new Error("Instruction is required.");
  }

  const [store, folders] = await Promise.all([readStore(), listFolders()]);
  const folder = folders.find((item) => item.id === folderId);

  if (!folder) {
    throw new Error("Folder not found.");
  }

  const existing = getFolderSetting(store, folderId);
  const now = new Date().toISOString();

  upsertFolderSetting(store, {
    folderId,
    instruction: trimmedInstruction,
    instructionSource: "custom",
    suggestedInstruction: existing?.suggestedInstruction ?? "",
    suggestionContextHash: existing?.suggestionContextHash ?? "",
    suggestionGeneratedAt: existing?.suggestionGeneratedAt ?? now,
    updatedAt: now,
  });

  await writeStore(store);

  return getInsightsView();
}

export async function runBackgroundInsights(): Promise<InsightsRunResponse> {
  return runInsightsPass({});
}

export async function forceGenerateInsights({
  folderId,
}: {
  folderId?: string;
} = {}): Promise<InsightsRunResponse> {
  return runInsightsPass({ force: true, folderId });
}

async function runInsightsPass({
  force = false,
  folderId,
}: {
  force?: boolean;
  folderId?: string;
}): Promise<InsightsRunResponse> {
  const store = await readStore();
  const contexts = (await loadIndexedFolderContexts()).filter(
    (context) => !folderId || context.folder.id === folderId,
  );
  let callsRemaining = force
    ? contexts.reduce((total, context) => total + context.documents.length + 2, 0)
    : MAX_BACKGROUND_MODEL_CALLS;
  let suggestionsGenerated = 0;
  let documentInsightsGenerated = 0;
  let folderInsightsGenerated = 0;

  for (const context of contexts) {
    if (callsRemaining <= 0) {
      break;
    }

    const setting = getFolderSetting(store, context.folder.id);

    if (
      shouldSuggestInstruction(setting, context) ||
      (force && setting?.instructionSource !== "custom")
    ) {
      const instruction = await generateSuggestedInstruction(context);
      const now = new Date().toISOString();

      upsertFolderSetting(store, {
        folderId: context.folder.id,
        instruction,
        instructionSource: "suggested",
        suggestedInstruction: instruction,
        suggestionContextHash: context.suggestionContextHash,
        suggestionGeneratedAt: now,
        updatedAt: setting?.updatedAt ?? now,
      });
      await writeStore(store);
      callsRemaining -= 1;
      suggestionsGenerated += 1;
    }
  }

  for (const context of contexts) {
    if (callsRemaining <= 0) {
      break;
    }

    const setting = getFolderSetting(store, context.folder.id);

    if (!setting) {
      continue;
    }

    const currentInstructionHash = instructionHash(setting.instruction);

    for (const document of context.documents) {
      if (callsRemaining <= 0) {
        break;
      }

      const insight = getDocumentInsight(store, document.record.id);

      if (
        !force &&
        insight &&
        insight.folderId === context.folder.id &&
        insight.instructionHash === currentInstructionHash &&
        insight.documentHash === document.documentHash
      ) {
        continue;
      }

      const generated = await generateDocumentInsight(document, setting.instruction);

      upsertDocumentInsight(store, {
        documentId: document.record.id,
        folderId: context.folder.id,
        documentName: document.record.name,
        instructionHash: currentInstructionHash,
        documentHash: document.documentHash,
        generatedAt: new Date().toISOString(),
        overview: generated.overview,
        sections: generated.sections,
      });
      await writeStore(store);
      callsRemaining -= 1;
      documentInsightsGenerated += 1;
    }
  }

  for (const context of contexts) {
    if (callsRemaining <= 0) {
      break;
    }

    const setting = getFolderSetting(store, context.folder.id);

    if (!setting) {
      continue;
    }

    const currentInstructionHash = instructionHash(setting.instruction);
    const documentHashById = new Map(
      context.documents.map((document) => [
        document.record.id,
        document.documentHash,
      ]),
    );
    const documentInsights = context.documents
      .map((document) => getDocumentInsight(store, document.record.id))
      .filter(
        (insight): insight is DocumentInsightRecord =>
          insight !== null &&
          insight.folderId === context.folder.id &&
          insight.instructionHash === currentInstructionHash &&
          insight.documentHash === documentHashById.get(insight.documentId),
      );
    const folderInsight = getFolderInsight(store, context.folder.id);

    if (
      documentInsights.length !== context.documents.length ||
      (!force &&
        getFolderStatus(context, setting, folderInsight, documentInsights) === "fresh")
    ) {
      continue;
    }

    const generated = await generateFolderInsight(
      context,
      documentInsights,
      setting.instruction,
    );

    upsertFolderInsight(store, {
      folderId: context.folder.id,
      instructionHash: currentInstructionHash,
      generatedAt: new Date().toISOString(),
      overview: generated.overview,
      sections: generated.sections,
    });
    await writeStore(store);
    callsRemaining -= 1;
    folderInsightsGenerated += 1;
  }

  const pendingJobs = countPendingJobs(contexts, store);
  const changed =
    suggestionsGenerated > 0 ||
    documentInsightsGenerated > 0 ||
    folderInsightsGenerated > 0;

  return {
    started: true,
    changed,
    suggestionsGenerated,
    documentInsightsGenerated,
    folderInsightsGenerated,
    pendingJobs,
  };
}
